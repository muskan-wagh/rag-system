import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { parseJD } from '@/services/llm/parseJD';
import { searchCandidates } from '@/services/qdrant/searchCandidates';
import { rankCandidates } from '@/services/ranking/finalRanker';
import { compareCandidates } from '@/services/llm/compareCandidates';
import { Candidate } from '@/types';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';

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

  const jd = await parseJD(jdText);

  const queryText = [
    `Job: ${jd.title}`,
    `Skills: ${jd.skills.join(', ')}`,
    `Experience: ${jd.experience.min}-${jd.experience.max} years`,
    `Education: ${jd.education.level} in ${jd.education.field}`,
    `Requirements: ${jd.requirements.join(', ')}`,
  ].join('. ');

  const rawResults = await searchCandidates(queryText, limit, filters);

  if (rawResults.length === 0) {
    res.status(200).json({
      success: true,
      data: { results: [], query: jd },
    });
    return;
  }

  const candidates: Candidate[] = rawResults.map((r) => r.candidate);

  const rankedResults = await rankCandidates(candidates, jd);

  logger.info('Sending search response', { resultCount: rankedResults.length });
  res.status(200).json({
    success: true,
    data: { results: rankedResults, query: jd },
  });
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

  const queryText = [
    `Job: ${jd.title}`,
    `Skills: ${jd.skills.join(', ')}`,
    `Experience: ${jd.experience.min}-${jd.experience.max} years`,
    `Education: ${jd.education.level} in ${jd.education.field}`,
  ].join('. ');

  const rawResults = await searchCandidates(queryText, candidateIds.length, {
    skills: jd.skills,
  });

  const candidateMap = new Map(rawResults.map((r) => [r.candidate.id, r.candidate]));
  const candidates: Candidate[] = [];

  for (const id of candidateIds) {
    const candidate = candidateMap.get(id);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  if (candidates.length < 2) {
    throw new AppError('Could not find all specified candidates', 404);
  }

  const comparisonText = await compareCandidates(candidates, jd);

  res.status(200).json({
    success: true,
    data: { comparison: comparisonText, query: jd },
  });
});
