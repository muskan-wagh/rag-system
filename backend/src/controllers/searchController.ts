import crypto from 'crypto';
import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { parseJD } from '@/services/llm/parseJD';
import { generateEmbedding } from '@/services/embedding';
import { searchByEmbedding } from '@/services/qdrant/searchCandidates';
import { retrieveCandidatesByIds } from '@/services/qdrant/retrieveCandidates';
import { rankCandidates } from '@/services/ranking/finalRanker';
import { generateExplanations } from '@/services/llm/explainability';
import { getCached, setCache } from '@/utils/cache';
import { getSupabaseClient } from '@/services/supabase/client';
import { Candidate } from '@/types';
import { logger } from '@/utils/logger';

export const searchCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText, limit = 20, filters } = req.body;

  if (!jdText || typeof jdText !== 'string') {
    res.status(400).json({ success: false, error: 'jdText is required and must be a string' });
    return;
  }

  logger.info('Search candidates request', { textLength: jdText.length, limit });

  const cacheKey = `search:${crypto.createHash('md5').update(jdText).digest('hex')}:${limit}:${JSON.stringify(filters ?? {})}`;
  const cached = getCached<{ results: import('@/types').RankingResult[]; query: import('@/types').ParsedJD; explanations?: Record<string, unknown> }>(cacheKey);
  if (cached) {
    logger.info('Returning cached search results', { resultCount: cached.results.length });
    res.status(200).json({ success: true, data: cached });
    return;
  }

  const [jd, embedding] = await Promise.all([
    parseJD(jdText),
    generateEmbedding(jdText),
  ]);

  const rawResults = await searchByEmbedding(embedding, 100, filters);

  if (rawResults.length === 0) {
    const data = { results: [], query: jd };
    setCache(cacheKey, data, 300000);
    res.status(200).json({ success: true, data });
    return;
  }

  const semanticScores = new Map<string, number>();
  const candidates: Candidate[] = rawResults.map((r) => {
    semanticScores.set(r.candidate.id, r.score);
    return r.candidate;
  });

  const rankedResults = await rankCandidates(candidates, jd, semanticScores);

  let explanations = {};
  try {
    const top5 = rankedResults.slice(0, 5).map((r) => ({
      id: r.candidate.id,
      name: r.candidate.name,
      skills: r.candidate.skills,
      experience: r.candidate.experience,
      summary: r.candidate.summary,
    }));
    explanations = await generateExplanations(jdText, top5);
  } catch (error) {
    logger.warn('Failed to generate explanations', { error });
  }

  try {
    const supabase = getSupabaseClient();
    await supabase.from('search_sessions').insert({
      job_description_text: jdText.slice(0, 500),
    });
  } catch {
    // non-critical
  }

  const data = { results: rankedResults, query: jd, explanations };
  setCache(cacheKey, data, 300000);

  logger.info('Sending search response', { resultCount: rankedResults.length, explanations: Object.keys(explanations).length > 0 });
  res.status(200).json({ success: true, data });
});
