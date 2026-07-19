import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { memoryCache } from '@/utils/memory-cache';
import { RecruiterRecord } from '@/services/supabase/database';
import { logger } from '@/utils/logger';

const DASHBOARD_CACHE_TTL = 30_000;
const STALE_TTL = 60_000;
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

async function fetchDashboardData(recruiterId: string, page: number, limit: number): Promise<DashboardData> {
  const supabase = getSupabaseClient();
  const offset = (page - 1) * limit;

  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_recruiter_stats', { p_recruiter_id: recruiterId });

  if (!rpcError && rpcData) {
    const r = rpcData as Record<string, number>;

    const [recentResult, sessionsResult] = await Promise.all([
      supabase
        .from('candidates')
        .select('id, upload_session_id, full_name, current_company, current_title, total_experience_years, resume_file_url, flight_risk, current_status, created_at')
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

    return {
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
  }

  logger.warn('[dashboard] RPC failed, using manual aggregation', {
    error: rpcError?.message,
  });

  const [candidatesResult, sessionsResult] = await Promise.all([
    supabase
      .from('candidates')
      .select('id, current_status, created_at')
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
    if (s === 'applied' || s === 'shortlisted') { applied++; open++; }
    else if (s === 'screening') { screening++; open++; }
    else if (['interview', 'interview scheduled', 'interview completed', 'technical round', 'hr round'].includes(s)) { interview++; open++; }
    else if (s === 'offered') { offered++; open++; }
    else if (s === 'hired') hired++;
    else if (s === 'rejected') rejected++;

    if ((c.created_at as string || '').slice(0, 10) === today) uploadedToday++;
  }

  const totalCandidates = allCandidates.length;

  let interviewsToday = 0;
  let searches = 0;
  try {
    const [intResult, searchResult] = await Promise.all([
      supabase
        .from('interviews')
        .select('id', { count: 'exact', head: true })
        .eq('scheduled_date', today)
        .eq('status', 'scheduled')
        .in('candidate_id', allCandidates.map(c => c.id)),
      supabase
        .from('search_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('recruiter_id', recruiterId),
    ]);
    interviewsToday = intResult.count || 0;
    searches = searchResult.count || 0;
  } catch { /* best effort */ }

  return {
    stats: {
      totalCandidates,
      uploadedToday,
      activeSessions: (sessionsResult.data || []).length,
      searches,
      open, applied, screening, interview,
      interviewsToday, offered, hired, rejected,
    },
    recentUploads: allCandidates.slice(0, limit),
    sessions: (sessionsResult.data || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      job_description_text: (s.job_description_text as string || '').slice(0, 100),
      created_at: s.created_at,
    })),
  };
}

export const getDashboardHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter as RecruiterRecord;
  if (!recruiter) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const recruiterId = recruiter.id;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_LIMIT));
  const cacheKey = `dashboard:recruiter:${recruiterId}:${page}:${limit}`;

  // Stale-while-revalidate: serve stale immediately, refresh in background
  const staleKey = `${cacheKey}:stale`;
  const staleData = memoryCache.get<DashboardData>(staleKey);
  if (staleData) {
    // Trigger background refresh (non-blocking)
    fetchDashboardData(recruiterId, page, limit)
      .then((data) => {
        memoryCache.set(cacheKey, data, DASHBOARD_CACHE_TTL);
        memoryCache.set(staleKey, data, STALE_TTL);
      })
      .catch(() => {});
    res.status(200).json({ success: true, data: staleData });
    return;
  }

  const freshData = memoryCache.get<DashboardData>(cacheKey);
  if (freshData) {
    memoryCache.set(staleKey, freshData, STALE_TTL);
    res.status(200).json({ success: true, data: freshData });
    return;
  }

  try {
    const data = await fetchDashboardData(recruiterId, page, limit);
    memoryCache.set(cacheKey, data, DASHBOARD_CACHE_TTL);
    memoryCache.set(staleKey, data, STALE_TTL);
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to load dashboard', 500, ErrorCodes.INTERNAL_ERROR);
  }
});