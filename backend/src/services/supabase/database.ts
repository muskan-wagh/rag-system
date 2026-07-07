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

export async function createCandidate(candidate: Record<string, unknown>): Promise<CandidateRecord> {
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

export async function getAllCandidates(): Promise<CandidateRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .select()
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to get all candidates', { error: error.message });
    throw new AppError('Failed to get candidates', 500);
  }

  return (data || []) as CandidateRecord[];
}

export async function insertParsedCandidate(
  candidateId: string,
  parsed: {
    full_name?: string;
    email?: string;
    phone?: string;
    location?: string;
    current_company?: string;
    total_experience_years?: number;
    skills: string[];
    work_history?: Array<{ title: string; company: string }>;
    parsed_json: Record<string, unknown>;
    flight_risk?: string;
    growth_trajectory?: string;
    source: string;
    resume_file_url: string;
    cleanText: string;
  },
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: updateError } = await supabase
    .from('candidates')
    .update({
      full_name: parsed.full_name || 'Unknown',
      email: parsed.email || null,
      phone: parsed.phone || null,
      location: parsed.location || null,
      current_company: parsed.current_company || null,
      total_experience_years: parsed.total_experience_years || 0,
      parsed_json: parsed.parsed_json,
      flight_risk: parsed.flight_risk || null,
      growth_trajectory: parsed.growth_trajectory || null,
      source: parsed.source || '',
      resume_file_url: parsed.resume_file_url,
      raw_resume_text: parsed.cleanText,
      processing_status: 'COMPLETED',
    })
    .eq('id', candidateId);

  if (updateError) {
    logger.error('Failed to update parsed candidate', { error: updateError.message, candidateId });
    throw new AppError('Failed to update candidate with parsed data', 500);
  }

  if (parsed.skills.length > 0) {
    const seen = new Set<string>();
    const rows = parsed.skills
      .map((s) => s.toLowerCase().trim())
      .filter((s) => { if (seen.has(s) || !s) return false; seen.add(s); return true; })
      .map((s) => ({ candidate_id: candidateId, skill_name: s }));

    const { error: skDeleteError } = await supabase.from('candidate_skills').delete().eq('candidate_id', candidateId);
    if (skDeleteError) {
      await supabase.from('candidate_skills').upsert(rows, { onConflict: 'candidate_id,skill_name', ignoreDuplicates: false });
    } else if (rows.length > 0) {
      const { error: skInsertError } = await supabase.from('candidate_skills').insert(rows);
      if (skInsertError) {
        logger.error('Failed to insert skills', { error: skInsertError.message, candidateId });
      }
    }
  }

  if (parsed.work_history && parsed.work_history.length > 0) {
    const rows = parsed.work_history.map((w) => ({
      candidate_id: candidateId,
      job_title: w.title,
      company: w.company,
      start_date: null,
      end_date: null,
      is_current: false,
    }));
    const { error: expError } = await supabase.from('candidate_experience').insert(rows);
    if (expError) {
      logger.error('Failed to insert experience', { error: expError.message, candidateId });
    }
  }

  logger.info('Parsed candidate data inserted', { candidateId, name: parsed.full_name, skills: parsed.skills.length });
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
    logger.error('Failed to insert experience', { error: error.message });
    throw new AppError('Failed to insert experience', 500);
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
}

export async function addCandidateNote(candidateId: string, noteText: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('candidate_notes').insert({
    candidate_id: candidateId,
    note_text: noteText,
  });
  if (error) {
    logger.error('Failed to add note', { error: error.message });
    throw new AppError('Failed to add note', 500);
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
    logger.error('Failed to get notes', { error: error.message });
    throw new AppError('Failed to get notes', 500);
  }
  return (data || []) as Array<{ id: string; note_text: string; created_at: string }>;
}

export async function getPendingCandidates(): Promise<CandidateRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .select()
    .in('processing_status', ['PENDING', 'FAILED']);

  if (error) {
    logger.error('Failed to get pending candidates', { error: error.message });
    return [];
  }
  return (data || []) as CandidateRecord[];
}

export async function getCandidatesByIds(ids: string[]): Promise<CandidateRecord[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .select()
    .in('id', ids);

  if (error) {
    logger.error('Failed to get candidates by ids', { error: error.message });
    throw new AppError('Failed to get candidates', 500);
  }
  return (data || []) as CandidateRecord[];
}
