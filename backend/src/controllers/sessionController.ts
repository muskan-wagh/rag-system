import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { createUploadSession, getSession, getCandidatesBySession } from '@/services/supabase/database';
import { logger } from '@/utils/logger';

export const generateLinkHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText } = req.body;

  if (!jdText || typeof jdText !== 'string' || jdText.trim().length === 0) {
    res.status(400).json({ success: false, error: 'jdText is required and must be a non-empty string' });
    return;
  }

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

  if (!id) {
    res.status(400).json({ success: false, error: 'Session ID is required' });
    return;
  }

  const session = await getSession(id);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  const candidates = await getCandidatesBySession(id);

  res.status(200).json({
    success: true,
    data: {
      session,
      candidates,
      candidateCount: candidates.length,
    },
  });
});
