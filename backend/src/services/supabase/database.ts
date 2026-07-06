import { getSupabaseClient } from './client';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';

export interface UploadSession {
  id: string;
  job_description_text: string;
  created_at: string;
}

export interface CandidateRecord {
  id: string;
  upload_session_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  current_company?: string;
  total_experience_years?: number;
  raw_resume_text?: string;
  parsed_json?: Record<string, unknown>;
  flight_risk?: string;
  growth_trajectory?: string;
  created_at?: string;
}

export async function createUploadSession(jdText: string): Promise<UploadSession> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('upload_sessions')
    .insert({ job_description_text: jdText })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create upload session', { error: error.message });
    throw new AppError('Failed to create upload session', 500);
  }

  logger.info('Upload session created', { sessionId: data.id });
  return data as UploadSession;
}

export async function getSession(sessionId: string): Promise<UploadSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('upload_sessions')
    .select()
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to get session', { error: error.message });
    throw new AppError('Failed to get session', 500);
  }

  return data as UploadSession;
}

export async function createCandidate(candidate: Omit<CandidateRecord, 'id' | 'created_at'>): Promise<CandidateRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .insert(candidate)
    .select()
    .single();

  if (error) {
    logger.error('Failed to create candidate', { error: error.message });
    throw new AppError('Failed to create candidate', 500);
  }

  return data as CandidateRecord;
}

export async function updateCandidate(id: string, updates: Partial<CandidateRecord>): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('candidates')
    .update(updates)
    .eq('id', id);

  if (error) {
    logger.error('Failed to update candidate', { error: error.message });
    throw new AppError('Failed to update candidate', 500);
  }
}

export async function upsertCandidate(candidate: Omit<CandidateRecord, 'id' | 'created_at'>): Promise<CandidateRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .upsert(candidate, { onConflict: 'email', ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    logger.error('Failed to upsert candidate', { error: error.message });
    throw new AppError('Failed to upsert candidate', 500);
  }

  return data as CandidateRecord;
}

export async function getCandidatesBySession(sessionId: string): Promise<CandidateRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .select()
    .eq('upload_session_id', sessionId);

  if (error) {
    logger.error('Failed to get candidates for session', { error: error.message });
    throw new AppError('Failed to get candidates', 500);
  }

  return (data || []) as CandidateRecord[];
}

export async function insertSkills(candidateId: string, skills: string[]): Promise<void> {
  if (skills.length === 0) return;
  const supabase = getSupabaseClient();

  const seen = new Set<string>();
  const rows = skills
    .map((skill) => skill.toLowerCase().trim())
    .filter((skill) => {
      if (seen.has(skill) || !skill) return false;
      seen.add(skill);
      return true;
    })
    .map((skill) => ({
      candidate_id: candidateId,
      skill_name: skill,
    }));

  if (rows.length === 0) return;

  const { error: deleteError } = await supabase.from('candidate_skills').delete().eq('candidate_id', candidateId);

  if (deleteError) {
    logger.warn('Delete skills blocked by RLS, falling back to upsert', { error: deleteError.message });
    const { error: upsertError } = await supabase
      .from('candidate_skills')
      .upsert(rows, { onConflict: 'candidate_id,skill_name', ignoreDuplicates: false });

    if (upsertError) {
      logger.error('Failed to upsert skills', { error: upsertError.message });
      throw new AppError('Failed to insert skills', 500);
    }
    return;
  }

  const { error } = await supabase.from('candidate_skills').insert(rows);

  if (error) {
    logger.error('Failed to insert skills', { error: error.message });
    throw new AppError('Failed to insert skills', 500);
  }
}
