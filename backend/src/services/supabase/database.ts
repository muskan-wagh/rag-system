import { getSupabaseClient } from './client';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { CANDIDATE_STATUS, STATUS_FILTER_MAP, AGGREGATION_STATUS_GROUPS } from '@/constants/candidateStatus';

export interface UploadSession {
  id: string;
  job_description_text: string;
  recruiter_id?: string;
  created_at: string;
}

export interface CandidateRecord {
  id: string;
  upload_session_id?: string;
  recruiter_id?: string;
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
  recruiter_id?: string;
  raw_resume_text: string;
  processing_status: string;
  source: string;
  resume_file_url: string;
}

export async function createUploadSession(jdText: string, recruiterId?: string): Promise<UploadSession> {
  const supabase = getSupabaseClient();
  const payload: Record<string, unknown> = { job_description_text: jdText };
  if (recruiterId) payload.recruiter_id = recruiterId;
  const { data, error } = await supabase
    .from('upload_sessions')
    .insert(payload)
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
    .select('id, job_description_text, recruiter_id, created_at')
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
      recruiter_id: input.recruiter_id,
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

const DUPLICATE_KEY_PATTERN = /duplicate key value violates unique constraint "([^"]+)"/;

export async function updateCandidateSafe(
  id: string,
  updates: Partial<CandidateRecord>,
): Promise<void> {
  try {
    await updateCandidate(id, updates);
  } catch (err: any) {
    const constraintMatch = err.message?.match(DUPLICATE_KEY_PATTERN);
    if (!constraintMatch) {
      throw err;
    }

    const constraintName = constraintMatch[1];
    const fieldMap: Record<string, string> = {
      candidates_email_key: 'email',
      candidates_phone_key: 'phone',
    };

    const conflictingField = fieldMap[constraintName];
    if (!conflictingField) {
      throw err;
    }

    logger.warn('updateCandidateSafe: duplicate key violation, retrying without conflicting field', {
      candidateId: id,
      constraint: constraintName,
      field: conflictingField,
    });

    const safeUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key !== conflictingField) {
        safeUpdates[key] = value === undefined ? null : value;
      }
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('candidates')
      .update(safeUpdates)
      .eq('id', id);

    if (error) {
      throw new AppError(`Failed to update candidate: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
    }

    logger.warn('updateCandidateSafe: update succeeded after removing conflict field', {
      candidateId: id,
      field: conflictingField,
    });
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

export async function getAllSessions(recruiterId?: string): Promise<SessionWithCount[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('upload_sessions')
    .select('id, job_description_text, created_at, candidates(count)')
    .order('created_at', { ascending: false });

  if (recruiterId) {
    query = query.eq('recruiter_id', recruiterId);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('Failed to get sessions', 500, ErrorCodes.DATABASE_ERROR);
  }

  return (data || []).map((s: Record<string, unknown>) => {
    const candidates = s.candidates as Array<{ count: number }> | undefined;
    const rawText = (s.job_description_text as string) || '';
    return {
      id: s.id as string,
      job_description_text: rawText.slice(0, 100),
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

export interface NewSessionStats {
  open: number;
  applied: number;
  screening: number;
  interview: number;
  interviewsToday: number;
  offered: number;
  hired: number;
  rejected: number;
}

export interface InterviewRecord {
  id: string;
  candidate_id: string;
  scheduled_date: string;
  scheduled_time: string;
  interview_type: string;
  interviewer_name: string;
  notes: string;
  meeting_link: string;
  status: string;
  created_at: string;
}

export interface OfferRecord {
  id: string;
  candidate_id: string;
  salary: number | null;
  joining_date: string | null;
  notes: string;
  status: string;
  created_at: string;
}

export interface TimelineEntry {
  id: string;
  candidate_id: string;
  status: string;
  changed_at: string;
  changed_by: string;
  details: Record<string, unknown> | null;
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

  const interviewStatuses = new Set(AGGREGATION_STATUS_GROUPS.interview.map(s => s.toLowerCase()));

  for (const row of rows) {
    const status = (row.current_status || CANDIDATE_STATUS.APPLIED).toLowerCase();
    if (status === CANDIDATE_STATUS.APPLIED.toLowerCase()) stats.pending++;
    else if (status === CANDIDATE_STATUS.SHORTLISTED.toLowerCase()) stats.shortlisted++;
    else if (interviewStatuses.has(status)) stats.interview++;
    else if (status === CANDIDATE_STATUS.REJECTED.toLowerCase()) stats.rejected++;
    else if (status === CANDIDATE_STATUS.HIRED.toLowerCase()) stats.hired++;
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

const STATUS_CANONICAL_MAP: Record<string, string> = {};
for (const v of Object.values(CANDIDATE_STATUS)) {
  STATUS_CANONICAL_MAP[v.toLowerCase()] = v;
}

export function buildStatusFilterParam(status?: string): (q: any) => any {
  return (query: any) => {
    if (!status) return query;
    const statusKey = status.toLowerCase();
    if (statusKey.includes(',')) {
      const keys = statusKey.split(',').map(s => s.trim());
      const mapped = keys.flatMap(k => {
        const filter = STATUS_FILTER_MAP[k];
        if (filter !== undefined) {
          return Array.isArray(filter) ? filter : [filter];
        }
        const canonical = STATUS_CANONICAL_MAP[k];
        if (canonical) return [canonical];
        return [];
      });
      if (mapped.length === 0) return query;
      return query.in('current_status', mapped);
    }
    const filter = STATUS_FILTER_MAP[statusKey];
    if (filter !== undefined) {
      if (Array.isArray(filter)) {
        if (filter.length === 0) return query;
        return query.in('current_status', filter);
      }
      return query.eq('current_status', filter);
    }
    const canonical = STATUS_CANONICAL_MAP[statusKey];
    if (canonical) return query.eq('current_status', canonical);
    return query;
  };
}

export async function getAllCandidatesPaginated(params: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  sessionId?: string;
  status?: string;
  interviewCandidateIds?: string[];
}): Promise<PaginatedCandidatesResult> {
  const supabase = getSupabaseClient();
  const page = params.page || 1;
  const limit = Math.min(params.limit || 20, 100);
  const offset = (page - 1) * limit;
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder || 'desc';

  // Build query for count
  let countQuery: any = supabase
    .from('candidates')
    .select('id', { count: 'exact', head: true });

  countQuery = buildStatusFilterParam(params.status)(countQuery);
  if (params.interviewCandidateIds) {
    countQuery = countQuery.in('id', params.interviewCandidateIds);
  }
  if (params.sessionId) {
    countQuery = countQuery.eq('upload_session_id', params.sessionId);
  }
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    countQuery = countQuery.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm},current_company.ilike.${searchTerm}`);
  }

  // Build query for data — select only columns needed for list views
  // Exclude raw_resume_text (potentially MBs of text per candidate)
  let query: any = supabase
    .from('candidates')
    .select('id, upload_session_id, full_name, email, phone, location, current_company, current_title, total_experience_years, resume_file_url, flight_risk, growth_trajectory, current_status, created_at');

  query = buildStatusFilterParam(params.status)(query);
  if (params.interviewCandidateIds) {
    query = query.in('id', params.interviewCandidateIds);
  }
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
    logger.warn('Failed to add note', { candidateId, error: error.message });
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
    logger.warn('Failed to get notes', { candidateId, error: error.message });
    return [];
  }
  return (data || []) as Array<{ id: string; note_text: string; created_at: string }>;
}

