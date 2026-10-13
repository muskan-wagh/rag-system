import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { logger } from '@/utils/logger';
import { logActivity, type ActionType } from '@/services/activity';
import {
  setApplicationStage,
  getApplicationRecord,
  requireOwnedJobAndCandidate,
  type StageChangeResult,
} from './applicationService';
import { normalizeStage } from './stageTypes';

/**
 * Shortlisting — a first-class, per-job, recruiter-only candidate decision.
 *
 * ── What shortlisting means here ──────────────────────────────────────────────
 * A shortlist is: "I have looked at this person's screening result for THIS job
 * and I want them in the assessment queue for THIS job." It is:
 *
 *   • Scoped to one `job_applications` row. The same person can be shortlisted
 *     for a backend role and sitting in Assessment for a frontend role at the
 *     same time. Nothing about one job leaks into the other.
 *   • A real pipeline stage (`Screening → Shortlisted → Assessment`), not a flag
 *     bolted onto a row, so it appears in the same buckets as every other stage
 *     and the dashboard counts it separately from Applied and Screening.
 *   • Never automatic. An AI screening score can inform the decision; it can
 *     never make it. There is deliberately no `progression_config` flag that
 *     auto-shortlists.
 *   • Fully reversible. Un-shortlisting writes its own audit row rather than
 *     deleting the original, and leaves `screening_results` untouched.
 *
 * ── Why the eligibility check is a warning, not a hard block ─────────────────
 * `shortlistCandidate` requires the application to exist and refuses to move a
 * candidate who is already past Assessment. It does NOT hard-require a
 * `screening_results` row: recruiters routinely shortlist on the strength of a
 * CV before the AI screening pass has run. When no score exists, `screeningScore`
 * comes back null and the caller surfaces "no screening score on file" rather
 * than pretending one exists.
 */

export interface ShortlistEligibility {
  eligible: boolean;
  /** Machine-readable reason when `eligible` is false. */
  reason?: string;
  currentStage: string | null;
  applicationId: string | null;
  screening: { status: string; overall: number; overridden: boolean } | null;
}

export interface ShortlistResult extends StageChangeResult {
  /** Persisted screening score for this job, or null when none exists. */
  screeningScore: number | null;
}

export async function shortlistCandidate(input: {
  jobId: string;
  candidateId: string;
  recruiterId: string;
  /** Optional recruiter note, stored on `job_applications.shortlist_note`. */
  note?: string;
  metadata?: Record<string, unknown>;
}): Promise<ShortlistResult> {
  const eligibility = await checkShortlistEligibility(input);
  if (!eligibility.eligible) {
    throw new AppError(eligibility.reason || 'Candidate cannot be shortlisted', 409, ErrorCodes.CONFLICT, {
      currentStage: eligibility.currentStage,
    });
  }

  const application = await getApplicationRecord(input.jobId, input.candidateId);
  if (!application) {
    throw new AppError('Candidate is not in this job', 404, ErrorCodes.NOT_FOUND);
  }

  const result = await setApplicationStage({
    jobId: input.jobId,
    candidateId: input.candidateId,
    recruiterId: input.recruiterId,
    toStage: 'Shortlisted',
    triggerType: 'manual',
    // Keyed on the application so a double click, a retried request and a
    // concurrent tab all collapse onto one event.
    triggerId: `shortlist:${application.id}`,
    overrideReason: input.note,
    metadata: {
      ...(input.metadata || {}),
      ...(eligibility.screening
        ? {
            screening_score: eligibility.screening.overall,
            screening_status: eligibility.screening.status,
            screening_overridden: eligibility.screening.overridden,
          }
        : { screening_score: null, note: 'no screening result on file' }),
    },
  });

  if (result.changed) {
    await logShortlistActivity(input, 'shortlisted', result);
  }

  return {
    ...result,
    screeningScore: eligibility.screening?.overall ?? null,
  };
}

/**
 * Reverse a shortlist. The candidate returns to `Screening` (they are still a
 * live applicant whose screening result is intact) or to whatever explicit
 * target the recruiter chooses.
 *
 * The original shortlist row is NOT deleted — its timeline entry and
 * `shortlisted_at`/`shortlisted_by` columns stay for audit; only
 * `current_stage` moves.
 */
