import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

export interface TalentPool {
  id: string;
  recruiter_id: string;
  saved_search_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TalentPoolWithStats extends TalentPool {
  candidate_count: number;
  new_count: number;
  average_score: number;
  highest_score: number;
}

export interface PoolCandidate {
  id: string;
  pool_id: string;
  candidate_id: string;
  match_score: number;
  added_at: string;
  candidate_name?: string;
  candidate_title?: string;
  candidate_skills?: string[];
}

export async function listTalentPools(recruiterId: string): Promise<TalentPoolWithStats[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('talent_pools')
    .select('*')
    .eq('recruiter_id', recruiterId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to list talent pools', { error: error.message });
    throw new AppError('Failed to list talent pools', 500, ErrorCodes.DATABASE_ERROR);
  }

  const pools = (data || []) as TalentPool[];
  const today = new Date().toISOString().split('T')[0];

  const withStats: TalentPoolWithStats[] = await Promise.all(
    pools.map(async (pool) => {
      const { data: candidates } = await supabase
        .from('talent_pool_candidates')
        .select('match_score, added_at')
        .eq('pool_id', pool.id);

      const list = candidates || [];
      const scores = list.map((c) => c.match_score).filter((s) => s > 0);
      return {
        ...pool,
        candidate_count: list.length,
        new_count: list.filter((c) => c.added_at?.startsWith(today)).length,
        average_score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        highest_score: scores.length > 0 ? Math.max(...scores) : 0,
      };
    }),
  );

  return withStats;
}

export async function createTalentPool(
  recruiterId: string,
  name: string,
  savedSearchId?: string,
): Promise<TalentPool> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('talent_pools')
    .insert({
      recruiter_id: recruiterId,
      name,
      saved_search_id: savedSearchId || null,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create talent pool', { error: error.message });
    throw new AppError('Failed to create talent pool', 500, ErrorCodes.DATABASE_ERROR);
  }
  return data as TalentPool;
}

export async function getTalentPool(id: string, recruiterId: string): Promise<TalentPool | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('talent_pools')
    .select('*')
    .eq('id', id)
    .eq('recruiter_id', recruiterId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to get talent pool', { error: error.message });
    throw new AppError('Failed to get talent pool', 500, ErrorCodes.DATABASE_ERROR);
  }
  return data as TalentPool;
}

export async function updateTalentPool(
  id: string,
  recruiterId: string,
  updates: { name?: string; saved_search_id?: string | null },
): Promise<TalentPool> {
  const supabase = getSupabaseClient();
  const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('talent_pools')
    .update(payload)
    .eq('id', id)
    .eq('recruiter_id', recruiterId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update talent pool', { error: error.message });
    throw new AppError('Failed to update talent pool', 500, ErrorCodes.DATABASE_ERROR);
  }
  return data as TalentPool;
}

export async function deleteTalentPool(id: string, recruiterId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('talent_pools')
    .delete()
    .eq('id', id)
    .eq('recruiter_id', recruiterId);

  if (error) {
    logger.error('Failed to delete talent pool', { error: error.message });
    throw new AppError('Failed to delete talent pool', 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function getPoolCandidates(poolId: string): Promise<PoolCandidate[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('talent_pool_candidates')
    .select('*, candidate: candidates!inner(full_name, current_title)')
    .eq('pool_id', poolId)
    .order('match_score', { ascending: false });

  if (error) {
    logger.error('Failed to get pool candidates', { error: error.message });
    return [];
  }
  return ((data || []) as Array<Record<string, unknown>>).map((row) => {
    const cand = row.candidate as { full_name?: string; current_title?: string } | undefined;
    return {
      id: row.id as string,
      pool_id: row.pool_id as string,
      candidate_id: row.candidate_id as string,
      match_score: (row.match_score as number) || 0,
      added_at: row.added_at as string,
      candidate_name: cand?.full_name || '',
      candidate_title: cand?.current_title || '',
    };
  });
}

export async function addCandidateToPool(
  poolId: string,
  candidateId: string,
  matchScore: number = 0,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('talent_pool_candidates')
    .upsert(
      { pool_id: poolId, candidate_id: candidateId, match_score: matchScore },
      { onConflict: 'pool_id,candidate_id' },
    );

  if (error) {
    logger.error('Failed to add candidate to pool', { error: error.message });
  }
}

export async function removeCandidateFromPool(poolId: string, candidateId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('talent_pool_candidates')
    .delete()
    .eq('pool_id', poolId)
    .eq('candidate_id', candidateId);

  if (error) {
    logger.error('Failed to remove candidate from pool', { error: error.message });
  }
}

export async function refreshTalentPool(
  poolId: string,
  savedSearchId: string,
  recruiterId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const logger = (await import('@/utils/logger')).logger;

  const { data: savedSearch } = await supabase
    .from('saved_searches')
    .select('jd_text, filters')
    .eq('id', savedSearchId)
    .single();

  if (!savedSearch) {
    logger.warn('Cannot refresh pool: saved search not found', { poolId, savedSearchId });
    return;
  }

  const { searchCandidatesHandler } = await import('@/controllers/candidateController');
  logger.info('Talent pool refresh triggered', { poolId, savedSearchId });
}
