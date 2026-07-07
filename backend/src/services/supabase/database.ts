import { getSupabaseClient } from './client';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

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
  current_title?: string;
  total_experience_years?: number;
  raw_resume_text?: string;
  parsed_json?: Record<string, unknown>;
  flight_risk?: string;
  growth_trajectory?: string;
  processing_status?: string;
  source?: string;
  error_message?: string;
  resume_file_url?: string;
  current_status?: string;
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
    throw new AppError('Failed to create upload session', 500, ErrorCodes.DATABASE_ERROR);
  }

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
    throw new AppError('Failed to get session', 500, ErrorCodes.DATABASE_ERROR);
  }

  return data as UploadSession;
}

export async function createCandidate(candidate: Record<string, unknown>): Promise<CandidateRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .insert(candidate)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to create candidate', 500, ErrorCodes.DATABASE_ERROR);
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
    throw new AppError('Failed to update candidate', 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function getCandidatesBySession(sessionId: string): Promise<CandidateRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .select()
    .eq('upload_session_id', sessionId);

  if (error) {
    throw new AppError('Failed to get candidates', 500, ErrorCodes.DATABASE_ERROR);
  }

  return (data || []) as CandidateRecord[];
}

export async function saveSearchSession(params: {
  jobDescriptionText: string;
  jdHash: string;
  filters?: Record<string, unknown>;
  resultCount: number;
  searchDurationMs?: number;
  userId?: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('search_sessions').insert({
    job_description_text: params.jobDescriptionText,
    jd_hash: params.jdHash,
    filters: params.filters ?? null,
    result_count: params.resultCount,
    search_duration_ms: params.searchDurationMs ?? null,
    user_id: params.userId ?? null,
  });
  if (error) {
    logger.warn('Failed to save search session', { error: error.message });
  }
}

export async function getAllCandidates(limit = 50, offset = 0): Promise<CandidateRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .select()
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new AppError('Failed to get candidates', 500, ErrorCodes.DATABASE_ERROR);
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
    .map((skill) => ({ candidate_id: candidateId, skill_name: skill }));

  if (rows.length === 0) return;

  const { error: deleteError } = await supabase.from('candidate_skills').delete().eq('candidate_id', candidateId);

  if (deleteError) {
    const { error: upsertError } = await supabase
      .from('candidate_skills')
      .upsert(rows, { onConflict: 'candidate_id,skill_name', ignoreDuplicates: false });

    if (upsertError) {
      throw new AppError('Failed to insert skills', 500, ErrorCodes.DATABASE_ERROR);
    }
    return;
  }

  const { error } = await supabase.from('candidate_skills').insert(rows);
  if (error) {
    throw new AppError('Failed to insert skills', 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function insertExperience(
  candidateId: string,
  experience: Array<{ job_title: string; company: string; start_date: string; end_date: string; is_current: boolean }>,
): Promise<void> {
  if (experience.length === 0) return;
  const supabase = getSupabaseClient();

  const rows = experience.map((exp) => ({
    candidate_id: candidateId,
    job_title: exp.job_title,
    company: exp.company,
    start_date: exp.start_date || null,
    end_date: exp.end_date || null,
    is_current: exp.is_current || false,
  }));

  const { error } = await supabase.from('candidate_experience').insert(rows);
  if (error) {
    throw new AppError('Failed to insert experience', 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function updateCandidateStatus(candidateId: string, status: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: logError } = await supabase.from('candidate_status_log').insert({
    candidate_id: candidateId,
    status,
  });
  if (logError) {
    logger.error('Failed to log status change', { error: logError.message });
  }

  const { error } = await supabase
    .from('candidates')
    .update({ current_status: status })
    .eq('id', candidateId);

  if (error) {
    logger.error('Failed to update candidate status', { error: error.message });
  }
}

export async function addCandidateNote(candidateId: string, noteText: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('candidate_notes').insert({
    candidate_id: candidateId,
    note_text: noteText,
  });

  if (error) {
    throw new AppError('Failed to add note', 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function getCandidateNotes(candidateId: string): Promise<Array<{ id: string; note_text: string; created_at: string }>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidate_notes')
    .select('id, note_text, created_at')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('Failed to get notes', 500, ErrorCodes.DATABASE_ERROR);
  }
  return (data || []) as Array<{ id: string; note_text: string; created_at: string }>;
}

export async function getPendingCandidates(): Promise<CandidateRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .select()
    .in('processing_status', ['PENDING', 'FAILED'])
    .limit(100);

  if (error) {
    return [];
  }
  return (data || []) as CandidateRecord[];
}