export async function reverseShortlist(input: {
  jobId: string;
  candidateId: string;
  recruiterId: string;
  /** Defaults to 'Screening'. */
  toStage?: 'Screening' | 'Applied';
  reason?: string;
}): Promise<StageChangeResult> {
  await requireOwnedJobAndCandidate(input.recruiterId, input.jobId, input.candidateId);

  const application = await getApplicationRecord(input.jobId, input.candidateId);
  if (!application) {
    throw new AppError('Candidate is not in this job', 404, ErrorCodes.NOT_FOUND);
  }

  const current = normalizeStage(application.current_stage);
  if (current !== 'Shortlisted') {
    throw new AppError(
      `Candidate is at ${current ?? application.current_stage}, not Shortlisted — there is nothing to reverse.`,
      409,
      ErrorCodes.CONFLICT,
    );
  }

  const toStage = input.toStage ?? 'Screening';

  // Reversal is a backwards move, which `isValidTransition` forbids by design.
  // `force` is the sanctioned escape hatch: it is used here, at a named
  // recruiter-only entry point, and the reversal is written to the timeline with
  // an explicit `shortlist_reversed` action.
  const result = await setApplicationStage({
    jobId: input.jobId,
    candidateId: input.candidateId,
    recruiterId: input.recruiterId,
    toStage,
    triggerType: 'manual',
    triggerId: `unshortlist:${application.id}:${Date.now()}`,
    force: true,
    overrideReason: input.reason,
    metadata: {
      action: 'shortlist_reversed',
      reversed_from: 'Shortlisted',
      ...(input.reason ? { reason: input.reason.slice(0, 2000) } : {}),
    },
  });

  if (result.changed) {
    await supabaseTimelineMarker(input, result, toStage);
    await logShortlistActivity(
      { ...input, note: input.reason },
      `un-shortlisted (moved to ${toStage})`,
      result,
    );
  }

  return result;
}

/**
 * Can this candidate be shortlisted for this job right now?
 *
 * Returns the reasons rather than throwing so the UI can disable the button and
 * explain itself.
 */
export async function checkShortlistEligibility(input: {
  jobId: string;
  candidateId: string;
  recruiterId: string;
}): Promise<ShortlistEligibility> {
  await requireOwnedJobAndCandidate(input.recruiterId, input.jobId, input.candidateId);

  const supabase = getSupabaseClient();
  const application = await getApplicationRecord(input.jobId, input.candidateId);

  if (!application) {
    return {
      eligible: false,
      reason: 'Candidate has not applied to this job yet.',
      currentStage: null,
      applicationId: null,
      screening: null,
    };
  }

  const current = normalizeStage(application.current_stage);

  // Already there is not an error — it is a no-op the UI can treat as success.
  if (current === 'Shortlisted') {
    return {
      eligible: true,
      currentStage: 'Shortlisted',
      applicationId: application.id,
      screening: await readScreening(input.jobId, input.candidateId),
    };
  }

  if (current === 'Hired') {
    return {
      eligible: false,
      reason: 'This candidate has already been hired.',
      currentStage: current,
      applicationId: application.id,
      screening: await readScreening(input.jobId, input.candidateId),
    };
  }

  if (current === 'Rejected' || current === 'Withdrawn') {
    return {
      eligible: false,
      reason: `This candidate is ${current}. Reverse that decision first.`,
      currentStage: current,
      applicationId: application.id,
      screening: await readScreening(input.jobId, input.candidateId),
    };
  }

  if (current && ['Assessment', 'Technical Round', 'Interview', 'Final Decision'].includes(current)) {
    return {
      eligible: false,
      reason: `This candidate is already at ${current}. Shortlisting applies before the assessment stage.`,
      currentStage: current,
      applicationId: application.id,
      screening: await readScreening(input.jobId, input.candidateId),
    };
  }

  return {
    eligible: true,
    currentStage: current,
    applicationId: application.id,
    screening: await readScreening(input.jobId, input.candidateId),
  };
}

