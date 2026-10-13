import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { logger } from '@/utils/logger';
import { logActivity } from '@/services/activity';
import { setApplicationStage, getApplicationRecord } from './applicationService';
import { assertJobAccepts, JOB_STATUS } from './jobLifecycleService';
import { normalizeStage, type PipelineStage } from './stageTypes';

/**
 * Recruiter decisions on a candidate's job application.
 *
 * ── The rule this module exists to enforce ────────────────────────────────────
 * A passing assessment score must NOT move a candidate on its own.
 *
 * `progression_config.assessment_to_technical` exists and is honoured, but it is
 * off by default and reads `=== true` — never "present". With it off, a
 * completed assessment parks the candidate at `Assessment` with a visible
 * "passed, awaiting recruiter move" timeline entry, and a human presses the
 * button. This service is that button.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 * The trigger id is derived from `(applicationId, decision)`, so a double click,
 * a retried request and a concurrent tab all resolve to one event. Duplicate
 * interview creation is additionally blocked at the database level by
 * `UNIQUE(interview_invites.interview_id)` and by `interviews` reuse in
 * `progressionService.createNextStage`.
 */

export const RECRUITER_DECISIONS = [
  'Technical Round',
  'Interview',
  'Final Decision',
  'Hold',
  'Rejected',
] as const;

export type RecruiterDecision = (typeof RECRUITER_DECISIONS)[number];

export function isRecruiterDecision(value: unknown): value is RecruiterDecision {
  return typeof value === 'string' && (RECRUITER_DECISIONS as readonly string[]).includes(value);
}

export interface DecisionInput {
  recruiterId: string;
  jobId: string;
  candidateId: string;
  decision: RecruiterDecision;
  reason?: string;
  interviewerName?: string;
  /** Optional score context for the audit trail. Never used to auto-decide. */
  scoreContext?: { percentage?: number | null; passed?: boolean | null; assessmentId?: string | null };
}

export interface DecisionResult {
  applicationId: string;
  fromStage: PipelineStage | string;
  toStage: RecruiterDecision;
  changed: boolean;
  deduplicated: boolean;
  /** Interview row created for interview-bearing stages. */
  interviewId?: string;
  interviewLink?: string;
}

/**
 * Advance, hold or reject a candidate on ONE job application.
 */
