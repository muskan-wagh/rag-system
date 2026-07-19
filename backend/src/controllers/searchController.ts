import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import {
  listSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
} from '@/services/search/savedSearches';
import {
  listTalentPools,
  createTalentPool,
  getTalentPool,
  updateTalentPool,
  deleteTalentPool,
  getPoolCandidates,
  addCandidateToPool,
  removeCandidateFromPool,
} from '@/services/search/talentPools';
import {
  listSearchHistory,
} from '@/services/search/searchHistory';
import { logActivity } from '@/services/activity';

function requireRecruiter(req: Request): string {
  const id = req.recruiter?.id;
  if (!id) throw new AppError('Unauthorized', 401, ErrorCodes.VALIDATION_ERROR);
  return id;
}

export const listSavedSearchesHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  const searches = await listSavedSearches(recruiterId);
  res.status(200).json({ success: true, data: searches });
});

export const createSavedSearchHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  const { name, jdText, filters } = req.body;
  if (!name || !jdText) {
    throw new AppError('Name and jdText are required', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const search = await createSavedSearch(recruiterId, name, jdText, filters);
  logActivity({
    recruiterId,
    actionType: 'saved_search_created',
    description: `Saved search created: ${name}`,
  });
  res.status(201).json({ success: true, data: search });
});

export const updateSavedSearchHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  const id = req.params.id as string;
  const { name, is_favorite } = req.body;
  const search = await updateSavedSearch(id, recruiterId, { name, is_favorite });
  res.status(200).json({ success: true, data: search });
});

export const deleteSavedSearchHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  await deleteSavedSearch(req.params.id as string, recruiterId);
  res.status(200).json({ success: true, data: { message: 'Saved search deleted' } });
});

export const listTalentPoolsHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  const pools = await listTalentPools(recruiterId);
  res.status(200).json({ success: true, data: pools });
});

export const createTalentPoolHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  const { name, savedSearchId } = req.body;
  if (!name) {
    throw new AppError('Name is required', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const pool = await createTalentPool(recruiterId, name, savedSearchId);
  logActivity({
    recruiterId,
    actionType: 'talent_pool_created',
    description: `Talent pool created: ${name}`,
  });
  res.status(201).json({ success: true, data: pool });
});

export const getTalentPoolHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  const pool = await getTalentPool(req.params.id as string, recruiterId);
  if (!pool) throw new AppError('Talent pool not found', 404, ErrorCodes.NOT_FOUND);
  const candidates = await getPoolCandidates(pool.id);
  const scores = candidates.map((c) => c.match_score).filter((s) => s > 0);
  const today = new Date().toISOString().split('T')[0];
  res.status(200).json({
    success: true,
    data: {
      ...pool,
      candidate_count: candidates.length,
      new_count: candidates.filter((c) => c.added_at?.startsWith(today)).length,
      average_score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      highest_score: scores.length > 0 ? Math.max(...scores) : 0,
      candidates,
    },
  });
});

export const updateTalentPoolHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  const { name, savedSearchId } = req.body;
  const pool = await updateTalentPool(req.params.id as string, recruiterId, { name, saved_search_id: savedSearchId });
  res.status(200).json({ success: true, data: pool });
});

export const deleteTalentPoolHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  await deleteTalentPool(req.params.id as string, recruiterId);
  res.status(200).json({ success: true, data: { message: 'Talent pool deleted' } });
});

export const addCandidateToPoolHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { candidateId, matchScore } = req.body;
  if (!candidateId) {
    throw new AppError('candidateId is required', 400, ErrorCodes.VALIDATION_ERROR);
  }
  await addCandidateToPool(id, candidateId, matchScore || 0);
  logActivity({
    recruiterId: requireRecruiter(req),
    actionType: 'candidate_added_to_pool',
    description: `Candidate added to talent pool`,
    candidateId,
  });
  res.status(200).json({ success: true, data: { message: 'Candidate added to pool' } });
});

export const removeCandidateFromPoolHandler = asyncHandler(async (req: Request, res: Response) => {
  await removeCandidateFromPool(req.params.id as string, req.params.candidateId as string);
  res.status(200).json({ success: true, data: { message: 'Candidate removed from pool' } });
});

export const listSearchHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = requireRecruiter(req);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const result = await listSearchHistory(recruiterId, limit, offset);
  res.status(200).json({
    success: true,
    data: {
      entries: result.entries,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    },
  });
});
