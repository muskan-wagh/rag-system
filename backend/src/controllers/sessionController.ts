import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import {
  createUploadSession,
  getSession,
  getCandidatesBySession,
  getAllSessions,
  getNewSessionStats,
  CandidateRecord,
  NewSessionStats,
} from '@/services/supabase/database';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

function computeStats(candidates: CandidateRecord[]): NewSessionStats {
  const stats: NewSessionStats = { open: 0, applied: 0, screening: 0, interview: 0, interviewsToday: 0, offered: 0, hired: 0, rejected: 0 };
  for (const c of candidates) {
    const s = (c.current_status || '').toLowerCase();
    if (s === 'applied') { stats.applied++; stats.open++; }
    else if (s === 'shortlisted') stats.open++;
    else if (s === 'screening') { stats.screening++; stats.open++; }
    else if (s === 'interview'
      || s === 'interview scheduled'
      || s === 'interview completed'
      || s === 'technical round'
      || s === 'hr round') { stats.interview++; stats.open++; }
    else if (s === 'offer' || s === 'offered') { stats.offered++; stats.open++; }
    else if (s === 'hired') stats.hired++;
    else if (s === 'rejected') stats.rejected++;
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

  const stats = await getNewSessionStats(id);
  res.status(200).json({
    success: true,
    data: stats,
  });
});