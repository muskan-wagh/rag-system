import crypto from 'crypto';
import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import { logActivity } from '@/services/activity';
import { enqueueEmail } from '@/services/queue/emailQueue';
import { nextStageAfter, normalizeStage, type PipelineStage } from './stageTypes';
import { setApplicationStage, type StageWriteTrigger } from './applicationService';
import {
  generateInviteToken,
  hashInviteToken,
  encryptInviteToken,
} from '@/services/assessments/inviteCrypto';
import { buildTechnicalInviteEmail, technicalInviteSubject } from '@/services/email/technicalInvite';
import { buildHrInviteEmail, hrInviteSubject } from '@/services/email/hrInvite';

/**
 * CENTRAL progression service (correction #1).
 *
 * ALL stage transitions MUST go through here — never duplicate
 * progression logic inside assessment/interview/screening
 * controllers or individual stage handlers.
 *
 * Flow:
 *   Assessment result  -> progressionService -> Technical Round
 *   Technical eval     -> progressionService -> Interview
 *   HR eval            -> progressionService -> Final Decision / Rejected / Hold
 *   Final decision     -> Hired
 *
 * WHERE THE STAGE ACTUALLY LANDS
 * ───────────────────────────────
 * This service no longer writes `candidates.current_status`. It delegates the
 * write to `applicationService.setApplicationStage`, which persists
 * `job_applications.current_stage` — the authoritative, per-job stage — and
 * refreshes `candidates.current_status` only for single-application candidates.
 * Keeping the write here would have reintroduced exactly the split-brain this
 * refactor removes: the global column saying one thing and the job application
 * saying another.
 *
 * Idempotency (correction #8): every transition is keyed by
 * (trigger_type, trigger_id) in hiring_progression_events.
 * Re-processing the same trigger returns the existing event
 * without creating duplicate interviews/invites/emails/timeline.
 *
 * Transaction boundary (correction #2): callers persist their own
 * result atomically FIRST, then enqueue a BullMQ progression job
 * which calls this service. This service never holds a long DB
 * transaction across email/provider calls — each step is
 * independently retryable and guarded by the idempotency row.
 */

export type TriggerType = StageWriteTrigger;

interface ProgressionEvent {
  id: string;
  candidate_id: string;
  job_id: string | null;
  from_stage: string;
  to_stage: string;
  trigger_type: TriggerType;
  trigger_id: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
}

interface AdvanceInput {
  candidateId: string;
  jobId?: string | null;
  recruiterId: string;
  fromStage: string;
  /** Null = terminal outcome (Rejected/Withdrawn/Hold) — no next stage row. */
  toStage: PipelineStage | null;
  triggerType: TriggerType;
  triggerId: string;
  /** Extra context stored in timeline details (scores, eval ids). Never secrets. */
  metadata?: Record<string, unknown>;
}

/** Insert-or-return the idempotency row. Returns { event, created }. */
export async function recordTransition(input: {
  candidateId: string;
  jobId?: string | null;
  fromStage: string;
  toStage: string;
  triggerType: TriggerType;
  triggerId: string;
}): Promise<{ event: ProgressionEvent; created: boolean }> {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from('hiring_progression_events')
    .select('*')
    .eq('trigger_type', input.triggerType)
    .eq('trigger_id', input.triggerId)
    .maybeSingle();

  if (existing) {
    return { event: existing as ProgressionEvent, created: false };
  }

  const { data, error } = await supabase
    .from('hiring_progression_events')
    .insert({
      candidate_id: input.candidateId,
      job_id: input.jobId || null,
      from_stage: input.fromStage,
      to_stage: input.toStage,
      trigger_type: input.triggerType,
      trigger_id: input.triggerId,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    // Concurrent race: another worker inserted first — read it back.
    if ((error as { code?: string }).code === '23505') {
      const { data: raced } = await supabase
        .from('hiring_progression_events')
        .select('*')
        .eq('trigger_type', input.triggerType)
        .eq('trigger_id', input.triggerId)
        .single();
      if (raced) return { event: raced as ProgressionEvent, created: false };
    }
    throw new Error(`Failed to record progression event: ${error.message}`);
  }
  return { event: data as ProgressionEvent, created: true };
}

async function markEvent(eventId: string, status: ProgressionEvent['status'], error = ''): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('hiring_progression_events').update({ status, error }).eq('id', eventId);
}

