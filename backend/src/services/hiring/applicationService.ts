import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { logger } from '@/utils/logger';
import {
  isValidTransition,
  normalizeStage,
  isStageOutcome,
  type PipelineStage,
  type StageOutcome,
} from './stageTypes';

/**
 * THE canonical write path for `job_applications.current_stage`.
 *
 * ── Why this module exists ────────────────────────────────────────────────────
 * HireStack previously had two competing stage stores and no single writer:
 *
 *   • `job_applications.current_stage` — per-job, authoritative for membership,
 *     but in production code it was only ever written ONCE, at enrolment, with
 *     the literal `'Applied'`. `setApplicationStage` was exported and never
 *     called.
 *   • `candidates.current_status` — a single GLOBAL column, so a candidate
 *     shortlisted for Job B showed as "Shortlisted" in Job A too. It was what
 *     `progressionService`, the screening override handler and the final-decision
 *     handler all wrote, and what the dashboard RPC counted.
 *
 * That produced three screens disagreeing about where a person was, and made
 * per-job shortlisting impossible to express.
 *
 * ── The rule now ──────────────────────────────────────────────────────────────
 * `job_applications.current_stage` is the source of truth. `candidates.current_status`
 * survives only as a compatibility mirror for screens that have not yet been
 * migrated, and is refreshed ONLY when the candidate has exactly one
 * application — because for a candidate in several jobs there is no single
 * correct value to mirror, and writing one would be a lie.
 *
 * Every stage write in the codebase goes through {@link setApplicationStage}.
 * If you find yourself writing `current_stage` directly, that is a bug.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 * Every mutation is keyed by `(trigger_type, trigger_id)` in
 * `hiring_progression_events`, which carries a UNIQUE constraint. A double
 * click, a retried queue job and a concurrent worker therefore converge on one
 * event, one timeline row and one stage write.
 */

export type StageWriteTrigger =
  | 'assessment_submission'
  | 'technical_evaluation'
  | 'hr_evaluation'
  | 'screening'
  | 'manual'
  | 'offer';

export interface JobApplicationRecord {
  id: string;
  job_id: string;
  candidate_id: string;
  recruiter_id: string | null;
  current_stage: string;
  source: string;
  applied_at: string;
  updated_at: string;
  shortlisted_at?: string | null;
  shortlisted_by?: string | null;
  shortlist_note?: string | null;
  stage_changed_at?: string | null;
}

export interface StageChangeResult {
  applicationId: string;
  jobId: string;
  candidateId: string;
  /** Stage as it was BEFORE this call, normalized to the canonical vocabulary. */
  fromStage: PipelineStage | StageOutcome;
  /** Stage as it is AFTER this call. */
  toStage: PipelineStage | StageOutcome;
  /** False when the candidate was already at the target stage. */
  changed: boolean;
  /** True when an existing completed event absorbed this call. */
  deduplicated: boolean;
  /** True when the move required an explicit recruiter override (e.g. skipping Screening). */
  usedOverride: boolean;
  /** True when `candidates.current_status` was refreshed. */
  mirroredToCandidate: boolean;
}

export interface SetApplicationStageInput {
  jobId: string;
  candidateId: string;
  recruiterId: string;
  toStage: PipelineStage | StageOutcome;
  triggerType: StageWriteTrigger;
  /**
   * Caller-supplied idempotency key. MUST be stable across retries of the same
   * logical action — e.g. `shortlist:<applicationId>`, `decision:<applicationId>:<stage>`.
   */
  triggerId: string;
  /** Enrol the candidate into the job first if no application row exists. */
  enrollIfMissing?: boolean;
  /**
   * Explicit justification when the transition is a recruiter-only override
   * (e.g. shortlisting before screening). Stored on the timeline row so the
   * override is never silent.
   */
  overrideReason?: string;
  /** Extra, non-secret context recorded on the timeline row. */
  metadata?: Record<string, unknown>;
  /**
   * Skip transition-matrix validation. Reserved for backfills/migrations only —
   * a runtime caller that sets this can move a candidate anywhere.
   */
  force?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ownership
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert the recruiter owns the job AND the candidate.
 *
 * Returns 404 rather than 403 on purpose: a 403 would confirm the id exists,
 * turning this endpoint into an existence oracle for other recruiters' data.
 */
export async function requireOwnedJobAndCandidate(
  recruiterId: string,
  jobId: string,
  candidateId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const [{ data: job }, { data: candidate }] = await Promise.all([
    supabase.from('jobs').select('id').eq('id', jobId).eq('recruiter_id', recruiterId).maybeSingle(),
    supabase
      .from('candidates')
      .select('id')
      .eq('id', candidateId)
      .eq('recruiter_id', recruiterId)
      .maybeSingle(),
  ]);
  if (!job) throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);
  if (!candidate) throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
}

