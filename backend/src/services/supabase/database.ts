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

export interface CreateCandidateInput {
  upload_session_id: string;
  raw_resume_text: string;
  processing_status: string;
  source: string;
  resume_file_url: string;
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
    .select('id, job_description_text, created_at')
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new AppError('Failed to get session', 500, ErrorCodes.DATABASE_ERROR);
  }

  return data as UploadSession;
}

export async function createCandidate(input: CreateCandidateInput): Promise<CandidateRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .insert({
      upload_session_id: input.upload_session_id,
      raw_resume_text: input.raw_resume_text,
      processing_status: input.processing_status,
      source: input.source,
      resume_file_url: input.resume_file_url,
    })
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to create candidate', 500, ErrorCodes.DATABASE_ERROR);
  }

  return data as CandidateRecord;
}

function serializeForDb(updates: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    // Convert undefined to null for Supabase — never silently drop fields
    result[key] = value === undefined ? null : value;
  }
  return result;
}

export async function updateCandidate(id: string, updates: Partial<CandidateRecord>): Promise<void> {
  const supabase = getSupabaseClient();
  const clean = serializeForDb(updates as Record<string, unknown>);

  const { error } = await supabase
    .from('candidates')
    .update(clean)
    .eq('id', id);

  if (error) {
    throw new AppError(`Failed to update candidate: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function getCandidatesBySession(sessionId: string): Promise<CandidateRecord[]> {
  const supabase = getSupabaseClient();
  // Select only columns needed for list views — exclude raw_resume_text (potentially MBs of text)
  const { data, error } = await supabase
    .from('candidates')
    .select('id, upload_session_id, full_name, email, phone, location, current_company, current_title, total_experience_years, resume_file_url, flight_risk, growth_trajectory, current_status, created_at, processing_status, source, error_message')
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

  // Run both writes in parallel — they're independent
  const [logResult, updateResult] = await Promise.all([
    supabase
      .from('candidate_status_log')
      .insert({ candidate_id: candidateId, status }),
    supabase
      .from('candidates')
      .update({ current_status: status })
      .eq('id', candidateId),
  ]);

  if (logResult.error) {
    logger.error('Failed to log status change', { error: logResult.error.message });
  }

  if (updateResult.error) {
    throw new AppError(`Failed to update candidate status: ${updateResult.error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
}

export interface SessionWithCount {
  id: string;
  job_description_text: string;
  created_at: string;
  candidate_count: number;
}

export async function getAllSessions(): Promise<SessionWithCount[]> {
  const supabase = getSupabaseClient();

  // Exclude job_description_text — it's 2-10KB per session and unnecessary for the list view.
  // The sidebar only shows a 55-char truncated preview; the full text comes from getSession().
  const { data, error } = await supabase
    .from('upload_sessions')
    .select('id, created_at, candidates(count)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('Failed to get sessions', 500, ErrorCodes.DATABASE_ERROR);
  }

  return (data || []).map((s: Record<string, unknown>) => {
    const candidates = s.candidates as Array<{ count: number }> | undefined;
    return {
      id: s.id as string,
      job_description_text: '',
      created_at: s.created_at as string,
      candidate_count: candidates?.[0]?.count ?? 0,
    };
  });
}

export interface SessionStats {
  total: number;
  pending: number;
  shortlisted: number;
  interview: number;
  rejected: number;
  hired: number;
}

export async function getSessionStats(sessionId: string): Promise<SessionStats> {
  const supabase = getSupabaseClient();
  // Only select the single column needed for aggregation — no large text fields
  // Uses composite index: idx_candidates_session_status(upload_session_id, current_status)
  const { data, error } = await supabase
    .from('candidates')
    .select('current_status')
    .eq('upload_session_id', sessionId);

  if (error) {
    throw new AppError('Failed to get session stats', 500, ErrorCodes.DATABASE_ERROR);
  }

  const rows = (data || []) as Array<{ current_status: string }>;
  const stats: SessionStats = {
    total: rows.length,
    pending: 0,
    shortlisted: 0,
    interview: 0,
    rejected: 0,
    hired: 0,
  };

  const interviewStatuses = new Set(['interview', 'screening', 'technical interview', 'hr interview']);

  for (const row of rows) {
    const status = (row.current_status || 'Pending').toLowerCase();
    if (status === 'pending' || status === 'applied') stats.pending++;
    else if (status === 'shortlisted') stats.shortlisted++;
    else if (interviewStatuses.has(status)) stats.interview++;
    else if (status === 'rejected') stats.rejected++;
    else if (status === 'hired') stats.hired++;
    else stats.pending++;
  }

  return stats;
}

export interface CandidateWithSkills {
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
  resume_file_url?: string;
  flight_risk?: string;
  growth_trajectory?: string;
  current_status?: string;
  created_at?: string;
  skills?: string[];
  match_score?: number;
}

export interface PaginatedCandidatesResult {
  candidates: CandidateWithSkills[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getAllCandidatesPaginated(params: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  sessionId?: string;
}): Promise<PaginatedCandidatesResult> {
  const supabase = getSupabaseClient();
  const page = params.page || 1;
  const limit = Math.min(params.limit || 20, 100);
  const offset = (page - 1) * limit;
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder || 'desc';

  // Build query for count
  let countQuery = supabase
    .from('candidates')
    .select('id', { count: 'exact', head: true });

  if (params.sessionId) {
    countQuery = countQuery.eq('upload_session_id', params.sessionId);
  }
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    countQuery = countQuery.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm},current_company.ilike.${searchTerm}`);
  }

  // Build query for data — select only columns needed for list views
  // Exclude raw_resume_text (potentially MBs of text per candidate)
  let query = supabase
    .from('candidates')
    .select('id, upload_session_id, full_name, email, phone, location, current_company, current_title, total_experience_years, resume_file_url, flight_risk, growth_trajectory, current_status, created_at');

  if (params.sessionId) {
    query = query.eq('upload_session_id', params.sessionId);
  }
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    query = query.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm},current_company.ilike.${searchTerm}`);
  }

  // Validate sort column to prevent injection
  const allowedSortColumns = ['created_at', 'full_name', 'total_experience_years', 'current_status', 'current_company'];
  const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';

  query = query.order(safeSortBy, { ascending: sortOrder === 'asc' });
  query = query.range(offset, offset + limit - 1);

  // Run count and data queries in parallel — they use identical filters but are independent
  const [countResult, dataResult] = await Promise.all([
    countQuery,
    query,
  ]);

  const { count, error: countError } = countResult;
  if (countError) {
    throw new AppError('Failed to count candidates', 500, ErrorCodes.DATABASE_ERROR);
  }

  const { data, error } = dataResult;
  if (error) {
    throw new AppError('Failed to get candidates', 500, ErrorCodes.DATABASE_ERROR);
  }

  const candidates = ((data || []) as CandidateRecord[]).map((c) => ({
    ...c,
    skills: [] as string[],
    match_score: undefined as number | undefined,
  })) as CandidateWithSkills[];

  // Fetch skills for all candidates in one query
  if (candidates.length > 0) {
    const candidateIds = candidates.map((c) => c.id);
    const { data: skillsData, error: skillsError } = await supabase
      .from('candidate_skills')
      .select('candidate_id, skill_name')
      .in('candidate_id', candidateIds)
      .order('skill_name');

    if (!skillsError && skillsData) {
      const skillsMap = new Map<string, string[]>();
      for (const row of skillsData) {
        const arr = skillsMap.get(row.candidate_id) || [];
        arr.push(row.skill_name);
        skillsMap.set(row.candidate_id, arr);
      }
      for (const candidate of candidates) {
        candidate.skills = skillsMap.get(candidate.id) || [];
      }
    }
  }

  const total = count || 0;
  return {
    candidates,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
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
    .select('id, upload_session_id, raw_resume_text, processing_status, source, resume_file_url')
    .in('processing_status', ['PENDING'])
    .limit(100);

  if (error) {
    return [];
  }
  return (data || []) as CandidateRecord[];
}
