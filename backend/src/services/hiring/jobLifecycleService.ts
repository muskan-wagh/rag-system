import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { logger } from '@/utils/logger';
import { logActivity } from '@/services/activity';

/**
 * Job open / closed lifecycle.
 *
 * ── The gap this fills ────────────────────────────────────────────────────────
 * HireStack had no job status column at all. Every job was implicitly open
 * forever, nothing gated new applications or invitations, and a recruiter who
 * wanted to stop intake for a filled role had no lever other than deleting the
 * job — which would have taken the candidates, screening results, assessment
 * attempts, interviews and reports with it if the foreign keys allowed.
 *
 * ── The contract ──────────────────────────────────────────────────────────────
 *   open    → accepts new applications, invitations, progression.
 *   closed  → accepts NONE of those, but stays fully readable. Every historical
 *             record remains accessible to an authorized recruiter, and the
 *             workspace renders in read-only mode.
 *
 * Closing NEVER deletes a row. It sets `status`, `closed_at` and `closed_by`.
 *
 * ── Authorized override ───────────────────────────────────────────────────────
 * A recruiter can explicitly opt a job into still-issuing assessment invitations
 * after closure via `progression_config.allow_invites_when_closed`. It is off by
 * default and fail-closed: a missing key, a missing config object, or a failed
 * read all mean "closed means closed".
 */

export const JOB_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export interface JobLifecycleRecord {
  id: string;
  title: string;
  status: JobStatus;
  closed_at: string | null;
  closed_by: string | null;
  progression_config: Record<string, unknown> | null;
}

export type RecruitmentActivity =
  | 'enrol'
  | 'invite'
  | 'screen'
  | 'schedule_interview'
  | 'advance';

export class JobClosedError extends AppError {
  constructor(
    public readonly jobId: string,
    public readonly jobTitle: string,
    public readonly activity: RecruitmentActivity,
    public readonly overrideAllowed: boolean,
  ) {
    super(
      `"${jobTitle}" is closed and no longer accepts new ${ACTIVITY_LABEL[activity].toLowerCase()}. ` +
        (overrideAllowed
          ? 'Enable "Allow assessment invitations on closed jobs" in this job\'s settings to proceed.'
          : 'Reopen the job to continue recruiting.'),
      409,
      ErrorCodes.JOB_CLOSED,
      { jobId, jobTitle, activity, overrideAllowed },
    );
    this.name = 'JobClosedError';
  }
}

const ACTIVITY_LABEL: Record<RecruitmentActivity, string> = {
  enrol: 'Applications',
  invite: 'Assessment invitations',
  screen: 'Screening runs',
  schedule_interview: 'Interview scheduling',
  advance: 'Stage changes',
};

/** Fetch the job and assert ownership. 404 (not 403) to avoid an existence oracle. */
export async function requireOwnedJob(
  recruiterId: string,
  jobId: string,
): Promise<JobLifecycleRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, status, closed_at, closed_by, progression_config')
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to load job: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (!data) throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);

  const row = data as Partial<JobLifecycleRecord> & { status?: string };
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    // Treat an unknown/absent status as open — the column has a NOT NULL
    // DEFAULT, so NULL only appears on a hand-edited row, and defaulting to
    // open preserves the pre-migration behaviour rather than locking a job.
    status: row.status === JOB_STATUS.CLOSED ? JOB_STATUS.CLOSED : JOB_STATUS.OPEN,
    closed_at: row.closed_at ?? null,
    closed_by: row.closed_by ?? null,
    progression_config: (row.progression_config as Record<string, unknown> | null) ?? null,
  };
}

export async function isJobOpen(recruiterId: string, jobId: string): Promise<boolean> {
  const job = await requireOwnedJob(recruiterId, jobId);
  return job.status === JOB_STATUS.OPEN;
}

/**
 * Read the explicit `allow_invites_when_closed` override.
 *
 * FAIL-CLOSED. Anything other than a literal `true` means "not allowed".
 */
export async function allowsInvitesWhenClosed(
  job: Pick<JobLifecycleRecord, 'progression_config'>,
): Promise<boolean> {
  return job.progression_config?.allow_invites_when_closed === true;
}

/**
 * Gate a recruitment activity on the job being open.
 *
 * @param overrideAllowed When true, a `JobClosedError` is still thrown but
 *   carries `overrideAllowed: true` so the caller can distinguish "blocked and
 *   overridable" from "blocked outright". Callers that support the override
 *   should pass `activity: 'invite'` and handle the error themselves; callers
 *   that do not simply let it propagate.
 */
export async function assertJobAccepts(
  recruiterId: string,
  jobId: string,
  activity: RecruitmentActivity,
  options: { respectInviteOverride?: boolean } = {},
): Promise<JobLifecycleRecord> {
  const job = await requireOwnedJob(recruiterId, jobId);

  if (job.status === JOB_STATUS.OPEN) return job;

  if (activity === 'invite' && options.respectInviteOverride && (await allowsInvitesWhenClosed(job))) {
    logger.info('[jobs] inviting on a closed job under explicit override', {
      jobId,
      override: 'allow_invites_when_closed',
    });
    return job;
  }

  throw new JobClosedError(
    job.id,
    job.title,
    activity,
    activity === 'invite' && job.progression_config?.allow_invites_when_closed === true,
  );
}

/**
 * Open or close a job.
 *
 * Idempotent: closing an already-closed job refreshes the audit fields rather
 * than erroring, and reopening a closed job clears `closed_by` while keeping
 * `closed_at` so the closure window stays inspectable.
 */
export async function setJobStatus(input: {
  recruiterId: string;
  jobId: string;
  status: JobStatus;
  reason?: string;
}): Promise<{ jobId: string; title: string; status: JobStatus; changed: boolean; closedAt: string | null }> {
  const job = await requireOwnedJob(input.recruiterId, input.jobId);
  const now = new Date().toISOString();
  const changed = job.status !== input.status;

  const patch: Record<string, unknown> = { status: input.status };
  if (input.status === JOB_STATUS.CLOSED) {
    patch.closed_at = now;
    patch.closed_by = input.recruiterId;
  } else {
    patch.closed_at = null;
    patch.closed_by = null;
    patch.reopened_at = now;
  }

  const { error } = await getSupabaseClient().from('jobs').update(patch).eq('id', job.id);
  if (error) {
    throw new AppError(`Failed to update job status: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  if (changed) {
    await logActivity({
      recruiterId: input.recruiterId,
      actionType: 'job_status_changed',
      description:
        input.status === JOB_STATUS.CLOSED
          ? `Closed "${job.title}" — no new applications, invitations or progression`
          : `Reopened "${job.title}"`,
      metadata: {
        job_id: job.id,
        from: job.status,
        to: input.status,
        ...(input.reason ? { reason: input.reason.slice(0, 500) } : {}),
        // Explicitly recorded so a reviewer can see that closing preserves data.
        preserves: [
          'candidates',
          'job_applications',
          'screening_results',
          'assessments',
          'assessment_attempts',
          'interviews',
          'candidate_reports',
        ],
      },
    }).catch(() => undefined);
  }

  return {
    jobId: job.id,
    title: job.title,
    status: input.status,
    changed,
    closedAt: input.status === JOB_STATUS.CLOSED ? now : null,
  };
}