/** Screening result for one (job, candidate) pair, or null when none exists. */
export async function readScreening(
  jobId: string,
  candidateId: string,
): Promise<{ status: string; overall: number; overridden: boolean } | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('screening_results')
    .select('status, overall, recruiter_override')
    .eq('job_id', jobId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { status?: string; overall?: number; recruiter_override?: boolean };
  return {
    status: row.status ?? 'pending',
    overall: Number(row.overall ?? 0),
    overridden: Boolean(row.recruiter_override),
  };
}

/**
 * Every application for this job that is currently Shortlisted.
 *
 * This is the ONLY definition of assessment eligibility in the workspace. It is
 * deliberately a query on `job_applications` rather than on `screening_results`
 * or `candidates.current_status`: a candidate who merely passed an AI screen has
 * not been shortlisted by anyone, and a candidate shortlisted for another job
 * must never appear.
 */
export async function listShortlistedApplications(
  jobId: string,
  recruiterId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<Array<{ applicationId: string; candidateId: string }>> {
  const supabase = getSupabaseClient();
  const limit = Math.min(options.limit ?? 500, 2000);
  const offset = options.offset ?? 0;

  const { data, error } = await supabase
    .from('job_applications')
    .select('id, candidate_id')
    .eq('job_id', jobId)
    .eq('current_stage', 'Shortlisted')
    .order('shortlisted_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new AppError(`Failed to load shortlisted candidates: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  return ((data as Array<{ id: string; candidate_id: string }>) ?? []).map((row) => ({
    applicationId: row.id,
    candidateId: row.candidate_id,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `recruiter_activity.action_type` has no CHECK constraint, so a new value is
 * safe, but `historyController.VALID_ACTION_TYPES` does gate the `/api/history`
 * filter and would reject an unknown type with a 400. Kept in sync by
 * shortlistService importing the shared constant.
 */
const SHORTLIST_ACTIONS: Array<{ actionType: ActionType; verb: string }> = [
  { actionType: 'candidate_shortlisted', verb: 'shortlisted' },
  { actionType: 'candidate_shortlist_reversed', verb: 'un-shortlisted' },
];

async function logShortlistActivity(
  input: { jobId: string; candidateId: string; recruiterId: string; note?: string },
  verb: string,
  result: StageChangeResult,
): Promise<void> {
  const entry =
    verb === 'shortlisted' ? SHORTLIST_ACTIONS[0] : SHORTLIST_ACTIONS[1];
  try {
    const { data: candidate } = await getSupabaseClient()
      .from('candidates')
      .select('full_name')
      .eq('id', input.candidateId)
      .maybeSingle();
    const name = (candidate as { full_name?: string } | null)?.full_name || 'Candidate';

    await logActivity({
      recruiterId: input.recruiterId,
      actionType: entry.actionType,
      description: `${name} ${verb} for this job (${result.fromStage} → ${result.toStage})`,
      candidateId: input.candidateId,
      metadata: {
        job_id: input.jobId,
        application_id: result.applicationId,
        from: result.fromStage,
        to: result.toStage,
        recruiter_override: result.usedOverride,
        ...(input.note ? { note: input.note.slice(0, 500) } : {}),
      },
    });
  } catch (err) {
    // Activity logging is best-effort; the stage change is already durable.
    logger.warn('[shortlist] activity log failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * An extra, human-readable marker row for the reversal. `setApplicationStage`
 * already appended an `application_stage_changed` row; this one carries the
 * explicit "this was a shortlist reversal" semantics the journey view keys on.
 */
async function supabaseTimelineMarker(
  input: { jobId: string; candidateId: string; recruiterId: string },
  result: StageChangeResult,
  toStage: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('candidate_status_log').insert({
    candidate_id: input.candidateId,
    status: toStage,
    details: {
      action: 'shortlist_reversed',
      from: 'Shortlisted',
      to: toStage,
      application_id: result.applicationId,
      by: input.recruiterId,
      at: new Date().toISOString(),
    },
    job_id: input.jobId,
    recruiter_id: input.recruiterId,
  });
  if (error) {
    logger.warn('[shortlist] reversal marker could not be written', { error: error.message });
  }
}