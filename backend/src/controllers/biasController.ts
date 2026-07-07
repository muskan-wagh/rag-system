import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { scanBias } from '@/services/llm/jdBias';
import { logger } from '@/utils/logger';

export const scanBiasHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText } = req.body;

  if (!jdText || typeof jdText !== 'string' || jdText.trim().length === 0) {
    res.status(400).json({ success: false, error: 'jdText is required and must be a non-empty string' });
    return;
  }

  logger.info('Bias scan request', { textLength: jdText.length });

  const result = await scanBias(jdText);

  res.status(200).json({ success: true, data: result });
});
