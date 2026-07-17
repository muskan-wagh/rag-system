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
import { memoryCache } from '@/utils/memory-cache';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { AGGREGATION_STATUS_GROUPS } from '@/constants/candidateStatus';

function computeStats(candidates: CandidateRecord[]): NewSessionStats {
  const stats: NewSessionStats = { open: 0, applied: 0, screening: 0, interview: 0, interviewsToday: 0, offered: 0, hired: 0, rejected: 0 };
  for (const c of candidates) {
    const s = (c.current_status || '').toLowerCase();
    if (AGGREGATION_STATUS_GROUPS.applied.map(st => st.toLowerCase()).includes(s)) { stats.applied++; stats.open++; }
    else if (AGGREGATION_STATUS_GROUPS.open.map(st => st.toLowerCase()).includes(s)) stats.open++;
    else if (AGGREGATION_STATUS_GROUPS.screening.map(st => st.toLowerCase()).includes(s)) { stats.screening++; stats.open++; }
    else if (AGGREGATION_STATUS_GROUPS.interview.map(st => st.toLowerCase()).includes(s)) { stats.interview++; stats.open++; }
    else if (AGGREGATION_STATUS_GROUPS.offered.map(st => st.toLowerCase()).includes(s)) { stats.offered++; stats.open++; }
    else if (AGGREGATION_STATUS_GROUPS.hired.map(st => st.toLowerCase()).includes(s)) stats.hired++;
    else if (AGGREGATION_STATUS_GROUPS.rejected.map(st => st.toLowerCase()).includes(s)) stats.rejected++;
  }
  return stats;
}

export const generateLinkHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText } = req.body;
  const recruiterId = req.recruiter?.id;

  logger.info('Generate link request', { textLength: jdText.length, recruiterId });

  const session = await createUploadSession(jdText, recruiterId);

  if (recruiterId) {
    memoryCache.delete(`dashboard:recruiter:${recruiterId}`);
  }

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

export const getAllSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id;
  const sessions = await getAllSessions(recruiterId);
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