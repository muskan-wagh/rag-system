import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

export interface SearchHistoryEntry {
  id: string;
  recruiter_id: string;
  jd_text: string;
  filters: Record<string, unknown>;
  result_count: number;
  created_at: string;
}

export async function logSearch(
  recruiterId: string,
  jdText: string,
  filters?: Record<string, unknown>,
  resultCount?: number,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('search_history')
    .insert({
      recruiter_id: recruiterId,
      jd_text: jdText,
      filters: filters || {},
      result_count: resultCount || 0,
    });

  if (error) {
    logger.warn('Failed to log search history', { error: error.message });
  }
}

export async function listSearchHistory(
  recruiterId: string,
  limit = 20,
  offset = 0,
): Promise<{ entries: SearchHistoryEntry[]; total: number }> {
  const supabase = getSupabaseClient();

  const { count } = await supabase
    .from('search_history')
    .select('*', { count: 'exact', head: true })
    .eq('recruiter_id', recruiterId);

  const { data, error } = await supabase
    .from('search_history')
    .select('*')
    .eq('recruiter_id', recruiterId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Failed to list search history', { error: error.message });
    throw new AppError('Failed to list search history', 500, ErrorCodes.DATABASE_ERROR);
  }

  return {
    entries: (data || []) as SearchHistoryEntry[],
    total: count || 0,
  };
}
