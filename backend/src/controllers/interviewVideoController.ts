import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import {
  isLivekitConfigured,
  mintLivekitToken,
} from '@/services/livekit/service';

/**
 * LiveKit video/audio layer (video ONLY — coding/WS untouched).
 * - Candidate auth: existing HttpOnly session (req.candidate), scoped to
 *   its OWN interview invite. A session can never mint a token for another
 *   candidate's room (room derives from the session's interview).
 * - Recruiter auth: existing Clerk + candidate-ownership check.
 * - Secrets never leave the server: only the short-lived participant JWT
 *   (+ public URL + room metadata) is returned. No secrets in the DB.
 * - Statuses: video allowed only for scheduled/joined/in_progress.
 *   cancelled/completed/no_show (and expired/revoked invites) are rejected.
 */

const VIDEO_ALLOWED_STATUSES = ['scheduled', 'joined', 'in_progress'];

function assertVideoAllowed(status: string): void {
  if (!VIDEO_ALLOWED_STATUSES.includes(status)) {
    throw new AppError(`Video is not available for ${status} interviews`, 410, ErrorCodes.NOT_FOUND);
  }
}

async function requireOwnedInterviewRow(recruiterId: string, interviewId: string) {
  const supabase = getSupabaseClient();
  const { data: interview } = await supabase.from('interviews').select('id, candidate_id, status, interviewer_name').eq('id', interviewId).maybeSingle();
  if (!interview) throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  const row = interview as { id: string; candidate_id: string; status: string; interviewer_name?: string };
  const { data: cand } = await supabase.from('candidates').select('recruiter_id').eq('id', row.candidate_id).maybeSingle();
  if (!cand || (cand as { recruiter_id: string }).recruiter_id !== recruiterId) {
    throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  }
  return row;
}

interface CandidateVideoContext {
  interviewId: string;
  candidateId: string;
  status: string;
  candidateName: string;
}

async function resolveCandidateVideoContext(req: Request): Promise<CandidateVideoContext> {
  const ctx = req.candidate;
  if (!ctx || ctx.scope !== 'interview' || !ctx.interviewInviteId) {
    throw new AppError('No interview session', 401, ErrorCodes.NOT_FOUND);
  }
  const supabase = getSupabaseClient();
  const { data: invite } = await supabase
    .from('interview_invites')
    .select('id, interview_id, candidate_id, status, expires_at')
    .eq('id', ctx.interviewInviteId)
    .maybeSingle();
  if (!invite) throw new AppError('Invite not found', 404, ErrorCodes.NOT_FOUND);
  const inv = invite as { interview_id: string; candidate_id: string; status: string; expires_at: string | null };
  if (inv.candidate_id !== ctx.candidateId) throw new AppError('Forbidden', 403, ErrorCodes.NOT_FOUND);
  if (inv.status === 'revoked') throw new AppError('Invitation revoked', 410, ErrorCodes.NOT_FOUND);
  if (inv.expires_at && new Date(inv.expires_at).getTime() <= Date.now()) {
    throw new AppError('Invitation expired', 410, ErrorCodes.NOT_FOUND);
  }
  const { data: interview } = await supabase.from('interviews').select('id, status').eq('id', inv.interview_id).maybeSingle();
  if (!interview) throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  const status = String((interview as { status: string }).status);
  assertVideoAllowed(status);
  const { data: cand } = await supabase.from('candidates').select('full_name').eq('id', inv.candidate_id).maybeSingle();
  return {
    interviewId: inv.interview_id,
    candidateId: inv.candidate_id,
    status,
    candidateName: String((cand as { full_name?: string } | null)?.full_name || 'Candidate'),
  };
}

/** Best-effort audit stamp (tolerates pre-migration DBs — never blocks video). */
async function stampVideoStart(interviewId: string, room: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('interviews').select('video_started_at').eq('id', interviewId).maybeSingle();
    if (!data) return;
    const row = data as { video_started_at?: string | null };
    if ('video_started_at' in row && !row.video_started_at) {
      await supabase
        .from('interviews')
        .update({ video_room: room, video_started_at: new Date().toISOString() })
        .eq('id', interviewId);
    }
  } catch { /* audit only — video still works */ }
}

/** Best-effort end stamp used by the interview end path. */
export async function stampVideoEnd(interviewId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('interviews').update({ video_ended_at: new Date().toISOString() }).eq('id', interviewId);
  } catch { /* audit only */ }
}

// POST /candidate/interview/livekit-token — candidate video token.
export const postCandidateLivekitTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const vctx = await resolveCandidateVideoContext(req);
  if (!isLivekitConfigured()) {
    res.json({ success: true, data: { videoEnabled: false } });
    return;
  }
  const minted = await mintLivekitToken({
    interviewId: vctx.interviewId,
    role: 'candidate',
    subjectId: vctx.candidateId,
    displayName: vctx.candidateName,
  });
  await stampVideoStart(vctx.interviewId, minted.room);
  res.json({
    success: true,
    data: {
      videoEnabled: true,
      token: minted.token,
      url: minted.url,
      room: minted.room,
      identity: minted.identity,
      expiresIn: minted.expiresIn,
    },
  });
});

const VIDEO_SIGNAL_TYPES = ['camera_disabled', 'mic_disabled', 'camera_enabled', 'mic_enabled'] as const;

// POST /candidate/interview/video-event { type } — observable a/v signal only.
// Camera/mic-off is recorded as a neutral fact; NEVER a cheating verdict.
export const postCandidateVideoEventHandler = asyncHandler(async (req: Request, res: Response) => {
  const vctx = await resolveCandidateVideoContext(req);
  const type = String(req.body?.type || '');
  if (!(VIDEO_SIGNAL_TYPES as readonly string[]).includes(type)) {
    throw new AppError('Invalid video event type', 400, ErrorCodes.VALIDATION_ERROR);
  }
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('interviews').select('video_signals').eq('id', vctx.interviewId).maybeSingle();
    const current = Array.isArray((data as { video_signals?: unknown } | null)?.video_signals)
      ? ((data as { video_signals: Array<Record<string, unknown>> }).video_signals)
      : [];
    const next = [...current, { type, at: new Date().toISOString() }].slice(-100);
    await supabase.from('interviews').update({ video_signals: next }).eq('id', vctx.interviewId);
  } catch { /* signal loss is acceptable; video unaffected */ }
  res.json({ success: true, data: { logged: true } });
});

// POST /interviews/:interviewId/livekit-token — interviewer video token.
export const postRecruiterLivekitTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  const row = await requireOwnedInterviewRow(recruiter.id, interviewId);
  assertVideoAllowed(row.status);
  if (!isLivekitConfigured()) {
    res.json({ success: true, data: { videoEnabled: false } });
    return;
  }
  const minted = await mintLivekitToken({
    interviewId,
    role: 'interviewer',
    subjectId: recruiter.id,
    displayName: String(row.interviewer_name || 'Interviewer'),
  });
  await stampVideoStart(interviewId, minted.room);
  res.json({
    success: true,
    data: {
      videoEnabled: true,
      token: minted.token,
      url: minted.url,
      room: minted.room,
      identity: minted.identity,
      expiresIn: minted.expiresIn,
    },
  });
});