// === NEW CANDIDATE WORKFLOW FUNCTIONS ===

export async function updateCandidateStatusExtended(
  candidateId: string,
  status: string,
  changedBy?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();

  const [logResult, updateResult] = await Promise.all([
    supabase
      .from('candidate_status_log')
      .insert({
        candidate_id: candidateId,
        status,
        changed_by: changedBy || '',
        details: details || {},
      }),
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

export async function scheduleInterview(
  candidateId: string,
  data: {
    scheduledDate: string;
    scheduledTime: string;
    interviewType: string;
    interviewerName?: string;
    notes?: string;
  }
): Promise<InterviewRecord> {
  const supabase = getSupabaseClient();

  const meetingLinks: Record<string, string> = {
    google_meet: 'https://meet.google.com/',
    zoom: 'https://zoom.us/j/',
    ms_teams: 'https://teams.microsoft.com/l/meetup-join/',
  };

  const meetingLink = meetingLinks[data.interviewType] || '';

  const { data: interview, error } = await supabase
    .from('interviews')
    .insert({
      candidate_id: candidateId,
      scheduled_date: data.scheduledDate,
      scheduled_time: data.scheduledTime,
      interview_type: data.interviewType,
      interviewer_name: data.interviewerName || '',
      notes: data.notes || '',
      meeting_link: meetingLink,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) {
    throw new AppError(`Failed to schedule interview: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  return interview as InterviewRecord;
}

export async function getCandidateInterviews(candidateId: string): Promise<InterviewRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('scheduled_date', { ascending: false });

  if (error) {
    throw new AppError('Failed to get interviews', 500, ErrorCodes.DATABASE_ERROR);
  }
  return (data || []) as InterviewRecord[];
}

export async function updateInterview(
  interviewId: string,
  data: Partial<{
    scheduledDate: string;
    scheduledTime: string;
    interviewType: string;
    interviewerName: string;
    notes: string;
    status: string;
  }>
): Promise<void> {
  const supabase = getSupabaseClient();

  const updates: Record<string, unknown> = {};
  if (data.scheduledDate) updates.scheduled_date = data.scheduledDate;
  if (data.scheduledTime) updates.scheduled_time = data.scheduledTime;
  if (data.interviewType) updates.interview_type = data.interviewType;
  if (data.interviewerName !== undefined) updates.interviewer_name = data.interviewerName;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.status) updates.status = data.status;

  const { error } = await supabase
    .from('interviews')
    .update(updates)
    .eq('id', interviewId);

  if (error) {
    throw new AppError(`Failed to update interview: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function createOffer(
  candidateId: string,
  data: { salary?: number; joiningDate?: string; notes?: string }
): Promise<OfferRecord> {
  const supabase = getSupabaseClient();

  const { data: offer, error } = await supabase
    .from('offers')
    .insert({
      candidate_id: candidateId,
      salary: data.salary || null,
      joining_date: data.joiningDate || null,
      notes: data.notes || '',
      status: 'offered',
    })
    .select()
    .single();

  if (error) {
    throw new AppError(`Failed to create offer: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  return offer as OfferRecord;
}

export async function acceptOffer(candidateId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: offerError } = await supabase
    .from('offers')
    .update({ status: 'accepted' })
    .eq('candidate_id', candidateId)
    .eq('status', 'offered');

  if (offerError) {
    logger.error('Failed to update offer status', { error: offerError.message });
  }
}

export async function rejectCandidateWithReason(
  candidateId: string,
  reason: string,
  notes?: string,
  changedBy?: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const details: Record<string, unknown> = { rejection_reason: reason };
  if (notes) details.rejection_notes = notes;

  const [logResult, updateResult] = await Promise.all([
    supabase
      .from('candidate_status_log')
      .insert({
        candidate_id: candidateId,
        status: 'Rejected',
        changed_by: changedBy || '',
        details,
      }),
    supabase
      .from('candidates')
      .update({ current_status: 'Rejected' })
      .eq('id', candidateId),
  ]);

  if (logResult.error) {
    logger.error('Failed to log rejection', { error: logResult.error.message });
  }
  if (updateResult.error) {
    throw new AppError(`Failed to reject candidate: ${updateResult.error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function getCandidateTimeline(candidateId: string): Promise<TimelineEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidate_status_log')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('changed_at', { ascending: true });

  if (error) {
    throw new AppError('Failed to get timeline', 500, ErrorCodes.DATABASE_ERROR);
  }
  return (data || []) as TimelineEntry[];
}

export async function logEmail(
  candidateId: string,
  emailType: string,
  subject: string,
  body: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('email_logs').insert({
    candidate_id: candidateId,
    email_type: emailType,
    subject,
    body,
  });
  if (error) {
    logger.error('Failed to log email', { error: error.message });
  }
}

export async function getNewSessionStats(sessionId: string): Promise<NewSessionStats> {
  const supabase = getSupabaseClient();

  // Use the optimized PostgreSQL RPC function for in-database aggregation
  try {
    const { data, error } = await supabase
      .rpc('get_session_stats_new', { p_session_id: sessionId });

    if (!error && data) {
      const r = data as Record<string, number>;

      // Detect old RPC format: if 'total' or 'pending' exists, the function hasn't been updated
      const isOldFormat = 'total' in r || 'pending' in r;
      if (!isOldFormat) {
        return {
          open: r.open ?? 0,
          applied: r.applied ?? 0,
          screening: r.screening ?? 0,
          interview: r.interview ?? 0,
          interviewsToday: r.interviewsToday ?? 0,
          offered: r.offered ?? 0,
          hired: r.hired ?? 0,
          rejected: r.rejected ?? 0,
        };
      }
      // Old format detected — fall through to manual aggregation
      logger.warn('RPC returned old format, falling back to manual aggregation');
    }
  } catch {
    logger.warn('RPC get_session_stats_new failed, falling back to manual aggregation');
  }

  // Fallback: manual aggregation (only fetches current_status column)
  const { data: candidates, error: candError } = await supabase
    .from('candidates')
    .select('id, current_status')
    .eq('upload_session_id', sessionId);

  if (candError) {
    throw new AppError('Failed to get session stats', 500, ErrorCodes.DATABASE_ERROR);
  }

  type CandRow = { id: string; current_status: string };
  const rows = (candidates || []) as CandRow[];
  let open = 0;
  let applied = 0;
  let screening = 0;
  let interview = 0;
  let offered = 0;
  let hired = 0;
  let rejected = 0;

  for (const row of rows) {
    const s = (row.current_status || '').toLowerCase();

    if (AGGREGATION_STATUS_GROUPS.applied.map(st => st.toLowerCase()).includes(s)) { applied++; open++; }
    else if (AGGREGATION_STATUS_GROUPS.open.map(st => st.toLowerCase()).includes(s)) open++;
    else if (AGGREGATION_STATUS_GROUPS.screening.map(st => st.toLowerCase()).includes(s)) { screening++; open++; }
    else if (AGGREGATION_STATUS_GROUPS.interview.map(st => st.toLowerCase()).includes(s)) { interview++; open++; }
    else if (AGGREGATION_STATUS_GROUPS.offered.map(st => st.toLowerCase()).includes(s)) { offered++; open++; }
    else if (AGGREGATION_STATUS_GROUPS.hired.map(st => st.toLowerCase()).includes(s)) hired++;
    else if (AGGREGATION_STATUS_GROUPS.rejected.map(st => st.toLowerCase()).includes(s)) rejected++;
  }

  // Query 2: Count today's scheduled interviews for candidates in this session
  const todayStr = new Date().toISOString().split('T')[0];
  let interviewsToday = 0;
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { count, error: intError } = await supabase
      .from('interviews')
      .select('*', { count: 'exact', head: true })
      .eq('scheduled_date', todayStr)
      .eq('status', 'scheduled')
      .in('candidate_id', ids);

    if (intError) {
      logger.error('Failed to count today interviews', { error: intError.message });
    } else {
      interviewsToday = count || 0;
    }
  }

  return {
    open,
    applied,
    screening,
    interview,
    interviewsToday,
    offered,
    hired,
    rejected,
  };
}

export interface RecruiterRecord {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  organization_name: string | null;
  created_at: string;
  updated_at: string;
}

export async function getRecruiterByClerkId(clerkId: string): Promise<RecruiterRecord | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('recruiters')
    .select('*')
    .eq('clerk_id', clerkId)
    .maybeSingle();

  if (error) {
    throw new AppError('Failed to get recruiter', 500, ErrorCodes.DATABASE_ERROR);
  }

  return data as RecruiterRecord | null;
}

export async function createRecruiter(input: {
  clerk_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  organization_name?: string;
}): Promise<RecruiterRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('recruiters')
    .insert({
      clerk_id: input.clerk_id,
      email: input.email ?? '',
      first_name: input.first_name ?? null,
      last_name: input.last_name ?? null,
      avatar_url: input.avatar_url ?? null,
      organization_name: input.organization_name ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to create recruiter', 500, ErrorCodes.DATABASE_ERROR);
  }

  return data as RecruiterRecord;
}

export async function updateRecruiter(
  clerkId: string,
  updates: Partial<Pick<RecruiterRecord, 'email' | 'first_name' | 'last_name' | 'avatar_url' | 'organization_name'>>
): Promise<void> {
  const supabase = getSupabaseClient();
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.email !== undefined) clean.email = updates.email;
  if (updates.first_name !== undefined) clean.first_name = updates.first_name;
  if (updates.last_name !== undefined) clean.last_name = updates.last_name;
  if (updates.avatar_url !== undefined) clean.avatar_url = updates.avatar_url;
  if (updates.organization_name !== undefined) clean.organization_name = updates.organization_name;

  const { error } = await supabase
    .from('recruiters')
    .update(clean)
    .eq('clerk_id', clerkId);

  if (error) {
    throw new AppError(`Failed to update recruiter: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
}

export async function getStuckCandidates(): Promise<CandidateRecord[]> {
  const supabase = getSupabaseClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('candidates')
    .select('id, upload_session_id, raw_resume_text, processing_status, source, resume_file_url, error_message')
    .or(`processing_status.eq.PENDING,and(processing_status.eq.PROCESSING,created_at.lt.${fiveMinutesAgo})`)
    .limit(100);

  if (error) {
    logger.warn('getStuckCandidates: query failed', { error: error.message });
    return [];
  }
  return (data || []) as CandidateRecord[];
}


