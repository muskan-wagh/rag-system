import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { generateInviteToken, hashInviteToken, encryptInviteToken } from '@/services/assessments/inviteCrypto';
import { createCandidateSession, sessionCookieHeader } from '@/services/hiring/candidateSession';
import { enqueueProgressionJob } from '@/services/queue/progressionQueue';

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
