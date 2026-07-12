import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import {
  createUploadSession,
  getSession,
  getCandidatesBySession,
  getAllSessions,
  getSessionStats,
  CandidateRecord,
  SessionStats,
} from '@/services/supabase/database';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

function computeStats(candidates: CandidateRecord[]): SessionStats {
  const stats: SessionStats = { total: candidates.length, pending: 0, shortlisted: 0, interview: 0, rejected: 0, hired: 0 };
  const interviewStatuses = new Set(['interview', 'screening', 'technical interview', 'hr interview']);
  for (const c of candidates) {
    const s = (c.current_status || 'Pending').toLowerCase();
    if (s === 'pending' || s === 'applied') stats.pending++;
    else if (s === 'shortlisted') stats.shortlisted++;
    else if (interviewStatuses.has(s)) stats.interview++;
    else if (s === 'rejected') stats.rejected++;
    else if (s === 'hired') stats.hired++;
    else stats.pending++;
  }
  return stats;
}

export const generateLinkHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText } = req.body;

  logger.info('Generate link request', { textLength: jdText.length });

  const session = await createUploadSession(jdText);

  res.status(201).json({
    success: true,
    data: {
      sessionId: session.id,
      link: `/upload/${session.id}`,
      createdAt: session.created_at,
    },
  });
});

export const getSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  // Run session lookup and candidates fetch in parallel — they're independent
  const [session, candidates] = await Promise.all([
    getSession(id),
    getCandidatesBySession(id),
  ]);

  if (!session) {
    throw new AppError('Session not found', 404, ErrorCodes.NOT_FOUND);
  }

  // Compute stats from already-fetched candidates — zero additional DB cost
  const stats = computeStats(candidates);

  res.status(200).json({
    success: true,
    data: {
      session,
      candidates,
      candidateCount: candidates.length,
      stats,
    },
  });
});

export const getAllSessionsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const sessions = await getAllSessions();
  res.status(200).json({
    success: true,
    data: sessions,
  });
});

export const getSessionStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  // No need to verify session exists separately — getSessionStats returns zeroed stats for non-existent sessions
  const stats = await getSessionStats(id);
  res.status(200).json({
    success: true,
    data: stats,
  });
});