import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { generateInviteToken, hashInviteToken, encryptInviteToken, decryptInviteToken } from '@/services/assessments/inviteCrypto';
import { createCandidateSession, sessionCookieHeader } from '@/services/hiring/candidateSession';
import { enqueueProgressionJob } from '@/services/queue/progressionQueue';
import { enqueueEmail } from '@/services/queue/emailQueue';
import { logEmail } from '@/services/supabase/database';
import { buildTechnicalInterviewEmail, technicalInterviewSubject, technicalInterviewEmailKey } from '@/services/email/technicalInvite';
import { broadcast } from '@/services/websocket';
import { stampVideoEnd } from '@/controllers/interviewVideoController';

/**
 * Human-led Technical + Managerial/HR interviews (correction #10, #14).
 * - No AI interviewer. Provider-agnostic model: session + schedule +
 *   waiting room state + meeting_link + shared Monaco + execution +
 *   evaluation. Video stays external (meeting_link).
 * - Private notes NEVER leave recruiter-scoped endpoints.
 */

async function requireOwnedCandidate(recruiterId: string, candidateId: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('candidates').select('id, recruiter_id').eq('id', candidateId).maybeSingle();
  if (!data || (data as { recruiter_id: string }).recruiter_id !== recruiterId) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }
}

// GET /candidates/:candidateId/interview-stage — recruiter view (full, incl. private notes).
export const getInterviewStageHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const candidateId = String((req.params as Record<string, unknown>).candidateId || (req.params as Record<string, unknown>).id || "");
  await requireOwnedCandidate(recruiter.id, candidateId);
  const supabase = getSupabaseClient();
  const { data: interviews } = await supabase
    .from('interviews')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });
  const ids = ((interviews || []) as Array<{ id: string }>).map((i) => i.id);
  let invites: unknown[] = [];
  let evaluations: unknown[] = [];
  if (ids.length > 0) {
    const { data: inv } = await supabase.from('interview_invites').select('*').in('interview_id', ids);
    invites = (inv || []) as unknown[];
    const { data: ev } = await supabase.from('interview_evaluations').select('*').in('interview_id', ids);
    evaluations = (ev || []) as unknown[];
  }
  res.json({ success: true, data: { interviews: interviews || [], invites, evaluations } });
});