/** True when the job exists and belongs to this recruiter. */
export async function recruiterOwnsJob(recruiterId: string, jobId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * True when the candidate has exactly one application across all jobs.
 *
 * This is the ONLY condition under which `candidates.current_status` may be
 * written. With two or more applications there is no single correct value for a
 * global column, so the mirror is deliberately skipped rather than being set to
 * an arbitrary one of the candidate's real stages.
 */
export async function hasSingleApplication(candidateId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('job_applications')
    .select('id', { count: 'exact', head: true })
    .eq('candidate_id', candidateId);
  return count === 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getApplicationRecord(
  jobId: string,
  candidateId: string,
): Promise<JobApplicationRecord | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('job_id', jobId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load application: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return (data as JobApplicationRecord | null) ?? null;
}

/**
 * Canonical stage for a candidate in a job, normalized to the current
 * vocabulary so a row the 20261009 migration skipped still reads correctly.
 */
export async function getApplicationStage(
  jobId: string,
  candidateId: string,
): Promise<PipelineStage | StageOutcome | null> {
  const app = await getApplicationRecord(jobId, candidateId);
  if (!app) return null;
  return normalizeStage(app.current_stage);
}

/** Every application a candidate has, newest first. */
export async function listCandidateApplications(
  candidateId: string,
): Promise<JobApplicationRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('applied_at', { ascending: false });
  if (error) {
    throw new AppError(`Failed to load applications: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return (data as JobApplicationRecord[]) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Move a candidate to a new stage on ONE job application.
 *
 * Steps, in order:
 *   1. Ownership: job + candidate must belong to the recruiter.
 *   2. Membership: the application must exist (or be created if `enrollIfMissing`).
 *   3. Idempotency: claim `(triggerType, triggerId)` in `hiring_progression_events`.
 *      A completed claim short-circuits every remaining step.
 *   4. Validate: `isValidTransition(current_stage → toStage)`.
 *   5. Persist: `job_applications.current_stage` (+ shortlist audit fields).
 *   6. Audit: `candidate_status_log` timeline row, attributed to job + recruiter.
 *   7. Mirror: `candidates.current_status`, single-application candidates only.
 *
 * Throws `AppError(409)` for an illegal transition so callers can surface a
 * precise reason. Throws `AppError(404)` for an unknown job/candidate so the
 * endpoint cannot be used to probe other tenants.
 */
export async function setApplicationStage(
  input: SetApplicationStageInput,
): Promise<StageChangeResult> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  await requireOwnedJobAndCandidate(input.recruiterId, input.jobId, input.candidateId);

  let application = await getApplicationRecord(input.jobId, input.candidateId);

  // Membership is the authority. A candidate who is not in the job cannot be
  // shortlisted for it, no matter what screening says.
  if (!application) {
    if (!input.enrollIfMissing) {
      throw new AppError('Candidate is not in this job', 404, ErrorCodes.NOT_FOUND);
    }
    application = await enrollApplication({
      jobId: input.jobId,
      candidateId: input.candidateId,
      recruiterId: input.recruiterId,
      source: 'shortlist',
    });
  }

  const applicationId = application.id;
  const fromStage = normalizeStage(application.current_stage) ?? 'Applied';

  // Already there: a no-op for the stage, but the global mirror may still be
  // stale (a pre-migration row, or an interrupted write). Repair it rather than
  // leaving two disagreeing records, and still claim the event so a double click
  // is visibly a duplicate.
  if (fromStage === input.toStage) {
    const { created } = await claimEvent({
      application,
      fromStage,
      toStage: input.toStage,
      triggerType: input.triggerType,
      triggerId: input.triggerId,
      input,
    });
    return {
      applicationId,
      jobId: input.jobId,
      candidateId: input.candidateId,
      fromStage,
      toStage: input.toStage,
      changed: false,
      deduplicated: !created,
      usedOverride: false,
      mirroredToCandidate: await mirrorCandidateStatus(input.candidateId, input.toStage),
    };
  }

  let usedOverride = false;
  if (!input.force) {
    const check = isValidTransition(fromStage, input.toStage);
    if (!check.valid) {
      throw new AppError(check.reason || 'Invalid stage transition', 409, ErrorCodes.CONFLICT, {
        from: fromStage,
        to: input.toStage,
      });
    }
    if (check.recruiterOnly) usedOverride = true;
  }

  const { event, created } = await claimEvent({
    application,
    fromStage,
    toStage: input.toStage,
    triggerType: input.triggerType,
    triggerId: input.triggerId,
    input,
  });

  if (!created && event.status === 'completed') {
    logger.info('[application] duplicate stage change suppressed', {
      applicationId,
      triggerType: input.triggerType,
      triggerId: input.triggerId,
    });
    return {
      applicationId,
      jobId: input.jobId,
      candidateId: input.candidateId,
      fromStage,
      toStage: input.toStage,
      changed: false,
      deduplicated: true,
      usedOverride,
      mirroredToCandidate: false,
    };
  }

  const patch: Record<string, unknown> = {
    current_stage: input.toStage,
    updated_at: now,
    stage_changed_at: now,
    recruiter_id: input.recruiterId,
  };

  // Shortlist is the one stage whose actor/timestamp are first-class.
  if (input.toStage === 'Shortlisted') {
    patch.shortlisted_at = now;
    patch.shortlisted_by = input.recruiterId;
    patch.shortlist_note = (input.overrideReason || '').slice(0, 2000);
  } else if (input.toStage !== 'Applied') {
    // Any move off Shortlisted clears the attribution of the SHORTLIST event
    // but keeps the row itself for audit — the columns are not nulled.
    patch.shortlist_note = application.shortlist_note ?? '';
  }

  // Conditional on the stage we observed. If a concurrent writer already moved
  // the candidate, zero rows come back and we surface that rather than clobbering.
  const { data: updated, error: updateError } = await supabase
    .from('job_applications')
    .update(patch)
    .eq('id', applicationId)
    .eq('current_stage', application.current_stage)
    .select('*')
    .maybeSingle();

  if (updateError) {
    await markEvent(event.id, 'failed', updateError.message.slice(0, 500));
    throw new AppError(`Failed to update stage: ${updateError.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  if (!updated) {
    // Lost a race. The other writer's event will be its own; ours is skipped so
    // a retry of OUR trigger does not fire a second time.
    await markEvent(event.id, 'skipped', 'stage moved concurrently');
    throw new AppError(
      'This candidate was moved by another action a moment ago. Refresh to see the current stage.',
      409,
      ErrorCodes.CONFLICT,
    );
  }

  try {
    await appendStageTimeline({
      candidateId: input.candidateId,
      jobId: input.jobId,
      recruiterId: input.recruiterId,
      fromStage,
      toStage: input.toStage,
      triggerType: input.triggerType,
      triggerId: input.triggerId,
      applicationId,
      usedOverride,
      overrideReason: input.overrideReason,
      metadata: input.metadata,
    });

    const mirroredToCandidate = await mirrorCandidateStatus(input.candidateId, input.toStage);

    await markEvent(event.id, 'completed');

    return {
      applicationId,
      jobId: input.jobId,
      candidateId: input.candidateId,
      fromStage,
      toStage: input.toStage,
      changed: true,
      deduplicated: false,
      usedOverride,
      mirroredToCandidate,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markEvent(event.id, 'failed', message.slice(0, 500));
    throw err;
  }
}

/**
 * Record a recruiter outcome (Hold / Rejected / Withdrawn) against one job
 * application. Shares the idempotency and audit machinery of
 * {@link setApplicationStage} but is a distinct entry point because outcomes
 * carry a reason and do not advance a pipeline rank.
 */
export async function setApplicationOutcome(input: {
  jobId: string;
  candidateId: string;
  recruiterId: string;
  outcome: Extract<StageOutcome, 'Rejected' | 'Withdrawn' | 'Hold'>;
  reason?: string;
  triggerType?: StageWriteTrigger;
  triggerId: string;
  metadata?: Record<string, unknown>;
}): Promise<StageChangeResult> {
  return setApplicationStage({
    jobId: input.jobId,
    candidateId: input.candidateId,
    recruiterId: input.recruiterId,
    toStage: input.outcome,
    triggerType: input.triggerType ?? 'manual',
    triggerId: input.triggerId,
    overrideReason: input.reason,
    metadata: input.metadata,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert the idempotency claim. Returns the existing event on a repeat call so
 * the caller can decide whether to short-circuit.
 */
async function claimEvent(input: {
  application: JobApplicationRecord;
  fromStage: PipelineStage | StageOutcome;
  toStage: PipelineStage | StageOutcome;
  triggerType: StageWriteTrigger;
  triggerId: string;
  input: SetApplicationStageInput;
}): Promise<{ event: { id: string; status: string; to_stage: string }; created: boolean }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('hiring_progression_events')
    .insert({
      candidate_id: input.application.candidate_id,
      job_id: input.application.job_id,
      from_stage: input.fromStage,
      to_stage: input.toStage,
      trigger_type: input.triggerType,
      trigger_id: input.triggerId,
      status: 'pending',
    })
    .select('*')
    .maybeSingle();

  if (!error && data) {
    return { event: data as { id: string; status: string; to_stage: string }, created: true };
  }

  // Either a genuine duplicate claim, or a concurrent race that won first.
  const { data: existing } = await supabase
    .from('hiring_progression_events')
    .select('id, status, to_stage')
    .eq('trigger_type', input.triggerType)
    .eq('trigger_id', input.triggerId)
    .maybeSingle();

  if (existing) {
    return { event: existing as { id: string; status: string; to_stage: string }, created: false };
  }

  throw new AppError(
    `Failed to record stage change: ${error?.message ?? 'unknown error'}`,
    500,
    ErrorCodes.DATABASE_ERROR,
  );
}

async function markEvent(
  eventId: string,
  status: 'pending' | 'completed' | 'failed' | 'skipped',
  error = '',
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error: updateError } = await supabase
    .from('hiring_progression_events')
    .update({ status, error, updated_at: new Date().toISOString() })
    .eq('id', eventId);
  if (updateError) {
    logger.warn('[application] could not update progression event status', {
      eventId,
      status,
      error: updateError.message,
    });
  }
}

/**
 * Append to the immutable hiring timeline. Errors are surfaced rather than
 * swallowed: a stage change whose audit row vanished is worse than one that
 * failed loudly.
 */
async function appendStageTimeline(input: {
  candidateId: string;
  jobId: string;
  recruiterId: string;
  fromStage: PipelineStage | StageOutcome;
  toStage: PipelineStage | StageOutcome;
  triggerType: StageWriteTrigger;
  triggerId: string;
  applicationId: string;
  usedOverride: boolean;
  overrideReason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('candidate_status_log').insert({
    candidate_id: input.candidateId,
    status: input.toStage,
    details: {
      action: 'application_stage_changed',
      from: input.fromStage,
      to: input.toStage,
      application_id: input.applicationId,
      trigger: input.triggerType,
      trigger_id: input.triggerId,
      by: input.recruiterId,
      at: new Date().toISOString(),
      ...(input.usedOverride ? { recruiter_override: true } : {}),
      ...(input.overrideReason ? { override_reason: input.overrideReason.slice(0, 2000) } : {}),
      ...(input.metadata || {}),
    },
    job_id: input.jobId,
    recruiter_id: input.recruiterId,
  });
  if (error) {
    throw new AppError(`Failed to append candidate timeline: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
}

/**
 * Refresh the `candidates.current_status` compatibility mirror.
 *
 * Skipped (and reported) when the candidate has more than one application,
 * because a global column cannot honestly represent "Shortlisted for Job B but
 * in Assessment for Job C".
 */
async function mirrorCandidateStatus(
  candidateId: string,
  status: PipelineStage | StageOutcome,
): Promise<boolean> {
  const single = await hasSingleApplication(candidateId);
  if (!single) {
    logger.info('[application] skipped candidates.current_status mirror (multiple applications)', {
      candidateId,
      status,
    });
    return false;
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('candidates')
    .update({ current_status: status })
    .eq('id', candidateId);
  if (error) {
    // A mirror failure must never fail the real transition.
    logger.warn('[application] candidates.current_status mirror failed', {
      candidateId,
      status,
      error: error.message,
    });
    return false;
  }
  return true;
}

/** Idempotent enrolment, used by `setApplicationStage(enrollIfMissing)`. */
export async function enrollApplication(input: {
  jobId: string;
  candidateId: string;
  recruiterId: string;
  source: string;
}): Promise<JobApplicationRecord> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('job_applications')
    .upsert(
      {
        job_id: input.jobId,
        candidate_id: input.candidateId,
        recruiter_id: input.recruiterId,
        current_stage: 'Applied',
        source: input.source,
        applied_at: now,
        updated_at: now,
        stage_changed_at: now,
      },
      { onConflict: 'job_id,candidate_id', ignoreDuplicates: true },
    )
    .select('*')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to enrol candidate: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  if (data) return data as JobApplicationRecord;

  // ignoreDuplicates returns nothing when the pair already existed.
  const existing = await getApplicationRecord(input.jobId, input.candidateId);
  if (existing) return existing;
  throw new AppError('Failed to enrol candidate', 500, ErrorCodes.DATABASE_ERROR);
}

/** True when the target stage is one of the parking outcomes. */
export function isOutcomeStage(stage: string): boolean {
  return isStageOutcome(stage);
}