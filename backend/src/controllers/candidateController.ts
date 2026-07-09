import crypto from 'crypto';
import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { parseJD } from '@/services/llm/parseJD';
import { generateEmbedding } from '@/services/embedding';
import { searchByEmbedding } from '@/services/qdrant/searchCandidates';
import { retrieveCandidateByIds } from '@/services/qdrant/retrieveCandidates';
import { rankCandidates } from '@/services/ranking/finalRanker';
import { compareCandidates } from '@/services/llm/compareCandidates';
import { generateScreeningQuestions } from '@/services/llm/screeningQuestions';
import { generateClosingStrategy } from '@/services/llm/closingStrategy';
import { getSupabaseClient } from '@/services/supabase/client';
import {
  updateCandidateStatus,
  addCandidateNote,
  getCandidateNotes,
  saveSearchSession,
  getAllCandidatesPaginated,
} from '@/services/supabase/database';
import { Candidate } from '@/types';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { getCached, setCache } from '@/utils/cache';
import { generateExplanations } from '@/services/llm/explainability';
import { broadcast } from '@/services/websocket';

export const searchCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { jdText, limit = 20, filters, explain = false } = req.body;

  const jdHash = crypto.createHash('md5').update(jdText).digest('hex');
  const cacheKey = `search:${jdHash}:${limit}:${JSON.stringify(filters ?? {})}:${explain}`;
  const cached = await getCached<{ results: import('@/types').RankingResult[]; query: import('@/types').ParsedJD; explanations?: Record<string, unknown> }>(cacheKey);
  if (cached) {
    res.status(200).json({ success: true, data: cached });
    return;
  }

  const [jd, embedding] = await Promise.all([
    parseJD(jdText),
    generateEmbedding(jdText),
  ]);

  const actualLimit = limit > 100 ? 100 : limit;
  const rawResults = await searchByEmbedding(embedding, actualLimit, filters);

  const data: { results: import('@/types').RankingResult[]; query: import('@/types').ParsedJD; explanations?: Record<string, unknown> } = {
    results: [],
    query: jd,
  };

  if (rawResults.length > 0) {
    const semanticScores = new Map<string, number>();
    const candidates: Candidate[] = rawResults.map((r) => {
      semanticScores.set(r.candidate.id, r.score);
      return r.candidate;
    });

    data.results = await rankCandidates(candidates, jd, semanticScores);
  }

  if (explain && data.results.length > 0) {
    try {
      const top5 = data.results.slice(0, 5).map((r) => ({
        id: r.candidate.id,
        name: r.candidate.name,
        skills: r.candidate.skills,
        experience: r.candidate.experience,
        summary: r.candidate.summary,
      }));
      data.explanations = await generateExplanations(jdText, top5);
    } catch (error) {
      logger.warn('Failed to generate explanations', { error });
    }
  }

  await setCache(cacheKey, data, 300000);
  res.status(200).json({ success: true, data });

  // Fire-and-forget: save search session
  const searchDurationMs = Date.now() - startTime;
  saveSearchSession({
    jobDescriptionText: jdText,
    jdHash,
    filters: filters as Record<string, unknown> | undefined,
    resultCount: data.results.length,
    searchDurationMs,
    userId: (req as any).userId,
  }).catch(() => {});
});

export const getCandidateHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const candidates = await retrieveCandidateByIds([id]);
  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  res.status(200).json({ success: true, data: candidates[0] });
});

export const batchCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  const candidates = await retrieveCandidateByIds(ids);
  res.status(200).json({ success: true, data: candidates });
});

async function getCandidateJDAndResume(candidateId: string): Promise<{ jdText: string; resumeText: string }> {
  const supabase = getSupabaseClient();
  const { data: candidateData } = await supabase
    .from('candidates')
    .select('raw_resume_text, upload_session_id')
    .eq('id', candidateId)
    .single();

  let jdText = '';
  const resumeText = candidateData?.raw_resume_text || '';

  if (candidateData?.upload_session_id) {
    const { data: sess } = await supabase
      .from('upload_sessions')
      .select('job_description_text')
      .eq('id', candidateData.upload_session_id)
      .single();
    jdText = sess?.job_description_text || '';
  }

  return { jdText, resumeText };
}

export const screeningQuestionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const candidates = await retrieveCandidateByIds([id]);
  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  const { jdText, resumeText } = await getCandidateJDAndResume(id);
  const result = await generateScreeningQuestions(jdText, resumeText);
  res.status(200).json({ success: true, data: result });
});

export const closingStrategyHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const candidates = await retrieveCandidateByIds([id]);
  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  const { jdText, resumeText } = await getCandidateJDAndResume(id);
  const result = await generateClosingStrategy(jdText, resumeText);
  res.status(200).json({ success: true, data: result });
});

export const compareCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText, candidateIds } = req.body;

  const jd = await parseJD(jdText);
  const candidates = await retrieveCandidateByIds(candidateIds);

  if (candidates.length < 2) {
    throw new AppError('Could not find all specified candidates', 404, ErrorCodes.NOT_FOUND);
  }

  const comparisonText = await compareCandidates(candidates, jd);
  res.status(200).json({ success: true, data: { comparison: comparisonText, query: jd } });
});

export const updateCandidateStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  await updateCandidateStatus(id, status);
  broadcast('candidate:status_changed', { candidateId: id, status });
  res.status(200).json({ success: true, data: { message: `Candidate status updated to ${status}` } });
});

export const addCandidateNoteHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { noteText } = req.body;

  await addCandidateNote(id, noteText.trim());
  broadcast('candidate:note_added', { candidateId: id });
  res.status(200).json({ success: true, data: { message: 'Note added' } });
});

export const getCandidateNotesHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const notes = await getCandidateNotes(id);
  res.status(200).json({ success: true, data: notes });
});

export const getSimilarCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const candidates = await retrieveCandidateByIds([id]);
  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  const candidate = candidates[0];
  const embeddingText = `${candidate.name} Skills: ${candidate.skills.join(', ')}`;
  const embedding = await generateEmbedding(embeddingText);

  const similar = await searchByEmbedding(embedding, 10, {});
  const filtered = similar.filter((r) => r.candidate.id !== id);

  res.status(200).json({ success: true, data: filtered.slice(0, 5).map((r) => r.candidate) });
});

export const getAllCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '20',
    search,
    sortBy,
    sortOrder,
    sessionId,
  } = req.query as Record<string, string | undefined>;

  const result = await getAllCandidatesPaginated({
    page: parseInt(page || '1', 10),
    limit: parseInt(limit || '20', 10),
    search,
    sortBy,
    sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
    sessionId,
  });

  res.status(200).json({ success: true, data: result });
});