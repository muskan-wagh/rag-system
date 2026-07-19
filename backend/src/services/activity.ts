import { getSupabaseClient } from './supabase/client';
import { logger } from '@/utils/logger';

export type ActionType =
  | 'resume_uploaded'
  | 'resume_processed'
  | 'search_executed'
  | 'candidate_viewed'
  | 'candidate_compared'
  | 'status_changed'
  | 'interview_scheduled'
  | 'email_sent'
  | 'offer_generated'
  | 'note_added'
  | 'saved_search_created'
  | 'talent_pool_created'
  | 'candidate_added_to_pool';

export async function logActivity(params: {
  recruiterId: string;
  actionType: ActionType;
  description: string;
  candidateId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('recruiter_activity').insert({
      recruiter_id: params.recruiterId,
      action_type: params.actionType,
      description: params.description,
      candidate_id: params.candidateId || null,
      metadata: params.metadata || {},
    });
    if (error) {
      logger.warn('Failed to log activity', { error: error.message, actionType: params.actionType });
    }
  } catch (err) {
    logger.warn('Failed to log activity (exception)', { err });
  }
}

export interface ActivityEntry {
  id: string;
  action_type: ActionType;
  description: string;
  candidate_id: string | null;
  candidate_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function listActivity(params: {
  recruiterId: string;
  limit?: number;
  offset?: number;
  actionType?: string;
  search?: string;
}): Promise<{ entries: ActivityEntry[]; total: number }> {
  const supabase = getSupabaseClient();
  const { recruiterId, limit = 20, offset = 0, actionType, search } = params;

  let countQuery: any = supabase
    .from('recruiter_activity')
    .select('id', { count: 'exact', head: true })
    .eq('recruiter_id', recruiterId);

  let dataQuery: any = supabase
    .from('recruiter_activity')
    .select('id, action_type, description, candidate_id, metadata, created_at')
    .eq('recruiter_id', recruiterId);

  if (actionType) {
    countQuery = countQuery.eq('action_type', actionType);
    dataQuery = dataQuery.eq('action_type', actionType);
  }

  if (search) {
    const term = `%${search}%`;
    countQuery = countQuery.ilike('description', term);
    dataQuery = dataQuery.ilike('description', term);
  }

  dataQuery = dataQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

  if (dataResult.error) {
    logger.warn('Failed to list activity', { error: dataResult.error.message });
    return { entries: [], total: 0 };
  }

  const entries = (dataResult.data || []) as Array<{
    id: string;
    action_type: string;
    description: string;
    candidate_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;

  const candidateIds = entries.map((e) => e.candidate_id).filter(Boolean) as string[];
  const nameMap = new Map<string, string>();

  if (candidateIds.length > 0) {
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, full_name')
      .in('id', candidateIds);
    if (candidates) {
      for (const c of candidates as Array<{ id: string; full_name: string | null }>) {
        nameMap.set(c.id, c.full_name || 'Unknown');
      }
    }
  }

  return {
    entries: entries.map((e) => ({
      id: e.id,
      action_type: e.action_type as ActionType,
      description: e.description,
      candidate_id: e.candidate_id,
      candidate_name: e.candidate_id ? nameMap.get(e.candidate_id) || null : null,
      metadata: e.metadata as Record<string, unknown>,
      created_at: e.created_at,
    })),
    total: countResult.count || 0,
  };
}