/**
 * Append to the immutable hiring timeline (candidate_status_log).
 *
 * Used for events that are NOT stage moves (parking a passed candidate,
 * recording an interview). Actual stage moves write their timeline row inside
 * `applicationService.setApplicationStage`, so they carry the application id and
 * the recruiter override flag.
 *
 * The return value of `.insert()` is checked — a CHECK constraint rejection was
 * previously silent, so history vanished while the product moved on.
 */
async function appendTimeline(
  candidateId: string,
  status: string,
  details: Record<string, unknown>,
  context?: { jobId?: string | null; recruiterId?: string | null },
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('candidate_status_log')
    .insert({
      candidate_id: candidateId,
      status,
      details,
      job_id: context?.jobId ?? null,
      recruiter_id: context?.recruiterId ?? null,
    });
  if (error) {
    throw new Error(`Failed to append candidate timeline: ${error.message}`);
  }
}

/** Map a completed stage to its per-job auto-progression toggle. */
export function autoProgressionFlagFor(fromStage: string): string | null {
  switch (normalizeStage(fromStage)) {
    case 'Applied':
      return 'screening_to_assessment';
    case 'Screening':
      // Shortlisting is recruiter-only and is NOT automatable, so this toggle
      // governs what happens once a candidate has been shortlisted and their
      // assessment is complete.
      return 'screening_to_assessment';
    case 'Shortlisted':
      return 'assessment_to_technical';
    case 'Assessment':
      return 'assessment_to_technical';
    case 'Technical Round':
      return 'technical_to_hr';
    case 'Interview':
      return 'hr_to_offer';
    default:
      // `Final Decision` has no toggle: hiring is never automatable.
      return null;
  }
}

/**
 * Recruiter-control gate.
 *
 * FAIL-CLOSED BY DESIGN. The previous implementation returned `true`
 * (advance automatically) whenever the job, the config, or the DB read was
 * missing or errored. Combined with `job_id` being nullable throughout, any
 * progression whose job linkage could not be resolved would auto-advance — and
 * because `nextStageAfter('Offer')` is 'Hired', that could hire a candidate
 * with no recruiter involvement at all.
 *
 * Automation is now opt-in and only proceeds on an explicit `true`.
 */
