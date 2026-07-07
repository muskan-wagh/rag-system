import crypto from 'crypto';
import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { parseJD } from '@/services/llm/parseJD';
import { generateEmbedding } from '@/services/embedding';
import { searchByEmbedding } from '@/services/qdrant/searchCandidates';
import { retrieveCandidateById, retrieveCandidatesByIds } from '@/services/qdrant/retrieveCandidates';
import { rankCandidates } from '@/services/ranking/finalRanker';
import { compareCandidates } from '@/services/llm/compareCandidates';
import { generateScreeningQuestions } from '@/services/llm/screeningQuestions';
import { generateClosingStrategy } from '@/services/llm/closingStrategy';
import { getSupabaseClient } from '@/services/supabase/client';
import { updateCandidateStatus, addCandidateNote, getCandidateNotes } from '@/services/supabase/database';
import { Candidate } from '@/types';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { getCached, setCache } from '@/utils/cache';

export const searchCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText, limit = 20, filters } = req.body;

  if (!jdText || typeof jdText !== 'string') {
    res.status(400).json({ success: false, error: 'jdText is required and must be a string' });
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

  const semanticScores = new Map<string, number>();
  const candidates: Candidate[] = rawResults.map((r) => {
    semanticScores.set(r.candidate.id, r.score);
    return r.candidate;
  });

  const rankedResults = await rankCandidates(candidates, jd, semanticScores);

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

export const screeningQuestionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (!id) {
    res.status(400).json({ success: false, error: 'Candidate ID is required' });
    return;
  }

  logger.info('Generate screening questions', { candidateId: id });

  const candidate = await retrieveCandidateById(id);
  if (!candidate) {
    res.status(404).json({ success: false, error: 'Candidate not found' });
    return;
  }

  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase
    .from('candidates')
    .select('raw_resume_text, upload_session_id')
    .eq('id', id)
    .single();

  let jdText = '';
  if (sessionData?.upload_session_id) {
    const { data: sess } = await supabase
      .from('upload_sessions')
      .select('job_description_text')
      .eq('id', sessionData.upload_session_id)
      .single();
    jdText = sess?.job_description_text || '';
  }

  const resumeText = sessionData?.raw_resume_text || candidate.summary || '';

  const result = await generateScreeningQuestions(jdText, resumeText);

  res.status(200).json({ success: true, data: result });
});

export const closingStrategyHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (!id) {
    res.status(400).json({ success: false, error: 'Candidate ID is required' });
    return;
  }

  logger.info('Generate closing strategy', { candidateId: id });

  const candidate = await retrieveCandidateById(id);
  if (!candidate) {
    res.status(404).json({ success: false, error: 'Candidate not found' });
    return;
  }

  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase
    .from('candidates')
    .select('raw_resume_text, upload_session_id')
    .eq('id', id)
    .single();

  let jdText = '';
  if (sessionData?.upload_session_id) {
    const { data: sess } = await supabase
      .from('upload_sessions')
      .select('job_description_text')
      .eq('id', sessionData.upload_session_id)
      .single();
    jdText = sess?.job_description_text || '';
  }

  const resumeText = sessionData?.raw_resume_text || candidate.summary || '';

  const result = await generateClosingStrategy(jdText, resumeText);

  res.status(200).json({ success: true, data: result });
});

export const compareCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText, candidateIds } = req.body;

  if (!jdText || typeof jdText !== 'string') {
    res.status(400).json({ success: false, error: 'jdText is required and must be a string' });
    return;
  }

  if (!Array.isArray(candidateIds) || candidateIds.length < 2) {
    res.status(400).json({ success: false, error: 'candidateIds must be an array with at least 2 IDs' });
    return;
  }

  logger.info('Compare candidates request', { candidateIds });

  const jd = await parseJD(jdText);

  const candidates = await retrieveCandidatesByIds(candidateIds);

  if (candidates.length < 2) {
    throw new AppError('Could not find all specified candidates', 404);
  }

  const comparisonText = await compareCandidates(candidates, jd);

  res.status(200).json({ success: true, data: { comparison: comparisonText, query: jd } });
});

export const updateCandidateStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  if (!id) {
    res.status(400).json({ success: false, error: 'Candidate ID is required' });
    return;
  }

  const validStatuses = ['Applied', 'Screening', 'Technical Interview', 'HR Interview', 'Offer', 'Hired', 'Rejected'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  logger.info('Update candidate status', { candidateId: id, status });

  await updateCandidateStatus(id, status);

  res.status(200).json({ success: true, data: { message: `Candidate status updated to ${status}` } });
});

export const addCandidateNoteHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { noteText } = req.body;

  if (!id) {
    res.status(400).json({ success: false, error: 'Candidate ID is required' });
    return;
  }

  if (!noteText || typeof noteText !== 'string' || noteText.trim().length === 0) {
    res.status(400).json({ success: false, error: 'noteText is required and must be a non-empty string' });
    return;
  }

  logger.info('Add candidate note', { candidateId: id });

  await addCandidateNote(id, noteText.trim());

  res.status(200).json({ success: true, data: { message: 'Note added' } });
});

export const getCandidateNotesHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (!id) {
    res.status(400).json({ success: false, error: 'Candidate ID is required' });
    return;
  }

  logger.info('Get candidate notes', { candidateId: id });

  const notes = await getCandidateNotes(id);

  res.status(200).json({ success: true, data: notes });
});

export const getSimilarCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (!id) {
    res.status(400).json({ success: false, error: 'Candidate ID is required' });
    return;
  }

  logger.info('Get similar candidates', { candidateId: id });

  const candidate = await retrieveCandidateById(id);
  if (!candidate) {
    res.status(404).json({ success: false, error: 'Candidate not found' });
    return;
  }

  const embeddingText = `${candidate.name} Skills: ${candidate.skills.join(', ')}`;
  const embedding = await generateEmbedding(embeddingText);

  const similar = await searchByEmbedding(embedding, 10, {});
  const filtered = similar.filter((r) => r.candidate.id !== id);

  res.status(200).json({ success: true, data: filtered.slice(0, 5).map((r) => r.candidate) });
});
