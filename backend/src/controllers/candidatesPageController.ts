import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { CandidateWithSkills } from '@/services/supabase/database';

interface SessionSummary {
  id: string;
  job_description_text: string;
  created_at: string;
  candidate_count: number;
}

function buildStatusFilter(status?: string): (q: any) => any {
  return (query: any) => {
    if (!status) return query;
    switch (status) {
      case 'open':
        return query.in('current_status', ['Applied', 'Shortlisted']);
      case 'screening':
        return query.eq('current_status', 'Screening');
      case 'interviews-today':
        // Handled separately — return query unchanged
        return query;
      case 'offered':
        return query.eq('current_status', 'Offered');
      case 'hired':
        return query.eq('current_status', 'Hired');
      case 'rejected':
        return query.eq('current_status', 'Rejected');
      default:
        return query;
    }
  };
}

export const getCandidatesPageHandler = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabaseClient();
  const {
    page = '1',
    limit = '20',
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
    sessionId,
    status,
  } = req.query as Record<string, string | undefined>;

  const pageNum = parseInt(page || '1', 10);
  const limitNum = Math.min(parseInt(limit || '20', 10), 100);
  const offset = (pageNum - 1) * limitNum;

  // For "interviews-today", we need to find candidates with interviews scheduled today
  let interviewCandidateIds: string[] | undefined;
  if (status === 'interviews-today') {
    const todayStr = new Date().toISOString().split('T')[0];
    let intQuery = supabase
      .from('interviews')
      .select('candidate_id')
      .eq('scheduled_date', todayStr)
      .eq('status', 'scheduled');
    if (sessionId) {
      const { data: sessCandidates } = await supabase
        .from('candidates')
        .select('id')
        .eq('upload_session_id', sessionId);
      const ids = (sessCandidates || []).map((c: any) => c.id);
      if (ids.length > 0) {
        intQuery = intQuery.in('candidate_id', ids);
      }
    }
    const { data: intData } = await intQuery;
    interviewCandidateIds = [...new Set((intData || []).map((r: any) => r.candidate_id))];

    // If no interviews today, return empty result quickly
    if (interviewCandidateIds.length === 0) {
      const sessionsResult = await supabase
        .from('upload_sessions')
        .select('id, job_description_text, created_at, candidates(count)')
        .order('created_at', { ascending: false });

      const sessions: SessionSummary[] = (sessionsResult.data || []).map((s: Record<string, unknown>) => {
        const cands = s.candidates as Array<{ count: number }> | undefined;
        return {
          id: s.id as string,
          job_description_text: '',
          created_at: s.created_at as string,
          candidate_count: cands?.[0]?.count ?? 0,
        };
      });

      res.status(200).json({
        success: true,
        data: { sessions, candidates: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
      });
      return;
    }
  }

  // Step 1: Fetch sessions list for sidebar
  const sessionsPromise = supabase
    .from('upload_sessions')
    .select('id, job_description_text, created_at, candidates(count)')
    .order('created_at', { ascending: false });

  // Build count query
  let countQuery: any = supabase
    .from('candidates')
    .select('id', { count: 'exact', head: true });

  countQuery = buildStatusFilter(status)(countQuery);
  if (interviewCandidateIds) {
    countQuery = countQuery.in('id', interviewCandidateIds);
  }
  if (sessionId) {
    countQuery = countQuery.eq('upload_session_id', sessionId);
  }
  if (search) {
    const searchTerm = `%${search}%`;
    countQuery = countQuery.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm},current_company.ilike.${searchTerm}`);
  }

  // Build data query
  let dataQuery: any = supabase
    .from('candidates')
    .select('id, upload_session_id, full_name, email, phone, location, current_company, current_title, total_experience_years, resume_file_url, flight_risk, growth_trajectory, current_status, created_at');

  dataQuery = buildStatusFilter(status)(dataQuery);
  if (interviewCandidateIds) {
    dataQuery = dataQuery.in('id', interviewCandidateIds);
  }
  if (sessionId) {
    dataQuery = dataQuery.eq('upload_session_id', sessionId);
  }
  if (search) {
    const searchTerm = `%${search}%`;
    dataQuery = dataQuery.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm},current_company.ilike.${searchTerm}`);
  }

  const allowedSortColumns = ['created_at', 'full_name', 'total_experience_years', 'current_status', 'current_company'];
  const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
  dataQuery = dataQuery.order(safeSortBy, { ascending: sortOrder === 'asc' });
  dataQuery = dataQuery.range(offset, offset + limitNum - 1);

  // Run sessions + count + data in parallel
  const [sessionsResult, countResult, dataResult] = await Promise.all([
    sessionsPromise,
    countQuery,
    dataQuery,
  ]);

  if (sessionsResult.error) {
    throw new AppError('Failed to load sessions', 500, ErrorCodes.DATABASE_ERROR);
  }
  if (countResult.error) {
    throw new AppError('Failed to count candidates', 500, ErrorCodes.DATABASE_ERROR);
  }
  if (dataResult.error) {
    throw new AppError('Failed to load candidates', 500, ErrorCodes.DATABASE_ERROR);
  }

  // Map sessions
  const sessions: SessionSummary[] = (sessionsResult.data || []).map((s: Record<string, unknown>) => {
    const candidates = s.candidates as Array<{ count: number }> | undefined;
    return {
      id: s.id as string,
      job_description_text: '',
      created_at: s.created_at as string,
      candidate_count: candidates?.[0]?.count ?? 0,
    };
  });

  // Map candidates
  const candidates: CandidateWithSkills[] = ((dataResult.data || []) as Record<string, unknown>[]).map((c) => ({
    ...c,
    skills: [] as string[],
    match_score: undefined as number | undefined,
  })) as CandidateWithSkills[];

  // Fetch skills in batch
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

  const total = countResult.count || 0;

  res.status(200).json({
    success: true,
    data: {
      sessions,
      candidates,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});
