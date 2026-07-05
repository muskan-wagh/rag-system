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

export async function insertCandidate(candidate: Omit<CandidateRecord, 'id' | 'created_at'>): Promise<CandidateRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .insert(candidate)
    .select()
    .single();

  if (error) {
    logger.error('Failed to insert candidate', { error: error.message });
    throw new AppError('Failed to insert candidate', 500);
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

  const rows = skills.map((skill) => ({
    candidate_id: candidateId,
    skill_name: skill.toLowerCase().trim(),
  }));

  const { error } = await supabase.from('candidate_skills').insert(rows);

  if (error) {
    logger.error('Failed to insert skills', { error: error.message });
    throw new AppError('Failed to insert skills', 500);
  }
}
