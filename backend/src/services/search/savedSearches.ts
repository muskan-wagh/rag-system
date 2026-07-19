import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { memoryCache } from '@/utils/memory-cache';

export interface SavedSearch {
  id: string;
  recruiter_id: string;
  name: string;
  jd_text: string;
  filters: Record<string, unknown>;
  is_favorite: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listSavedSearches(recruiterId: string): Promise<SavedSearch[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('recruiter_id', recruiterId)
    .order('last_used_at', { ascending: false, nullsFirst: false });

  if (error) {
    logger.error('Failed to list saved searches', { error: error.message });
    throw new AppError('Failed to list saved searches', 500, ErrorCodes.DATABASE_ERROR);
  }
  return (data || []) as SavedSearch[];
}

export async function createSavedSearch(
  recruiterId: string,
  name: string,
  jdText: string,
  filters?: Record<string, unknown>,
): Promise<SavedSearch> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      recruiter_id: recruiterId,
      name,
      jd_text: jdText,
      filters: filters || {},
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create saved search', { error: error.message });
    throw new AppError('Failed to save search', 500, ErrorCodes.DATABASE_ERROR);
  }
  return data as SavedSearch;
}

export async function updateSavedSearch(
  id: string,
  recruiterId: string,
  updates: { name?: string; is_favorite?: boolean },
): Promise<SavedSearch> {
  const supabase = getSupabaseClient();
  const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('saved_searches')
    .update(payload)
    .eq('id', id)
    .eq('recruiter_id', recruiterId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update saved search', { error: error.message });
    throw new AppError('Failed to update saved search', 500, ErrorCodes.DATABASE_ERROR);
  }
  return data as SavedSearch;
}

export async function deleteSavedSearch(id: string, recruiterId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('recruiter_id', recruiterId);

  if (error) {
    logger.error('Failed to delete saved search', { error: error.message });
    throw new AppError('Failed to delete saved search', 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function incrementSavedSearchUsage(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    await supabase.rpc('increment_saved_search_usage', { search_id: id });
  } catch {
    const { data } = await supabase.from('saved_searches').select('usage_count').eq('id', id).single();
    const current = (data as { usage_count?: number })?.usage_count || 0;
    await supabase
      .from('saved_searches')
      .update({ usage_count: current + 1, last_used_at: new Date().toISOString() })
      .eq('id', id);
  }
}

export async function getSavedSearch(id: string, recruiterId: string): Promise<SavedSearch | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('id', id)
    .eq('recruiter_id', recruiterId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to get saved search', { error: error.message });
    throw new AppError('Failed to get saved search', 500, ErrorCodes.DATABASE_ERROR);
  }
  return data as SavedSearch;
}
