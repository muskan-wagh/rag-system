import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { RecruiterRecord } from '@/services/supabase/database';
import { logger } from '@/utils/logger';
import { getCached, setCache } from '@/utils/cache';

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

interface NeedsReviewItem {
  id: string;
  full_name: string | null;
  current_title: string | null;
  current_company: string | null;
  match_score: number | null;
  created_at: string | null;
  days_since_applied: number;
}

interface AiRecommendation {
  id: string;
  full_name: string | null;
  current_title: string | null;
  current_company: string | null;
  match_score: number | null;
  skills: string[];
}

interface UpcomingInterview {
  id: string;
  candidate_id: string;
  candidate_name: string | null;
  candidate_title: string | null;
  interview_type: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  meeting_link: string;
}

interface RecentActivityItem {
  id: string;
  type: 'status_change' | 'search' | 'note' | 'interview' | 'upload' | 'offer' | 'view';
  description: string;
  candidate_name: string | null;
  created_at: string;
}

interface TopTalentPool {
  id: string;
  name: string;
  candidate_count: number;
  average_score: number;
  new_count: number;
  updated_at: string;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  action: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
}

interface DashboardData {
  stats: DashboardStats;
  recentUploads: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  candidatesRequiringReview: NeedsReviewItem[];
  aiRecommendedCandidates: AiRecommendation[];
  upcomingInterviews: UpcomingInterview[];
  recentActivity: RecentActivityItem[];
  topTalentPools: TopTalentPool[];
  quickActions: QuickAction[];
}

async function fetchNeedsReview(supabase: ReturnType<typeof getSupabaseClient>, recruiterId: string): Promise<NeedsReviewItem[]> {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('candidates')
    .select('id, full_name, current_title, current_company, created_at')
    .eq('recruiter_id', recruiterId)
    .eq('current_status', 'Applied')
    .lt('created_at', fortyEightHoursAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((c) => {
    const created = c.created_at as string | null;
    const daysSince = created
      ? Math.floor((Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      id: c.id as string,
      full_name: c.full_name as string | null,
      current_title: c.current_title as string | null,
      current_company: c.current_company as string | null,
      match_score: null,
      created_at: created,
      days_since_applied: daysSince,
    };
  });
}

async function fetchAiRecommendations(supabase: ReturnType<typeof getSupabaseClient>, recruiterId: string): Promise<AiRecommendation[]> {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, full_name, current_title, current_company')
    .eq('recruiter_id', recruiterId)
    .not('current_status', 'in', '(' + ['Rejected', 'Hired'].map(s => `"${s}"`).join(',') + ')')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  const candidates = data as Array<{ id: string; full_name: string | null; current_title: string | null; current_company: string | null }>;
  const candidateIds = candidates.map((c) => c.id);

  const { data: skillsData } = await supabase
    .from('candidate_skills')
    .select('candidate_id, skill_name')
    .in('candidate_id', candidateIds);

  const skillsMap = new Map<string, string[]>();
  if (skillsData) {
    for (const row of skillsData) {
      const arr = skillsMap.get(row.candidate_id) || [];
      arr.push(row.skill_name);
      skillsMap.set(row.candidate_id, arr);
    }
  }

  return candidates.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    current_title: c.current_title,
    current_company: c.current_company,
    match_score: null,
    skills: skillsMap.get(c.id) || [],
  }));
}