export async function makeRecruiterDecision(input: DecisionInput): Promise<DecisionResult> {
  if (!isRecruiterDecision(input.decision)) {
    throw new AppError(
      `decision must be one of: ${RECRUITER_DECISIONS.join(', ')}`,
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  // Creating recruitment activity on a closed job is refused — with the single
  // exception of a candidate already IN that stage being re-confirmed, which is
  // a no-op anyway.
  await assertJobAccepts(input.recruiterId, input.jobId, 'advance');

  const application = await getApplicationRecord(input.jobId, input.candidateId);
  if (!application) {
    throw new AppError('Candidate is not in this job', 404, ErrorCodes.NOT_FOUND);
  }

  const fromStage = normalizeStage(application.current_stage) ?? 'Applied';
  const toStage = input.decision;

  if (fromStage === toStage) {
    return {
      applicationId: application.id,
      fromStage,
      toStage,
      changed: false,
      deduplicated: true,
    };
  }

  const result = await setApplicationStage({
    jobId: input.jobId,
    candidateId: input.candidateId,
    recruiterId: input.recruiterId,
    toStage: toStage,
    triggerType: 'manual',
    // Keyed on the application + the decision itself. Pressing "Technical
    // Round" twice is one action; pressing it again after moving on is a
    // different trigger id and therefore still works.
    triggerId: `decision:${application.id}:${toStage}`,
    overrideReason: input.reason,
    metadata: {
      action: 'recruiter_decision',
      ...(input.reason ? { reason: input.reason.slice(0, 2000) } : {}),
      ...(input.scoreContext
        ? {
            assessment_percentage: input.scoreContext.percentage ?? null,
            assessment_passed: input.scoreContext.passed ?? null,
            assessment_id: input.scoreContext.assessmentId ?? null,
            // Recorded explicitly so an auditor can see the score informed but
            // did not drive the decision.
            score_role: 'informational_only',
          }
        : {}),
    },
  });

  // Interview-bearing stages get a real scheduled interview + secure invite.
  // Imported lazily to keep this module free of a cycle with progressionService.
  let interviewId: string | undefined;
  let interviewLink: string | undefined;
  if (result.changed && (toStage === 'Technical Round' || toStage === 'Interview')) {
    const { createNextStage } = await import('./progressionService');
    const created = await createNextStage({
      candidateId: input.candidateId,
      jobId: input.jobId,
      recruiterId: input.recruiterId,
      toStage,
      interviewerName: input.interviewerName,
    });
    interviewId = created.interviewId;
    interviewLink = created.inviteLink || undefined;
  }

  if (result.changed) {
    await logActivity({
      recruiterId: input.recruiterId,
      actionType: 'candidate_advanced',
      description: `Recruiter decision: ${fromStage} → ${toStage}`,
      candidateId: input.candidateId,
      metadata: {
        job_id: input.jobId,
        application_id: application.id,
        from: fromStage,
        to: toStage,
        ...(input.reason ? { reason: input.reason.slice(0, 500) } : {}),
        ...(input.scoreContext ? { score_context: input.scoreContext } : {}),
      },
    }).catch((err: unknown) => {
      logger.warn('[decision] activity log failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return {
    applicationId: application.id,
    fromStage: result.fromStage,
    toStage,
    changed: result.changed,
    deduplicated: result.deduplicated,
    interviewId,
    interviewLink,
  };
}

/**
 * The best "next" decision for a candidate, derived from their real stage.
 * Drives which buttons the workspace renders enabled.
 */
export function nextDecisionFor(stage: string): RecruiterDecision[] {
  switch (normalizeStage(stage)) {
    case 'Assessment':
      return ['Technical Round', 'Hold', 'Rejected'];
    case 'Technical Round':
      return ['Interview', 'Hold', 'Rejected'];
    case 'Interview':
      return ['Final Decision', 'Hold', 'Rejected'];
    case 'Final Decision':
      return ['Hold', 'Rejected'];
    case 'Shortlisted':
    case 'Screening':
    case 'Applied':
      return ['Hold', 'Rejected'];
    default:
      return [];
  }
}

/**
 * Suppress assessment actions that are no longer valid.
 *
 * A rejected candidate must not be able to receive a new invitation, and a
 * candidate already past the assessment stage must not be re-scored against a
 * stale attempt. Returns `null` when the action is allowed.
 */
export function blockedAssessmentAction(
  stage: string,
  jobStatus: string,
  invitesAllowedWhenClosed: boolean,
): string | null {
  const canonical = normalizeStage(stage);
  if (canonical === 'Rejected' || canonical === 'Withdrawn') {
    return 'This candidate was rejected. Reverse the rejection before sending another assessment.';
  }
  if (canonical === 'Hired') {
    return 'This candidate has been hired for this role.';
  }
  if (canonical === 'Technical Round' || canonical === 'Interview' || canonical === 'Final Decision') {
    return 'This candidate has already moved past the assessment stage.';
  }
  if (jobStatus === JOB_STATUS.CLOSED && !invitesAllowedWhenClosed) {
    return 'This job is closed. Reopen it, or enable "Allow assessment invitations on closed jobs".';
  }
  return null;
}

/** Whether this recruiter may still act on a candidate's assessment. */
export async function canSendAssessmentTo(
  recruiterId: string,
  jobId: string,
  candidateId: string,
): Promise<{ allowed: boolean; reason: string | null; applicationId: string | null }> {
  const application = await getApplicationRecord(jobId, candidateId);
  if (!application) {
    return { allowed: false, reason: 'Candidate is not in this job.', applicationId: null };
  }

  const { data: job } = await getSupabaseClient()
    .from('jobs')
    .select('status, progression_config')
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();

  const jobStatus = String((job as { status?: string } | null)?.status ?? 'open');
  const allowsOverride =
    ((job as { progression_config?: Record<string, unknown> } | null)?.progression_config
      ?.allow_invites_when_closed) === true;

  const blocked = blockedAssessmentAction(application.current_stage, jobStatus, allowsOverride);
  return { allowed: blocked === null, reason: blocked, applicationId: application.id };
}