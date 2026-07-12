import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { CandidateRecord, SessionStats } from '@/services/supabase/database';

function computeStats(candidates: CandidateRecord[]): SessionStats {
  const stats: SessionStats = { total: candidates.length, pending: 0, shortlisted: 0, interview: 0, rejected: 0, hired: 0 };
  const interviewStatuses = new Set(['interview', 'screening', 'technical interview', 'hr interview']);
  for (const c of candidates) {
    const s = (c.current_status || 'Pending').toLowerCase();
    if (s === 'pending' || s === 'applied') stats.pending++;
    else if (s === 'shortlisted') stats.shortlisted++;
    else if (interviewStatuses.has(s)) stats.interview++;
    else if (s === 'rejected') stats.rejected++;
    else if (s === 'hired') stats.hired++;
    else stats.pending++;
  }
  return stats;
}

export const getDashboardHandler = asyncHandler(async (_req: Request, res: Response) => {
  const supabase = getSupabaseClient();

  // Step 1: Find the latest session
  const { data: sessions, error: sessionError } = await supabase
    .from('upload_sessions')
    .select('id, job_description_text, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (sessionError) {
    throw new AppError('Failed to load dashboard', 500, ErrorCodes.DATABASE_ERROR);
  }

  if (!sessions || sessions.length === 0) {
    res.status(200).json({
      success: true,
      data: {
        session: null,
        candidates: [],
        stats: { total: 0, pending: 0, shortlisted: 0, interview: 0, rejected: 0, hired: 0 },
      },
    });
    return;
  }

  const latestSession = sessions[0];

  // Step 2: Fetch candidates for this session
  const { data: candidates, error: candidatesError } = await supabase
    .from('candidates')
    .select('id, upload_session_id, full_name, email, phone, location, current_company, current_title, total_experience_years, resume_file_url, flight_risk, growth_trajectory, current_status, created_at, processing_status, source, error_message')
    .eq('upload_session_id', latestSession.id);

  if (candidatesError) {
    throw new AppError('Failed to load candidates', 500, ErrorCodes.DATABASE_ERROR);
  }

  const candidateList = (candidates || []) as CandidateRecord[];
  const stats = computeStats(candidateList);

  res.status(200).json({
    success: true,
    data: {
      session: {
        id: latestSession.id,
        job_description_text: latestSession.job_description_text,
        created_at: latestSession.created_at,
        link: `/upload/${latestSession.id}`,
      },
      candidates: candidateList,
      stats,
    },
  });
});
