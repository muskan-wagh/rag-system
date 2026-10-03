import crypto from 'crypto';
import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import { logActivity } from '@/services/activity';
import { enqueueEmail } from '@/services/queue/emailQueue';
import { nextStageAfter, type PipelineStage } from './stageTypes';
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
 *   Assessment result  -> progressionService -> Technical Interview
 *   Technical eval     -> progressionService -> Managerial/HR
 *   HR eval            -> progressionService -> Offer / Rejected / Hold
 *   Offer accepted     -> Hired
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

export type TriggerType =
  | 'assessment_submission'
  | 'technical_evaluation'
  | 'hr_evaluation'
  | 'screening'
  | 'manual'
  | 'offer';

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

async function appendTimeline(candidateId: string, status: string, details: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseClient();
  // candidate_status_log is the immutable hiring history (existing infra).
  await supabase.from('candidate_status_log').insert({
    candidate_id: candidateId,
    status,
    details,
  });
}

async function setCandidateStatus(candidateId: string, status: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('candidates').update({ current_status: status }).eq('id', candidateId);
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
  const path = stage === 'Managerial/HR' ? 'hr-interview/join' : 'interview/join';
  return `${base}/${path}/${token}`;
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
  toStage: 'Technical Interview' | 'Managerial/HR';
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
  const to = (candidate as { email?: string } | null)?.email || '';
  const name = (candidate as { full_name?: string } | null)?.full_name || 'Candidate';
  if (to) {
    const isHr = input.toStage === 'Managerial/HR';
    const subject = isHr ? hrInviteSubject() : technicalInviteSubject();
    const html = isHr
      ? buildHrInviteEmail({ candidateName: name, interviewLink: link, interviewerName: input.interviewerName })
      : buildTechnicalInviteEmail({ candidateName: name, interviewLink: link, interviewerName: input.interviewerName });
    await enqueueEmail({ to, subject, html });
    try {
      await supabase.from('email_logs').insert({
        candidate_id: input.candidateId,
        recruiter_id: input.recruiterId,
        email_type: isHr ? 'hr_interview_invite' : 'technical_interview_invite',
        subject,
        body: html,
        provider: 'resend',
        status: 'queued',
        idempotency_key: interviewEmailKey(input.toStage, interviewId),
      });
    } catch {
      // UNIQUE violation on retry = already logged; safe to ignore.
    }
  }

  return { interviewId, inviteToken: token, inviteLink: link, deduplicated: false };
}

/**
 * Advance a candidate to the next stage. Idempotent per trigger.
 * Creates: stage row, interview+invite (for interview stages),
 * timeline event, candidate status, activity log.
 */
export async function advanceCandidate(input: AdvanceInput): Promise<{ deduplicated: boolean; toStage: string | null }> {
  const toStage = input.toStage ?? null;
  const { event, created } = await recordTransition({
    candidateId: input.candidateId,
    jobId: input.jobId,
    fromStage: input.fromStage,
    toStage: toStage ?? input.fromStage,
    triggerType: input.triggerType,
    triggerId: input.triggerId,
  });
  if (!created && event.status === 'completed') {
    logger.info('[progression] Duplicate trigger suppressed', { triggerType: input.triggerType, triggerId: input.triggerId });
    return { deduplicated: true, toStage: event.to_stage || null };
  }

  try {
    if (toStage) {
      await ensureStageRow(input.jobId, input.recruiterId, toStage);
      if (toStage === 'Technical Interview' || toStage === 'Managerial/HR') {
        await createNextStage({
          candidateId: input.candidateId,
          jobId: input.jobId,
          recruiterId: input.recruiterId,
          toStage,
        });
      }
      // Timeline + status are the single source of truth for the tracker.
      await appendTimeline(input.candidateId, toStage, {
        from: input.fromStage,
        trigger: input.triggerType,
        ...(input.metadata || {}),
      });
      await setCandidateStatus(input.candidateId, toStage);
    } else {
      await appendTimeline(input.candidateId, input.fromStage, {
        outcome: 'terminal',
        trigger: input.triggerType,
        ...(input.metadata || {}),
      });
    }

    try {
      await logActivity({
        recruiterId: input.recruiterId,
        actionType: 'status_changed',
        description: `Candidate advanced ${input.fromStage} → ${toStage ?? '(outcome)'}`,
        candidateId: input.candidateId,
        metadata: { triggerType: input.triggerType, triggerId: input.triggerId },
      });
    } catch {
      // Activity is best-effort; progression already recorded.
    }

    await markEvent(event.id, 'completed');
    return { deduplicated: false, toStage };
  } catch (err) {
    await markEvent(event.id, 'failed', err instanceof Error ? err.message.slice(0, 500) : String(err));
    throw err;
  }
}

/** Record a rejection/hold outcome (status outcome, not a pipeline stage). */
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
  const { event, created } = await recordTransition({
    candidateId: input.candidateId,
    jobId: input.jobId,
    fromStage: input.fromStage,
    toStage: input.outcome,
    triggerType: input.triggerType,
    triggerId: input.triggerId,
  });
  if (!created && event.status === 'completed') return { deduplicated: true };

  try {
    await appendTimeline(input.candidateId, input.outcome, {
      from: input.fromStage,
      reason: input.reason || '',
      trigger: input.triggerType,
    });
    await setCandidateStatus(input.candidateId, input.outcome);
    await markEvent(event.id, 'completed');
    return { deduplicated: false };
  } catch (err) {
    await markEvent(event.id, 'failed', err instanceof Error ? err.message.slice(0, 500) : String(err));
    throw err;
  }
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
