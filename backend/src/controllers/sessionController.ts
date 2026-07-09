import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import {
  createUploadSession,
  getSession,
  getCandidatesBySession,
  getAllSessions,
  getSessionStats,
} from '@/services/supabase/database';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

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

  const session = await getSession(id);
  if (!session) {
    throw new AppError('Session not found', 404, ErrorCodes.NOT_FOUND);
  }

  const candidates = await getCandidatesBySession(id);
  const stats = await getSessionStats(id);

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

  const session = await getSession(id);
  if (!session) {
    throw new AppError('Session not found', 404, ErrorCodes.NOT_FOUND);
  }

  const stats = await getSessionStats(id);
  res.status(200).json({
    success: true,
    data: stats,
  });
});