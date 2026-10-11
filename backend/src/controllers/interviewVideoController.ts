import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { createLiveKitToken, interviewRoomName, isLiveKitConfigured } from '@/services/livekit/service';
import { verifyCandidateSession, parseCookies } from '@/services/hiring/candidateSession';

/**
 * LiveKit token issuance for technical interviews.
 *
 * Two entry points, each with its own authorization:
 *  - Recruiter: Clerk-authed, must own the interview's candidate.
 *  - Candidate: must present the opaque `hs_candidate` session cookie that is
 *    bound to this exact interview invite.
 *
 * A token is never minted from a client-supplied room or identity — the room
 * is always derived from an authorized interview id.
 */

export const getLiveKitStatusHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { configured: isLiveKitConfigured() },
  });
});

async function loadAuthorizedInterview(interviewId: string, recruiterId: string) {
  const supabase = getSupabaseClient();
  const { data: interview } = await supabase
    .from('interviews')
    .select('id, candidate_id, status')
    .eq('id', interviewId)
    .maybeSingle();
  if (!interview) {
    throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  }
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, recruiter_id, full_name')
    .eq('id', (interview as { candidate_id: string }).candidate_id)
    .maybeSingle();
  if (!candidate || (candidate as { recruiter_id: string }).recruiter_id !== recruiterId) {
    // 404 rather than 403 — no existence leak across recruiters.
    throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  }
  return { interview, candidate };
}

/** POST /interviews/:interviewId/livekit-token (recruiter) */
export const postRecruiterLivekitTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  if (!recruiterId) throw new AppError('Not authenticated', 401, ErrorCodes.UNAUTHORIZED);
  if (!interviewId) throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);

  const { candidate } = await loadAuthorizedInterview(interviewId, recruiterId);

  const { data: recruiter } = await getSupabaseClient()
    .from('recruiters')
    .select('first_name, last_name')
    .eq('id', recruiterId)
    .maybeSingle();
  const interviewerName =
    [String((recruiter as { first_name?: string } | null)?.first_name || ''),
     String((recruiter as { last_name?: string } | null)?.last_name || '')]
      .filter(Boolean)
      .join(' ') || 'Interviewer';

  const result = await createLiveKitToken({
    roomName: interviewRoomName(interviewId),
    participantName: interviewerName,
    participantId: `recruiter:${recruiterId}`,
    canPublish: true,
  });

  res.json({ success: true, data: { ...result, candidateName: (candidate as { full_name?: string }).full_name || '' } });
});

/** POST /candidate/interview/livekit-token (candidate session) */
export const postCandidateLivekitTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const sessionToken =
    (req.headers['x-candidate-session'] as string | undefined) ||
    parseCookies(req.headers.cookie).hs_candidate;
  if (!sessionToken) {
    throw new AppError('Candidate session required', 401, ErrorCodes.UNAUTHORIZED);
  }

  const session = await verifyCandidateSession(sessionToken);
  if (!session || session.scope !== 'interview' || !session.interview_invite_id) {
    throw new AppError('Candidate session required', 401, ErrorCodes.UNAUTHORIZED);
  }

  const supabase = getSupabaseClient();
  const { data: invite } = await supabase
    .from('interview_invites')
    .select('id, interview_id, candidate_id, status')
    .eq('id', session.interview_invite_id)
    .maybeSingle();
  if (!invite) throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  const inv = invite as { interview_id: string; candidate_id: string; status: string };
  if (inv.status === 'revoked') {
    throw new AppError('This interview invitation has been revoked', 403, ErrorCodes.FORBIDDEN);
  }
  // Bind to the session's own candidate — never to a client-supplied id.
  if (inv.candidate_id !== session.candidate_id) {
    throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  }

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, full_name')
    .eq('id', inv.candidate_id)
    .maybeSingle();

  const result = await createLiveKitToken({
    roomName: interviewRoomName(inv.interview_id),
    participantName: (candidate as { full_name?: string } | null)?.full_name || 'Candidate',
    participantId: `candidate:${inv.candidate_id}`,
    // Candidates join as subscribers; the interviewer publishes.
    canPublish: false,
  });

  res.json({ success: true, data: result });
});