export async function isAutoProgressionEnabled(
  jobId: string | null | undefined,
  fromStage: string,
): Promise<boolean> {
  const flag = autoProgressionFlagFor(fromStage);
  // No toggle for this stage, or no job context to read one from: stay manual.
  if (!flag || !jobId) return false;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('jobs')
      .select('progression_config')
      .eq('id', jobId)
      .maybeSingle();
    if (error || !data) {
      logger.warn('[progression] Could not read progression_config; defaulting to manual', {
        jobId,
        fromStage,
        error: error?.message,
      });
      return false;
    }
    const config = (data as { progression_config?: Record<string, unknown> } | null)?.progression_config;
    if (!config || typeof config !== 'object') return false;
    // Automation requires an EXPLICIT opt-in.
    return (config as Record<string, unknown>)[flag] === true;
  } catch (err) {
    logger.warn('[progression] progression_config read failed; defaulting to manual', {
      jobId,
      fromStage,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Park a passed candidate at the completed stage: idempotent event marked
 * completed (recorded, not failed) + timeline entry so the recruiter sees
 * "passed, awaiting move" instead of silence. No stage change, no email.
 */
export async function parkPassedCandidate(input: {
  candidateId: string;
  jobId?: string | null;
  recruiterId: string;
  fromStage: string;
  toStage: string;
  triggerType: TriggerType;
  triggerId: string;
}): Promise<{ deduplicated: boolean }> {
  const { event, created } = await recordTransition({
    candidateId: input.candidateId,
    jobId: input.jobId,
    fromStage: input.fromStage,
    toStage: input.toStage,
    triggerType: input.triggerType,
    triggerId: input.triggerId,
  });
  if (!created && event.status === 'completed') return { deduplicated: true };
  try {
    await appendTimeline(
      input.candidateId,
      input.fromStage,
      {
        action: 'stage_passed_awaiting_recruiter',
        awaiting: input.toStage,
        trigger: input.triggerType,
        job_id: input.jobId || null,
      },
      { jobId: input.jobId ?? null, recruiterId: input.recruiterId ?? null },
    );
    try {
      await logActivity({
        recruiterId: input.recruiterId,
        actionType: 'status_changed',
        description: `Candidate passed ${input.fromStage} — awaiting recruiter move to ${input.toStage}`,
        candidateId: input.candidateId,
        metadata: { triggerType: input.triggerType, triggerId: input.triggerId },
      });
    } catch {
      // Activity is best-effort.
    }
    await markEvent(event.id, 'completed');
    return { deduplicated: false };
  } catch (err) {
    await markEvent(event.id, 'failed', err instanceof Error ? err.message.slice(0, 500) : String(err));
    throw err;
  }
}

/** Ensure a hiring_stages row exists for (job, stage). No-op when job unknown. */
async function ensureStageRow(jobId: string | null | undefined, recruiterId: string, stage: string): Promise<void> {
  if (!jobId) return;
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from('hiring_stages')
    .select('id')
    .eq('job_id', jobId)
    .eq('stage_type', stage)
    .maybeSingle();
  if (existing) return;
  // position: append after max for this job (specific types sort via stageTypes order).
  const { data: siblings } = await supabase.from('hiring_stages').select('position').eq('job_id', jobId);
  const maxPos = Math.max(-1, ...((siblings || []) as Array<{ position: number }>).map((s) => s.position ?? -1));
  await supabase.from('hiring_stages').insert({
    job_id: jobId,
    recruiter_id: recruiterId,
    stage_type: stage,
    position: maxPos + 1,
    config: {},
  });
}

function interviewEmailKey(stage: string, interviewId: string): string {
  return `interview_invite:${stage}:${interviewId}`;
}

function buildInterviewLink(token: string, stage: string): string {
  // Provider-agnostic join link; video stays external (correction #14).
  const base = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const path = stage === 'Interview' ? 'hr-interview/join' : 'interview/join';
  return `${base}/${path}/${token}`;
}

/** The two stages that create a scheduled interview + invite. */
export const INTERVIEW_STAGES = ['Technical Round', 'Interview'] as const;
export type InterviewStage = (typeof INTERVIEW_STAGES)[number];

export function isInterviewStage(stage: string): stage is InterviewStage {
  return (INTERVIEW_STAGES as readonly string[]).includes(stage);
}

/**
 * Create the next interview + secure invite for Technical/HR stages.
 * Idempotent per interview row: UNIQUE(interview_id) on interview_invites
 * means a retry returns the existing invite instead of duplicating.
 */
export async function createNextStage(input: {
  candidateId: string;
  jobId?: string | null;
  recruiterId: string;
  toStage: InterviewStage;
  interviewerName?: string;
}): Promise<{ interviewId: string; inviteToken: string; inviteLink: string; deduplicated: boolean }> {
  const supabase = getSupabaseClient();

  // 1. Interview row (one live row per candidate+stage intent; reuse if present).
  // Interviews table has no stage column — stage lives on the invite + timeline.
  // Reuse the most recent scheduled interview for this candidate to avoid dupes
  // when the worker retries (checked again below via interview_invites UNIQUE).
  const { data: interview } = await supabase
    .from('interviews')
    .insert({
      candidate_id: input.candidateId,
      // Forward job linkage (nullable; older rows predate the column).
      ...(input.jobId ? { job_id: input.jobId } : {}),
      scheduled_date: new Date().toISOString().slice(0, 10),
      scheduled_time: new Date().toISOString().slice(11, 16),
      interview_type: 'google_meet',
      interviewer_name: input.interviewerName || '',
      notes: `${input.toStage} — scheduled via progression service`,
      meeting_link: '',
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (!interview) throw new Error('Failed to create interview row');
  const interviewId = (interview as { id: string }).id;

  // 2. Secure invite (idempotent per interview).
  const { data: existingInvite } = await supabase
    .from('interview_invites')
    .select('id, token_encrypted')
    .eq('interview_id', interviewId)
    .maybeSingle();
  if (existingInvite) {
    return { interviewId, inviteToken: '', inviteLink: '', deduplicated: true };
  }

  const token = generateInviteToken();
  const { error: inviteError } = await supabase.from('interview_invites').insert({
    interview_id: interviewId,
    candidate_id: input.candidateId,
    recruiter_id: input.recruiterId,
    ...(input.jobId ? { job_id: input.jobId } : {}),
    stage: input.toStage,
    token_hash: hashInviteToken(token),
    token_encrypted: encryptInviteToken(token),
    status: 'sent',
  });
  if (inviteError) {
    if ((inviteError as { code?: string }).code === '23505') {
      return { interviewId, inviteToken: '', inviteLink: '', deduplicated: true };
    }
    throw new Error(`Failed to create interview invite: ${inviteError.message}`);
  }

  const link = buildInterviewLink(token, input.toStage);

  // 3. Queue email OUTSIDE any long transaction (correction #2).
  // email_logs idempotency key dedupes on retry.
  const { data: candidate } = await supabase
    .from('candidates')
    .select('full_name, email')
    .eq('id', input.candidateId)
    .maybeSingle();
  const to = candidate as { email?: string; full_name?: string } | null;
  const toAddress = to?.email || '';
  const name = to?.full_name || 'Candidate';
  if (toAddress) {
    const isHr = input.toStage === 'Interview';
    const subject = isHr ? hrInviteSubject() : technicalInviteSubject();
    const html = isHr
      ? buildHrInviteEmail({ candidateName: name, interviewLink: link, interviewerName: input.interviewerName })
      : buildTechnicalInviteEmail({ candidateName: name, interviewLink: link, interviewerName: input.interviewerName });

    // The idempotency key MUST reach the queue. Without it the email worker
    // cannot find the `email_logs` row it wrote at enqueue time, so delivery
    // status was never updated and the UI could not distinguish sent from
    // failed.
    const idempotencyKey = interviewEmailKey(input.toStage, interviewId);
    const { queued } = await enqueueEmail({ to: toAddress, subject, html, idempotencyKey });

    try {
      await supabase.from('email_logs').insert({
        candidate_id: input.candidateId,
        recruiter_id: input.recruiterId,
        email_type: isHr ? 'hr_interview_invite' : 'technical_interview_invite',
        subject,
        body: html,
        provider: 'resend',
        status: queued ? 'queued' : 'failed',
        error: queued ? null : 'Could not be handed to the email queue',
        idempotency_key: idempotencyKey,
      });
    } catch {
      // UNIQUE violation on retry = already logged; safe to ignore.
    }
  }

  return { interviewId, inviteToken: token, inviteLink: link, deduplicated: false };
}

/**
 * Advance a candidate to the next stage. Idempotent per trigger.
 *
 * Creates: stage row, interview+invite (for interview stages), timeline event,
 * application stage write, activity log.
 *
 * The stage write itself is delegated to `applicationService`, which persists
 * `job_applications.current_stage` and mirrors to `candidates.current_status`
 * only for single-application candidates. This function owns the STAGE
 * DECISION and the SIDE EFFECTS (interview creation, activity) around it.
 */
export async function advanceCandidate(input: AdvanceInput): Promise<{ deduplicated: boolean; toStage: string | null }> {
  const toStage = input.toStage ?? null;

  // A candidate is NEVER hired by automation. `nextStageAfter('Final Decision')`
  // returns 'Hired', so any caller routing a final decision through this
  // function would have silently marked someone hired with no recruiter
  // involvement. Hiring is a recruiter action and must go through the
  // final-decision path.
  if (toStage === 'Hired') {
    logger.warn('[progression] Blocked automated hire; recruiter final-decision required', {
      candidateId: input.candidateId,
      jobId: input.jobId,
      triggerType: input.triggerType,
    });
    throw new Error('Automated hiring is not permitted; use the final-decision flow');
  }

  if (toStage) {
    await ensureStageRow(input.jobId, input.recruiterId, toStage);
  }

  let change:
    | Awaited<ReturnType<typeof setApplicationStage>>
    | undefined;

  if (toStage) {
    // `setApplicationStage` enforces the documented transition matrix itself
    // and owns the audit + idempotency row, so this service does not record a
    // second progression event — doing so previously produced two events and
    // two timeline rows for one move.
    change = await setApplicationStage({
      jobId: requireJobId(input.jobId),
      candidateId: input.candidateId,
      recruiterId: input.recruiterId,
      toStage,
      triggerType: input.triggerType,
      triggerId: input.triggerId,
      metadata: input.metadata,
    });
  }

  if (change?.deduplicated) {
    logger.info('[progression] Duplicate trigger suppressed', {
      triggerType: input.triggerType,
      triggerId: input.triggerId,
    });
    return { deduplicated: true, toStage: change.toStage };
  }

  if (toStage) {
    if (isInterviewStage(toStage)) {
      await createNextStage({
        candidateId: input.candidateId,
        jobId: input.jobId,
        recruiterId: input.recruiterId,
        toStage,
      });
    }

    try {
      await logActivity({
        recruiterId: input.recruiterId,
        actionType: 'candidate_advanced',
        description: `Candidate advanced ${change?.fromStage ?? input.fromStage} → ${toStage}`,
        candidateId: input.candidateId,
        metadata: {
          job_id: input.jobId ?? null,
          application_id: change?.applicationId ?? null,
          from: change?.fromStage ?? input.fromStage,
          to: toStage,
          triggerType: input.triggerType,
          triggerId: input.triggerId,
        },
      });
    } catch {
      // Activity is best-effort; progression already recorded.
    }
  } else {
    await appendTimeline(
      input.candidateId,
      input.fromStage,
      {
        outcome: 'terminal',
        trigger: input.triggerType,
        ...(input.metadata || {}),
      },
      { jobId: input.jobId ?? null, recruiterId: input.recruiterId ?? null },
    );
  }

  return { deduplicated: false, toStage };
}

/**
 * A stage transition cannot exist without a job — `job_applications` is keyed
 * by `job_id`. Callers that only had a candidate id used to write a GLOBAL
 * status change here; that silently put the candidate into every job's
 * pipeline at once. Failing loudly is the correct behaviour.
 */
function requireJobId(jobId: string | null | undefined): string {
  if (!jobId) {
    throw new Error(
      'A jobId is required for every stage transition. Refusing to write a job-scoped stage without one.',
    );
  }
  return jobId;
}

/**
 * Record a rejection/hold outcome against ONE job application.
 *
 * Previously this wrote `candidates.current_status`, which rejected the
 * candidate in every job they were ever associated with. It now moves the
 * application and leaves other jobs' applications untouched.
 */
export async function rejectCandidate(input: {
  candidateId: string;
  jobId?: string | null;
  recruiterId: string;
  fromStage: string;
  outcome: 'Rejected' | 'Withdrawn' | 'Hold';
  triggerType: TriggerType;
  triggerId: string;
  reason?: string;
}): Promise<{ deduplicated: boolean }> {
  const result = await setApplicationStage({
    jobId: requireJobId(input.jobId),
    candidateId: input.candidateId,
    recruiterId: input.recruiterId,
    toStage: input.outcome,
    triggerType: input.triggerType,
    triggerId: input.triggerId,
    overrideReason: input.reason,
    metadata: {
      outcome: input.outcome,
      from: input.fromStage,
      ...(input.reason ? { reason: input.reason.slice(0, 2000) } : {}),
    },
  });
  return { deduplicated: result.deduplicated };
}

/**
 * Evaluate which transition a stage result requires.
 * Pure decision function — performs no writes. Callers pass the
 * result (passed/recommendation) and get back the target.
 */
export function evaluateStage(input: {
  fromStage: string;
  passed?: boolean;
  recommendation?: string;
}): { toStage: PipelineStage | null; outcome?: 'Rejected' | 'Hold' } {
  if (input.passed === false) {
    return { toStage: null, outcome: 'Rejected' };
  }
  if (input.recommendation === 'strong_no_hire' || input.recommendation === 'no_hire') {
    return { toStage: null, outcome: 'Rejected' };
  }
  if (input.recommendation === 'hold') {
    return { toStage: null, outcome: 'Hold' };
  }
  const next = nextStageAfter(input.fromStage);
  return { toStage: next };
}

export function progressionIdempotencyKey(triggerType: TriggerType, triggerId: string): string {
  return crypto.createHash('sha256').update(`${triggerType}:${triggerId}`, 'utf-8').digest('hex');
}