async function fetchUpcomingInterviews(supabase: ReturnType<typeof getSupabaseClient>, recruiterId: string): Promise<UpcomingInterview[]> {
  const todayStr = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('interviews')
    .select('id, candidate_id, interview_type, scheduled_date, scheduled_time, status, meeting_link')
    .eq('status', 'scheduled')
    .gte('scheduled_date', todayStr)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
    .limit(5);

  if (error || !data) return [];

  const interviews = data as Array<Record<string, unknown>>;
  const candidateIds = interviews.map((i) => i.candidate_id as string).filter(Boolean);

  const { data: candidatesData } = await supabase
    .from('candidates')
    .select('id, full_name, current_title')
    .in('id', candidateIds);

  const nameMap = new Map<string, { full_name: string | null; current_title: string | null }>();
  if (candidatesData) {
    for (const c of candidatesData as Array<{ id: string; full_name: string | null; current_title: string | null }>) {
      nameMap.set(c.id, c);
    }
  }

  return interviews.map((i) => {
    const cand = nameMap.get(i.candidate_id as string);
    return {
      id: i.id as string,
      candidate_id: i.candidate_id as string,
      candidate_name: cand?.full_name ?? null,
      candidate_title: cand?.current_title ?? null,
      interview_type: (i.interview_type as string) || '',
      scheduled_date: (i.scheduled_date as string) || '',
      scheduled_time: (i.scheduled_time as string) || '',
      status: (i.status as string) || '',
      meeting_link: (i.meeting_link as string) || '',
    };
  });
}

