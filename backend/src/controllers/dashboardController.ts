import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { memoryCache } from '@/utils/memory-cache';
import { CandidateRecord, getNewSessionStats } from '@/services/supabase/database';

const DASHBOARD_CACHE_TTL = 30_000;
const DEFAULT_LIMIT = 50;

export const getDashboardHandler = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabaseClient();

  const cacheKey = 'dashboard:overview:v2';
  const cached = memoryCache.get<DashboardCache>(cacheKey);
  if (cached) {
    res.status(200).json({ success: true, data: cached });
    return;
  }

  const { data: sessions, error: sessionError } = await supabase
    .from('upload_sessions')
    .select('id, job_description_text, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (sessionError) {
    throw new AppError('Failed to load dashboard', 500, ErrorCodes.DATABASE_ERROR);
  }

  if (!sessions || sessions.length === 0) {
    const empty = {
      session: null,
      candidates: [],
      stats: { open: 0, applied: 0, screening: 0, interview: 0, interviewsToday: 0, offered: 0, hired: 0, rejected: 0 },
    };
    res.status(200).json({ success: true, data: empty });
    return;
  }

  const latestSession = sessions[0];

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  const [candidatesResult, stats] = await Promise.all([
    supabase
      .from('candidates')
      .select('id, upload_session_id, full_name, email, phone, location, current_company, current_title, total_experience_years, resume_file_url, flight_risk, growth_trajectory, current_status, created_at, processing_status, source, error_message')
      .eq('upload_session_id', latestSession.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    getNewSessionStats(latestSession.id),
  ]);

  if (candidatesResult.error) {
    throw new AppError('Failed to load candidates', 500, ErrorCodes.DATABASE_ERROR);
  }

  const candidateList = (candidatesResult.data || []) as CandidateRecord[];

  const responseData = {
    session: {
      id: latestSession.id,
      job_description_text: latestSession.job_description_text,
      created_at: latestSession.created_at,
      link: `/upload/${latestSession.id}`,
    },
    candidates: candidateList,
    stats,
    pagination: {
      page,
      limit,
    },
  };

  memoryCache.set(cacheKey, responseData, DASHBOARD_CACHE_TTL);

  res.status(200).json({ success: true, data: responseData });
});

interface DashboardCache {
  session: {
    id: string;
    job_description_text: string;
    created_at: string;
    link: string;
  } | null;
  candidates: CandidateRecord[];
  stats: {
    open: number;
    applied: number;
    screening: number;
    interview: number;
    interviewsToday: number;
    offered: number;
    hired: number;
    rejected: number;
  };
  pagination: {
    page: number;
    limit: number;
  };
}
