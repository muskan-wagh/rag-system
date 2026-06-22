import crypto from 'crypto';
import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { parseJD } from '@/services/llm/parseJD';
import { generateEmbedding } from '@/services/llm/client';
import { searchByEmbedding } from '@/services/qdrant/searchCandidates';
import { retrieveCandidateById, retrieveCandidatesByIds } from '@/services/qdrant/retrieveCandidates';
import { rankCandidates } from '@/services/ranking/finalRanker';
import { compareCandidates } from '@/services/llm/compareCandidates';
import { Candidate } from '@/types';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { getCached, setCache } from '@/utils/cache';

export const searchCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText, limit = 20, filters } = req.body;

  if (!jdText || typeof jdText !== 'string') {
    res.status(400).json({
      success: false,
      error: 'jdText is required and must be a string',
    });
    return;
  }

  logger.info('Search candidates request', { textLength: jdText.length, limit });

  const cacheKey = `search:${crypto.createHash('md5').update(jdText).digest('hex')}:${limit}:${JSON.stringify(filters ?? {})}`;
  const cached = getCached<{ results: import('@/types').RankingResult[]; query: import('@/types').ParsedJD }>(cacheKey);
  if (cached) {
    logger.info('Returning cached search results', { resultCount: cached.results.length });
    res.status(200).json({ success: true, data: cached });
    return;
  }

  const [jd, embedding] = await Promise.all([
    parseJD(jdText),
    generateEmbedding(jdText),
  ]);

  const rawResults = await searchByEmbedding(embedding, limit, filters);

  if (rawResults.length === 0) {
    const data = { results: [], query: jd };
    setCache(cacheKey, data, 300000);
    res.status(200).json({ success: true, data });
    return;
  }

  const candidates: Candidate[] = rawResults.map((r) => r.candidate);

  const rankedResults = await rankCandidates(candidates, jd);

  const data = { results: rankedResults, query: jd };
  setCache(cacheKey, data, 300000);

  logger.info('Sending search response', { resultCount: rankedResults.length });
  res.status(200).json({ success: true, data });
});

export const getCandidateHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (!id) {
    res.status(400).json({ success: false, error: 'Candidate ID is required' });
    return;
  }

  logger.info('Get candidate by ID', { candidateId: id });

  const candidate = await retrieveCandidateById(id);

  if (!candidate) {
    res.status(404).json({ success: false, error: 'Candidate not found' });
    return;
  }

  res.status(200).json({ success: true, data: candidate });
});

export const batchCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, error: 'ids must be a non-empty array' });
    return;
  }

  logger.info('Batch get candidates', { count: ids.length });

  const candidates = await retrieveCandidatesByIds(ids);

  res.status(200).json({ success: true, data: candidates });
});

export const compareCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText, candidateIds } = req.body;

  if (!jdText || typeof jdText !== 'string') {
    res.status(400).json({
      success: false,
      error: 'jdText is required and must be a string',
    });
    return;
  }

  if (!Array.isArray(candidateIds) || candidateIds.length < 2) {
    res.status(400).json({
      success: false,
      error: 'candidateIds must be an array with at least 2 IDs',
    });
    return;
  }

  logger.info('Compare candidates request', { candidateIds });

  const jd = await parseJD(jdText);

  const candidates = await retrieveCandidatesByIds(candidateIds);

  if (candidates.length < 2) {
    throw new AppError('Could not find all specified candidates', 404);
  }

  const comparisonText = await compareCandidates(candidates, jd);

  res.status(200).json({
    success: true,
    data: { comparison: comparisonText, query: jd },
  });
});
