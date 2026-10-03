import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '@/services/supabase/client';
import { hashInviteToken, isWindowExpired } from '@/services/assessments/inviteCrypto';
import { verifyCandidateSession, parseCookies } from '@/services/hiring/candidateSession';
import { logger } from '@/utils/logger';

export interface CandidateRequestContext {
  candidateId: string;
  inviteId?: string | null;
  interviewInviteId?: string | null;
  scope: 'assessment' | 'interview';
  assessmentId?: string | null;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      candidate?: CandidateRequestContext;
    }
  }
}

/**
 * Candidate session auth (correction #9).
 * Authenticates via HttpOnly `hs_candidate` session cookie issued at
 * token exchange. Never trusts body-provided candidate/attempt IDs —
 * handlers MUST scope every query by req.candidate.candidateId.
 */
export async function candidateAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.hs_candidate || '';
    if (!token) {
      res.status(401).json({ success: false, error: 'Candidate session required' });
      return;
    }
    const session = await verifyCandidateSession(token);
    if (!session) {
      res.status(401).json({ success: false, error: 'Invalid or expired candidate session' });
      return;
    }

    let assessmentId: string | null = null;
    if (session.scope === 'assessment' && session.invite_id) {
      const supabase = getSupabaseClient();
      const { data: invite } = await supabase
        .from('assessment_invites')
        .select('assessment_id, status, available_until')
        .eq('id', session.invite_id)
        .maybeSingle();
      if (!invite || (invite as { status: string }).status === 'revoked') {
        res.status(401).json({ success: false, error: 'Invitation revoked' });
        return;
      }
      if (isWindowExpired((invite as { available_until: string | null }).available_until)) {
        res.status(410).json({ success: false, error: 'Invitation window expired' });
        return;
      }
      assessmentId = (invite as { assessment_id: string }).assessment_id;
    }

    req.candidate = {
      candidateId: session.candidate_id,
      inviteId: session.invite_id,
      interviewInviteId: session.interview_invite_id,
      scope: session.scope,
      assessmentId,
      sessionId: session.id,
    };
    next();
  } catch (err) {
    logger.warn('[candidateAuth] failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(401).json({ success: false, error: 'Candidate authentication failed' });
  }
}

/** Resolve an attempt ONLY if it belongs to the authed candidate (+ assessment when scoped). */
export async function requireOwnedAttempt(candidateId: string, attemptId: string, assessmentId?: string | null) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('assessment_attempts').select('*').eq('id', attemptId).maybeSingle();
  if (error) throw new Error(`Failed to load attempt: ${error.message}`);
  if (!data) {
    const e = new Error('Attempt not found') as Error & { statusCode?: number };
    e.statusCode = 404;
    throw e;
  }
  const row = data as { candidate_id: string; assessment_id: string };
  if (row.candidate_id !== candidateId) {
    const e = new Error('Attempt does not belong to this candidate') as Error & { statusCode?: number };
    e.statusCode = 403;
    throw e;
  }
  if (assessmentId && row.assessment_id !== assessmentId) {
    const e = new Error('Attempt does not belong to this assessment') as Error & { statusCode?: number };
    e.statusCode = 403;
    throw e;
  }
  return data as Record<string, unknown> & { id: string; assessment_id: string; candidate_id: string; status: string };
}

/** Look up an assessment invite by raw token hash (used ONLY at exchange time). */
export async function lookupInviteByToken(token: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessment_invites')
    .select('id, assessment_id, candidate_id, recruiter_id, status, available_from, available_until')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle();
  if (error) throw new Error(`Invite lookup failed: ${error.message}`);
  return data as null | {
    id: string;
    assessment_id: string;
    candidate_id: string;
    recruiter_id: string;
    status: string;
    available_from: string | null;
    available_until: string | null;
  };
}