// POST /candidates/:candidateId/interview-stage/schedule { stage, interviewerName, ... }
export const scheduleStageInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const candidateId = String((req.params as Record<string, unknown>).candidateId || (req.params as Record<string, unknown>).id || "");
  await requireOwnedCandidate(recruiter.id, candidateId);
  const { interviewerName, scheduledDate, scheduledTime, meetingLink } = req.body || {};
  const stage = String(req.body?.stage || 'Technical Interview');
  if (!['Technical Interview', 'Managerial/HR'].includes(stage)) {
    throw new AppError('Invalid stage', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const supabase = getSupabaseClient();
  const { data: interview, error } = await supabase
    .from('interviews')
    .insert({
      candidate_id: candidateId,
      scheduled_date: String(scheduledDate || new Date().toISOString().slice(0, 10)),
      scheduled_time: String(scheduledTime || '10:00'),
      interview_type: 'google_meet',
      interviewer_name: String(interviewerName || ''),
      notes: `${stage} — scheduled by recruiter`,
      meeting_link: String(meetingLink || ''),
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (error || !interview) throw new AppError(`Schedule failed: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  const interviewId = (interview as { id: string }).id;

  const token = generateInviteToken();
  await supabase.from('interview_invites').insert({
    interview_id: interviewId,
    candidate_id: candidateId,
    recruiter_id: recruiter.id,
    stage,
    token_hash: hashInviteToken(token),
    token_encrypted: encryptInviteToken(token),
    status: 'sent',
  });

  // Candidate-safe link (raw token never stored).
  const base = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const path = stage === 'Managerial/HR' ? 'hr-interview/join' : 'interview/join';
  res.json({ success: true, data: { interviewId, inviteLink: `${base}/${path}/${token}` } });
});

// POST /interviews/:interviewId/evaluation — human evaluation, then progression job.
export const submitEvaluationHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || "");
  const {
    technicalKnowledge,
    problemSolving,
    communication,
    codeQuality,
    overallRecommendation,
    summary,
    privateNotes,
    interviewerName,
  } = req.body || {};
  const supabase = getSupabaseClient();
  const { data: interview } = await supabase.from('interviews').select('id, candidate_id').eq('id', interviewId).maybeSingle();
  if (!interview) throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  const candidateId = (interview as { candidate_id: string }).candidate_id;
  await requireOwnedCandidate(recruiter.id, candidateId);

  const { data: invite } = await supabase.from('interview_invites').select('stage').eq('interview_id', interviewId).maybeSingle();
  const stage = String((invite as { stage?: string } | null)?.stage || 'Technical Interview');
  const fromStage = stage === 'Managerial/HR' ? 'Managerial/HR' : 'Technical Interview';

  // Idempotent per interview (UNIQUE interview_id).
  await supabase.from('interview_evaluations').upsert(
    {
      interview_id: interviewId,
      candidate_id: candidateId,
      recruiter_id: recruiter.id,
      interviewer_name: String(interviewerName || ''),
      technical_knowledge: technicalKnowledge ?? null,
      problem_solving: problemSolving ?? null,
      communication: communication ?? null,
      code_quality: codeQuality ?? null,
      overall_recommendation: String(overallRecommendation || 'hold'),
      summary: String(summary || ''),
      private_notes: String(privateNotes || ''),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'interview_id' },
  );
  await supabase.from('interviews').update({ status: 'completed' }).eq('id', interviewId);

  // Progression: Technical eval -> HR; HR eval -> Offer/Hold/Reject (correction #10).
  const { data: assessment } = await supabase.from('assessments').select('job_id').limit(1);
  void assessment;
  const { data: cand } = await supabase.from('candidates').select('id').eq('id', candidateId).maybeSingle();
  void cand;
  // Job linkage: prefer assessment job via latest attempt, else null.
  const { data: attempt } = await supabase
    .from('assessment_attempts')
    .select('assessment_id')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let jobId: string | null = null;
  if (attempt) {
    const { data: a } = await supabase
      .from('assessments')
      .select('job_id')
      .eq('id', (attempt as { assessment_id: string }).assessment_id)
      .maybeSingle();
    jobId = ((a as { job_id?: string | null } | null)?.job_id || null) as string | null;
  }

  const triggerType = fromStage === 'Managerial/HR' ? 'hr_evaluation' : 'technical_evaluation';
  await enqueueProgressionJob({
    candidateId,
    jobId,
    recruiterId: recruiter.id,
    fromStage,
    triggerType,
    triggerId: interviewId,
    recommendation: String(overallRecommendation || 'hold'),
    metadata: { interviewId, stage: fromStage },
  });

  res.json({ success: true, data: { saved: true } });
});

const INTERVIEW_STATUSES = ['scheduled', 'joined', 'in_progress', 'completed', 'cancelled', 'no_show'] as const;
type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['joined', 'in_progress', 'cancelled', 'no_show'],
  joined: ['in_progress', 'completed', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: ['scheduled'],
  no_show: ['scheduled'],
};

async function loadOwnedInterview(recruiterId: string, interviewId: string) {
  const supabase = getSupabaseClient();
  const { data: interview } = await supabase.from('interviews').select('*').eq('id', interviewId).maybeSingle();
  if (!interview) throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  const row = interview as { id: string; candidate_id: string; status: string };
  await requireOwnedCandidate(recruiterId, row.candidate_id);
  const { data: invite } = await supabase
    .from('interview_invites')
    .select('id, stage, status, version, token_encrypted')
    .eq('interview_id', interviewId)
    .maybeSingle();
  return { interview: row as Record<string, unknown> & { id: string; candidate_id: string; status: string }, invite: invite as { id: string; stage: string; status: string; version: number; token_encrypted: string | null } | null };
}

function interviewLinkFor(token: string, stage: string): string {
  const base = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const path = stage === 'Managerial/HR' ? 'hr-interview/join' : 'interview/join';
  return `${base}/${path}/${token}`;
}

// PATCH /interviews/:interviewId/schedule — reschedule (rotate token, bump version, auto email).
export const rescheduleInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  const { scheduledDate, scheduledTime, meetingLink, interviewerName } = (req.body || {}) as Record<string, string>;
  const { interview, invite } = await loadOwnedInterview(recruiter.id, interviewId);
  if (interview.status === 'completed') throw new AppError('Completed interviews cannot be rescheduled', 409, ErrorCodes.VALIDATION_ERROR);
  const supabase = getSupabaseClient();
  const nextVersion = Math.max(1, (invite?.version || 1) + 1);

  await supabase
    .from('interviews')
    .update({
      scheduled_date: scheduledDate ? String(scheduledDate).slice(0, 10) : (interview as Record<string, unknown>).scheduled_date,
      scheduled_time: scheduledTime ? String(scheduledTime).slice(0, 5) : (interview as Record<string, unknown>).scheduled_time,
      meeting_link: meetingLink !== undefined ? String(meetingLink) : (interview as Record<string, unknown>).meeting_link,
      interviewer_name: interviewerName !== undefined ? String(interviewerName) : (interview as Record<string, unknown>).interviewer_name,
      status: 'scheduled',
    })
    .eq('id', interviewId);

  // Rotate the token so the previous link/version can never access the new state.
  const token = generateInviteToken();
  if (invite) {
    await supabase
      .from('interview_invites')
      .update({
        token_hash: hashInviteToken(token),
        token_encrypted: encryptInviteToken(token),
        status: 'sent',
        version: nextVersion,
        last_sent_at: new Date().toISOString(),
        send_count: 1,
      })
      .eq('id', invite.id);
  }
  // Any prior candidate sessions for the old invite are revoked implicitly:
  // exchange looks up by token_hash, so the old link now 404s.

  const stage = invite?.stage || 'Technical Interview';
  const link = interviewLinkFor(token, stage);
  const { data: cand } = await supabase.from('candidates').select('email, full_name').eq('id', interview.candidate_id).maybeSingle();
  const to = ((cand as { email?: string } | null)?.email || '') as string;
  const name = ((cand as { full_name?: string } | null)?.full_name || 'Candidate') as string;
  if (to && stage === 'Technical Interview') {
    const key = technicalInterviewEmailKey(interviewId, 'rescheduled', nextVersion);
    const subject = technicalInterviewSubject('rescheduled');
    const html = buildTechnicalInterviewEmail({
      candidateName: name,
      interviewLink: link,
      interviewerName: (interview as Record<string, unknown>).interviewer_name as string,
      scheduledAt: `${scheduledDate || ''} ${scheduledTime || ''}`.trim() || null,
      meetingLink: (meetingLink as string) || null,
      event: 'rescheduled',
    });
    await enqueueEmail({ to, subject, html, jobId: key });
    try {
      await logEmail(interview.candidate_id, 'technical_interview_invite', subject, html, {
        recruiterId: recruiter.id, provider: 'resend', status: 'queued', idempotencyKey: key,
      });
    } catch { /* 23505 race — safe */ }
  }
  try { broadcast('interview:updated', { interviewId, status: 'scheduled', version: nextVersion }); } catch { /* best-effort */ }
  res.json({ success: true, data: { interviewId, version: nextVersion, inviteLink: link } });
});

// POST /interviews/:interviewId/cancel — cancel + notify.
export const cancelInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  const { interview, invite } = await loadOwnedInterview(recruiter.id, interviewId);
  const supabase = getSupabaseClient();
  await supabase.from('interviews').update({ status: 'cancelled' }).eq('id', interviewId);
  if (invite) await supabase.from('interview_invites').update({ status: 'revoked' }).eq('id', invite.id);
  await supabase.from('interview_coding_sessions').update({ session_state: 'ended' }).eq('interview_id', interviewId);
  // Video audit end stamp — separate best-effort write, never blocks cancellation.
  await stampVideoEnd(interviewId);

  const stage = invite?.stage || 'Technical Interview';
  const { data: cand } = await supabase.from('candidates').select('email, full_name').eq('id', interview.candidate_id).maybeSingle();
  const to = ((cand as { email?: string } | null)?.email || '') as string;
  const name = ((cand as { full_name?: string } | null)?.full_name || 'Candidate') as string;
  if (to && stage === 'Technical Interview') {
    const key = technicalInterviewEmailKey(interviewId, 'cancelled', invite?.version || 1);
    const subject = technicalInterviewSubject('cancelled');
    const html = buildTechnicalInterviewEmail({ candidateName: name, interviewLink: '', event: 'cancelled' });
    await enqueueEmail({ to, subject, html, jobId: key });
    try {
      await logEmail(interview.candidate_id, 'technical_interview_invite', subject, html, {
        recruiterId: recruiter.id, provider: 'resend', status: 'queued', idempotencyKey: key,
      });
    } catch { /* race-safe */ }
  }
  try { broadcast('interview:updated', { interviewId, status: 'cancelled' }); } catch { /* best-effort */ }
  res.json({ success: true, data: { cancelled: true } });
});

// POST /interviews/:interviewId/resend — same-token resend (no version bump).
export const resendInterviewInviteHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  const { interview, invite } = await loadOwnedInterview(recruiter.id, interviewId);
  if (!invite?.token_encrypted) throw new AppError('No invite to resend', 404, ErrorCodes.NOT_FOUND);
  if (interview.status === 'cancelled' || interview.status === 'completed') {
    throw new AppError(`Cannot resend for ${interview.status} interviews`, 409, ErrorCodes.VALIDATION_ERROR);
  }
  let token = '';
  try {
    token = decryptInviteToken(invite.token_encrypted);
  } catch {
    throw new AppError('Invite token unavailable — reschedule instead', 500, ErrorCodes.INTERNAL_ERROR);
  }
  const supabase = getSupabaseClient();
  const stage = invite.stage || 'Technical Interview';
  const link = interviewLinkFor(token, stage);
  await supabase.from('interview_invites').update({ status: 'sent', last_sent_at: new Date().toISOString() }).eq('id', invite.id);
  const { data: cand } = await supabase.from('candidates').select('email, full_name').eq('id', interview.candidate_id).maybeSingle();
  const to = ((cand as { email?: string } | null)?.email || '') as string;
  const name = ((cand as { full_name?: string } | null)?.full_name || 'Candidate') as string;
  if (to && stage === 'Technical Interview') {
    const key = technicalInterviewEmailKey(interviewId, 'scheduled', invite.version || 1);
    const subject = technicalInterviewSubject('scheduled');
    const html = buildTechnicalInterviewEmail({ candidateName: name, interviewLink: link, event: 'scheduled' });
    await enqueueEmail({ to, subject, html, jobId: key });
    try {
      await logEmail(interview.candidate_id, 'technical_interview_invite', subject, html, {
        recruiterId: recruiter.id, provider: 'resend', status: 'queued', idempotencyKey: key,
      });
    } catch { /* race-safe */ }
  }
  res.json({ success: true, data: { resent: true, inviteLink: link } });
});

// PATCH /interviews/:interviewId/status { status } — joined/in_progress/completed/cancelled/no_show.
export const updateInterviewStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  const next = String(req.body?.status || '') as InterviewStatus;
  if (!(INTERVIEW_STATUSES as readonly string[]).includes(next)) {
    throw new AppError('Invalid status', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const { interview } = await loadOwnedInterview(recruiter.id, interviewId);
  const allowed = ALLOWED_TRANSITIONS[interview.status] || [];
  if (!allowed.includes(next)) {
    throw new AppError(`Cannot transition ${interview.status} → ${next}`, 409, ErrorCodes.VALIDATION_ERROR);
  }
  const supabase = getSupabaseClient();
  await supabase.from('interviews').update({ status: next }).eq('id', interviewId);
  if (next === 'completed' || next === 'cancelled') {
    await supabase.from('interview_coding_sessions').update({ session_state: 'ended' }).eq('interview_id', interviewId);
    // Video audit end stamp — separate best-effort write, never blocks transition.
    await stampVideoEnd(interviewId);
  }
  try { broadcast('interview:updated', { interviewId, status: next }); } catch { /* best-effort */ }
  res.json({ success: true, data: { status: next } });
});

// ---------- Candidate side ----------

// POST /candidate/interview/exchange { token } — interview join (session cookie, safe view).
export const exchangeInterviewTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body?.token || '').trim();
  if (!token) throw new AppError('token is required', 400, ErrorCodes.VALIDATION_ERROR);
  const supabase = getSupabaseClient();
  const { data: invite } = await supabase
    .from('interview_invites')
    .select('id, interview_id, candidate_id, stage, status, expires_at')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle();
  if (!invite) throw new AppError('Invalid interview link', 404, ErrorCodes.NOT_FOUND);
  const inv = invite as { id: string; interview_id: string; candidate_id: string; stage: string; status: string; expires_at: string | null };
  if (inv.status === 'revoked') throw new AppError('Invitation revoked', 410, ErrorCodes.NOT_FOUND);
  if (inv.expires_at && new Date(inv.expires_at).getTime() <= Date.now()) {
    throw new AppError('Invitation expired', 410, ErrorCodes.NOT_FOUND);
  }
  const { data: interview } = await supabase.from('interviews').select('*').eq('id', inv.interview_id).maybeSingle();
  if (!interview) throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  const row = interview as Record<string, unknown>;
  if (String(row.status || '') === 'cancelled') throw new AppError('Interview cancelled', 410, ErrorCodes.NOT_FOUND);

  const { token: sessionToken, expiresAt } = await createCandidateSession({
    candidateId: inv.candidate_id,
    interviewInviteId: inv.id,
    scope: 'interview',
  });
  await supabase.from('interview_invites').update({ status: 'opened' }).eq('id', inv.id);

  res.setHeader('Set-Cookie', sessionCookieHeader(sessionToken, expiresAt));
  // SAFE view only: no private_notes, no evaluation, no internal scores.
  res.json({
    success: true,
    data: {
      stage: inv.stage,
      status: row.status,
      scheduled_date: row.scheduled_date,
      scheduled_time: row.scheduled_time,
      interview_type: row.interview_type,
      meeting_link: row.meeting_link,
      interviewer_name: row.interviewer_name ? 'Your interviewer' : null,
    },
  });
});

// GET /candidate/interview — safe status for waiting room (session auth).
export const getCandidateInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.candidate;
  if (!ctx || ctx.scope !== 'interview' || !ctx.interviewInviteId) {
    throw new AppError('No interview session', 401, ErrorCodes.NOT_FOUND);
  }
  const supabase = getSupabaseClient();
  const { data: invite } = await supabase
    .from('interview_invites')
    .select('interview_id, stage, status')
    .eq('id', ctx.interviewInviteId)
    .maybeSingle();
  if (!invite) throw new AppError('Invite not found', 404, ErrorCodes.NOT_FOUND);
  const { data: interview } = await supabase
    .from('interviews')
    .select('status, scheduled_date, scheduled_time, interview_type, meeting_link')
    .eq('id', (invite as { interview_id: string }).interview_id)
    .maybeSingle();
  res.json({
    success: true,
    data: {
      stage: (invite as { stage: string }).stage,
      inviteStatus: (invite as { status: string }).status,
      ...(interview as object),
    },
  });
});
