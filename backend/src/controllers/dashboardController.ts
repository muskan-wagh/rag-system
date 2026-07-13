import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { CandidateRecord, getNewSessionStats } from '@/services/supabase/database';

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
        stats: { open: 0, screening: 0, interviewsToday: 0, offered: 0, hired: 0, rejected: 0 },
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

  // Step 3: Get new stats (open, screening, interviewsToday, offered, hired, rejected)
  const stats = await getNewSessionStats(latestSession.id);

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
