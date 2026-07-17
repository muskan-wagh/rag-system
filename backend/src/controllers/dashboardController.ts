import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { memoryCache } from '@/utils/memory-cache';
import { RecruiterRecord } from '@/services/supabase/database';
import { logger } from '@/utils/logger';
import { AGGREGATION_STATUS_GROUPS } from '@/constants/candidateStatus';

const DASHBOARD_CACHE_TTL = 2_000;
const DEFAULT_LIMIT = 50;

interface DashboardStats {
  totalCandidates: number;
  uploadedToday: number;
  activeSessions: number;
  searches: number;
  open: number;
  applied: number;
  screening: number;
  interview: number;
  interviewsToday: number;
  offered: number;
  hired: number;
  rejected: number;
}

interface DashboardData {
  stats: DashboardStats;
  recentUploads: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
}

export const getDashboardHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter as RecruiterRecord;
  if (!recruiter) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const recruiterId = recruiter.id;
  const cacheKey = `dashboard:recruiter:${recruiterId}`;
  const cached = memoryCache.get<DashboardData>(cacheKey);
  if (cached) {
    res.status(200).json({ success: true, data: cached });
    return;
  }

  const supabase = getSupabaseClient();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  try {
    // Try the optimized RPC first
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_recruiter_stats', { p_recruiter_id: recruiterId });

    if (!rpcError && rpcData) {
      const r = rpcData as Record<string, number>;

      const [recentResult, sessionsResult] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, upload_session_id, full_name, email, phone, location, current_company, current_title, total_experience_years, resume_file_url, flight_risk, growth_trajectory, current_status, created_at, processing_status')
          .eq('recruiter_id', recruiterId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1),
        supabase
          .from('upload_sessions')
          .select('id, job_description_text, created_at')
          .eq('recruiter_id', recruiterId)
          .order('created_at', { ascending: false }),
      ]);

      if (recentResult.error) {
        throw new AppError('Failed to load candidates', 500, ErrorCodes.DATABASE_ERROR);
      }

      const data: DashboardData = {
        stats: {
          totalCandidates: r.totalCandidates ?? 0,
          uploadedToday: r.uploadedToday ?? 0,
          activeSessions: r.activeSessions ?? 0,
          searches: r.searches ?? 0,
          open: r.open ?? 0,
          applied: r.applied ?? 0,
          screening: r.screening ?? 0,
          interview: r.interview ?? 0,
          interviewsToday: r.interviewsToday ?? 0,
          offered: r.offered ?? 0,
          hired: r.hired ?? 0,
          rejected: r.rejected ?? 0,
        },
        recentUploads: (recentResult.data || []).map((c: Record<string, unknown>) => c),
        sessions: (sessionsResult.data || []).map((s: Record<string, unknown>) => ({
          id: s.id,
          job_description_text: (s.job_description_text as string || '').slice(0, 100),
          created_at: s.created_at,
        })),
      };

      memoryCache.set(cacheKey, data, DASHBOARD_CACHE_TTL);
      res.status(200).json({ success: true, data });
      return;
    }

    logger.warn('[dashboard] RPC get_recruiter_stats failed, falling back to manual aggregation', {
      error: rpcError?.message,
    });
  } catch {
    logger.warn('[dashboard] RPC get_recruiter_stats threw, falling back to manual aggregation');
  }

  // Fallback: manual aggregation
  const [candidatesResult, sessionsResult] = await Promise.all([
    supabase
      .from('candidates')
      .select('id, upload_session_id, full_name, email, phone, location, current_company, current_title, total_experience_years, resume_file_url, flight_risk, growth_trajectory, current_status, created_at, processing_status')
      .eq('recruiter_id', recruiterId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from('upload_sessions')
      .select('id, job_description_text, created_at')
      .eq('recruiter_id', recruiterId)
      .order('created_at', { ascending: false }),
  ]);

  if (candidatesResult.error) {
    throw new AppError('Failed to load candidates', 500, ErrorCodes.DATABASE_ERROR);
  }

  const allCandidates = (candidatesResult.data || []) as Array<Record<string, unknown>>;

  let open = 0, applied = 0, screening = 0, interview = 0;
  let offered = 0, hired = 0, rejected = 0;
  let uploadedToday = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const c of allCandidates) {
    const s = ((c.current_status as string) || '').toLowerCase();

    if (AGGREGATION_STATUS_GROUPS.applied.map(st => st.toLowerCase()).includes(s)) { applied++; open++; }
    else if (AGGREGATION_STATUS_GROUPS.open.map(st => st.toLowerCase()).includes(s)) open++;
    else if (AGGREGATION_STATUS_GROUPS.screening.map(st => st.toLowerCase()).includes(s)) { screening++; open++; }
    else if (AGGREGATION_STATUS_GROUPS.interview.map(st => st.toLowerCase()).includes(s)) { interview++; open++; }
    else if (AGGREGATION_STATUS_GROUPS.offered.map(st => st.toLowerCase()).includes(s)) { offered++; open++; }
    else if (AGGREGATION_STATUS_GROUPS.hired.map(st => st.toLowerCase()).includes(s)) hired++;
    else if (AGGREGATION_STATUS_GROUPS.rejected.map(st => st.toLowerCase()).includes(s)) rejected++;

    if ((c.created_at as string || '').slice(0, 10) === today) uploadedToday++;
  }

  const totalCandidates = allCandidates.length;

  // Count interviews today
  let interviewsToday = 0;
  try {
    const { count } = await supabase
      .from('interviews')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_date', today)
      .eq('status', 'scheduled')
      .in('candidate_id', allCandidates.map(c => c.id));
    interviewsToday = count || 0;
  } catch { /* best effort */ }

  // Count search sessions
  let searches = 0;
  try {
    const { count } = await supabase
      .from('search_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('recruiter_id', recruiterId);
    searches = count || 0;
  } catch { /* best effort */ }

  const candidatePage = allCandidates.slice(0, limit);

  const data: DashboardData = {
    stats: {
      totalCandidates,
      uploadedToday,
      activeSessions: (sessionsResult.data || []).length,
      searches,
      open,
      applied,
      screening,
      interview,
      interviewsToday,
      offered,
      hired,
      rejected,
    },
    recentUploads: candidatePage,
    sessions: (sessionsResult.data || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      job_description_text: (s.job_description_text as string || '').slice(0, 100),
      created_at: s.created_at,
    })),
  };

  memoryCache.set(cacheKey, data, DASHBOARD_CACHE_TTL);

  res.status(200).json({ success: true, data });
});