async function fetchRecentActivity(supabase: ReturnType<typeof getSupabaseClient>, recruiterId: string): Promise<RecentActivityItem[]> {
  const activity: RecentActivityItem[] = [];

  const { data: statusLogs } = await supabase
    .from('candidate_status_log')
    .select('id, candidate_id, status, details, changed_at')
    .order('changed_at', { ascending: false })
    .limit(5);

  if (statusLogs) {
    const logCandIds = [...new Set((statusLogs as Array<Record<string, unknown>>).map((l) => l.candidate_id as string))];
    const { data: logCands } = await supabase
      .from('candidates')
      .select('id, full_name')
      .in('id', logCandIds);
    const logNameMap = new Map<string, string>();
    if (logCands) {
      for (const c of logCands as Array<{ id: string; full_name: string | null }>) {
        logNameMap.set(c.id, c.full_name || 'Unknown');
      }
    }
    for (const log of statusLogs as Array<Record<string, unknown>>) {
      activity.push({
        id: `status-${log.id}`,
        type: 'status_change',
        description: `Status changed to ${log.status}`,
        candidate_name: logNameMap.get(log.candidate_id as string) || null,
        created_at: log.changed_at as string,
      });
    }
  }

  const { data: searchHist } = await supabase
    .from('search_history')
    .select('id, jd_text, result_count, created_at')
    .eq('recruiter_id', recruiterId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (searchHist) {
    for (const s of searchHist as Array<Record<string, unknown>>) {
      activity.push({
        id: `search-${s.id}`,
        type: 'search',
        description: `Search — ${(s.jd_text as string || '').slice(0, 60)}${(s.jd_text as string || '').length > 60 ? '...' : ''} (${s.result_count} results)`,
        candidate_name: null,
        created_at: s.created_at as string,
      });
    }
  }

  activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return activity.slice(0, 10);
}

async function fetchTopTalentPools(supabase: ReturnType<typeof getSupabaseClient>, recruiterId: string): Promise<TopTalentPool[]> {
  const { data, error } = await supabase
    .from('talent_pools')
    .select(`
      id, name, updated_at,
      talent_pool_candidates!inner(match_score)
    `)
    .eq('recruiter_id', recruiterId)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((p) => {
    const poolCands = (p.talent_pool_candidates as Array<{ match_score: number | null }> | undefined) || [];
    const scores = poolCands.map((c) => c.match_score ?? 0).filter((s) => s > 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const newCount = poolCands.filter((c) => c.match_score === null).length;
    return {
      id: p.id as string,
      name: p.name as string,
      candidate_count: poolCands.length,
      average_score: Math.round(avgScore),
      new_count: newCount,
      updated_at: p.updated_at as string,
    };
  });
}

function deriveQuickActions(
  stats: DashboardStats,
  needsReviewCount: number,
  upcomingInterviews: UpcomingInterview[],
): QuickAction[] {
  const actions: QuickAction[] = [];

  if (needsReviewCount > 0) {
    actions.push({
      id: 'review-pending',
      label: 'Review Pending Candidates',
      description: `${needsReviewCount} candidate${needsReviewCount > 1 ? 's' : ''} waiting for review`,
      action: 'scroll-to-needs-review',
      icon: 'users',
      priority: 'high',
    });
  }

  if (upcomingInterviews.length > 0) {
    const today = upcomingInterviews.filter((i) => i.scheduled_date === new Date().toISOString().split('T')[0]);
    if (today.length > 0) {
      actions.push({
        id: 'today-interviews',
        label: `${today.length} Interview${today.length > 1 ? 's' : ''} Today`,
        description: today.map((i) => i.candidate_name || 'Unknown').join(', '),
        action: 'scroll-to-interviews',
        icon: 'calendar',
        priority: 'high',
      });
    }
  }

  if (stats.offered > 0) {
    actions.push({
      id: 'pending-offers',
      label: `${stats.offered} Pending Offer${stats.offered > 1 ? 's' : ''}`,
      description: 'Follow up with offered candidates',
      action: 'navigate-offers',
      icon: 'briefcase',
      priority: 'medium',
    });
  }

  actions.push({
    id: 'new-session',
    label: 'New Hiring Session',
    description: 'Create a new AI-powered hiring session',
    action: 'scroll-to-workspace',
    icon: 'sparkles',
    priority: 'medium',
  });

  return actions;
}

async function fetchDashboardData(recruiterId: string, page: number, limit: number): Promise<DashboardData> {
  const supabase = getSupabaseClient();
  const offset = (page - 1) * limit;

  const [needsReview, aiRecommendations, upcomingInterviews, recentActivity, topTalentPools] = await Promise.all([
    fetchNeedsReview(supabase, recruiterId),
    fetchAiRecommendations(supabase, recruiterId),
    fetchUpcomingInterviews(supabase, recruiterId),
    fetchRecentActivity(supabase, recruiterId),
    fetchTopTalentPools(supabase, recruiterId),
  ]);

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

    const stats: DashboardStats = {
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
    };

    const quickActions = deriveQuickActions(stats, needsReview.length, upcomingInterviews);

    return {
      stats,
      recentUploads: (recentResult.data || []).map((c: Record<string, unknown>) => c),
      sessions: (sessionsResult.data || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        job_description_text: (s.job_description_text as string || '').slice(0, 100),
        created_at: s.created_at,
      })),
      candidatesRequiringReview: needsReview,
      aiRecommendedCandidates: aiRecommendations,
      upcomingInterviews,
      recentActivity,
      topTalentPools,
      quickActions,
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

  const stats: DashboardStats = {
    totalCandidates,
    uploadedToday,
    activeSessions: (sessionsResult.data || []).length,
    searches,
    open, applied, screening, interview,
    interviewsToday, offered, hired, rejected,
  };

  const quickActions = deriveQuickActions(stats, needsReview.length, upcomingInterviews);

  return {
    stats,
    recentUploads: allCandidates.slice(0, limit),
    sessions: (sessionsResult.data || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      job_description_text: (s.job_description_text as string || '').slice(0, 100),
      created_at: s.created_at,
    })),
    candidatesRequiringReview: needsReview,
    aiRecommendedCandidates: aiRecommendations,
    upcomingInterviews,
    recentActivity,
    topTalentPools,
    quickActions,
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
  const staleKey = `${cacheKey}:stale`;

  const [freshData, staleData] = await Promise.all([
    getCached<DashboardData>(cacheKey),
    getCached<DashboardData>(staleKey),
  ]);

  if (freshData) {
    setCache(staleKey, freshData, STALE_TTL);
    res.status(200).json({ success: true, data: freshData });
    return;
  }

  if (staleData) {
    fetchDashboardData(recruiterId, page, limit)
      .then((data) => {
        setCache(cacheKey, data, DASHBOARD_CACHE_TTL);
        setCache(staleKey, data, STALE_TTL);
      })
      .catch(() => {});
    res.status(200).json({ success: true, data: staleData });
    return;
  }

  try {
    const data = await fetchDashboardData(recruiterId, page, limit);
    setCache(cacheKey, data, DASHBOARD_CACHE_TTL);
    setCache(staleKey, data, STALE_TTL);
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to load dashboard', 500, ErrorCodes.INTERNAL_ERROR);
  }
});