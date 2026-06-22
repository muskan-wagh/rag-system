import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { parseJD } from '@/services/llm/parseJD';
import { logger } from '@/utils/logger';

export const parseJdHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText } = req.body;

  if (!jdText || typeof jdText !== 'string' || jdText.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'jdText is required and must be a non-empty string',
    });
    return;
  }

  logger.info('Parse JD request received', { textLength: jdText.length });

  const parsed = await parseJD(jdText);

  res.status(200).json({
    success: true,
    data: { parsed },
  });
});
