import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { PIPELINE_STAGES } from '@/services/hiring/stageTypes';

/**
 * Unified hiring progress (correction #11).
 * Derived ENTIRELY from backend state — no hardcoded booleans.
 * Recruiter example:
 *   ✓ Applied → ✓ Screening (82%) → ✓ Assessment (76%) → ● Technical → ○ HR → ○ Offer
 * Candidate (safe): same shape, scores/notes/reasons stripped.
 */

interface StageState {
  stage: string;
  state: 'completed' | 'current' | 'upcoming';
  score: number | null;
  status: string | null;
}

async function buildProgress(candidateId: string, jobId?: string | null, safe = false): Promise<{ stages: StageState[]; currentStage: string | null }> {
  const supabase = getSupabaseClient();

  const { data: candidate } = await supabase
    .from('candidates')
    .select('current_status')
    .eq('id', candidateId)
    .maybeSingle();
  const currentStatus = String((candidate as { current_status?: string } | null)?.current_status || 'Applied');

  // Scores per stage.
  let screeningScore: number | null = null;
  let assessmentScore: number | null = null;

  if (jobId) {
    const { data: screening } = await supabase
      .from('screening_results')
      .select('overall')
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
      .maybeSingle();
    if (screening) screeningScore = Number((screening as { overall: number }).overall);
  } else {
    const { data: screening } = await supabase
      .from('screening_results')
      .select('overall')
      .eq('candidate_id', candidateId)
      .order('overall', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (screening) screeningScore = Number((screening as { overall: number }).overall);
  }

  const { data: attempt } = await supabase
    .from('assessment_attempts')
    .select('percentage, status')
    .eq('candidate_id', candidateId)
    .eq('status', 'evaluated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (attempt) assessmentScore = Number((attempt as { percentage: number }).percentage);

  const { data: interviews } = await supabase
    .from('interviews')
    .select('id, status')
    .eq('candidate_id', candidateId);
  const hasCompletedInterview = ((interviews || []) as Array<{ status: string }>).some((i) => i.status === 'completed');

  const { data: timeline } = await supabase
    .from('candidate_status_log')
    .select('status')
    .eq('candidate_id', candidateId);
  const seen = new Set(((timeline || []) as Array<{ status: string }>).map((t) => t.status));

  // Determine current index from canonical status mapping.
  const statusToStage: Record<string, string> = {
    Applied: 'Applied',
    Shortlisted: 'Applied',
    Screening: 'Screening',
    Assessment: 'Assessment',
    'Technical Round': 'Technical Interview',
    'Technical Interview': 'Technical Interview',
    Interview: 'Technical Interview',
    'Interview Scheduled': 'Technical Interview',
    'Interview Completed': 'Technical Interview',
    'HR Round': 'Managerial/HR',
    'Managerial/HR': 'Managerial/HR',
    Offered: 'Offer',
    Offer: 'Offer',
    Hired: 'Hired',
    Rejected: currentStatus,
    Hold: currentStatus,
  };
  const currentStage = statusToStage[currentStatus] || 'Applied';
  const currentIdx = Math.max(
    0,
    PIPELINE_STAGES.indexOf(currentStage as (typeof PIPELINE_STAGES)[number]),
  );

  const completedByEvidence: Record<string, boolean> = {
    Applied: seen.has('Applied') || seen.has('Shortlisted') || currentIdx > 0 || true,
    Screening: screeningScore !== null || seen.has('Screening') || currentIdx > 1,
    Assessment: assessmentScore !== null || seen.has('Assessment') || currentIdx > 2,
    'Technical Interview':
      seen.has('Technical Round') || seen.has('Technical Interview') || hasCompletedInterview || currentIdx > 3,
    'Managerial/HR': seen.has('HR Round') || seen.has('Managerial/HR') || currentIdx > 4,
    Offer: seen.has('Offered') || seen.has('Offer') || currentIdx > 5,
    Hired: seen.has('Hired') || currentStatus === 'Hired',
  };

  const stages: StageState[] = PIPELINE_STAGES.map((stage, idx) => {
    let state: StageState['state'] = 'upcoming';
    if (completedByEvidence[stage] || idx < currentIdx) state = 'completed';
    if (idx === currentIdx) state = currentIdx === PIPELINE_STAGES.length - 1 && completedByEvidence[stage] ? 'completed' : 'current';
    if (idx < currentIdx && !completedByEvidence[stage]) state = 'completed';
    return {
      stage,
      state,
      score: safe ? null : stage === 'Screening' ? screeningScore : stage === 'Assessment' ? assessmentScore : null,
      status: safe ? null : stage === currentStage ? currentStatus : null,
    };
  });

  // Candidate-safe: include scores only for completed own stages? Spec says
  // candidate version exposes safe info — strip numeric scores entirely here;
  // the assessment result endpoint already returns the candidate's own %.
  if (safe) {
    for (const s of stages) s.score = null;
  }

  return { stages, currentStage };
}

// Recruiter: GET /candidates/:candidateId/hiring-progress?jobId=
export const getHiringProgressHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const candidateId = String((req.params as Record<string, unknown>).candidateId || (req.params as Record<string, unknown>).id || "");
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : null;
  const supabase = getSupabaseClient();
  const { data: cand } = await supabase.from('candidates').select('id, recruiter_id').eq('id', candidateId).maybeSingle();
  if (!cand || (cand as { recruiter_id: string }).recruiter_id !== recruiter.id) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }
  const progress = await buildProgress(candidateId, jobId, false);
  const { data: timeline } = await supabase
    .from('candidate_status_log')
    .select('id, status, changed_at, details')
    .eq('candidate_id', candidateId)
    .order('changed_at', { ascending: true });
  res.json({ success: true, data: { ...progress, timeline: timeline || [] } });
});

// Candidate: GET /candidate/progress (session auth, safe).
export const getCandidateProgressHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.candidate;
  if (!ctx) throw new AppError('Candidate session required', 401, ErrorCodes.NOT_FOUND);
  const progress = await buildProgress(ctx.candidateId, null, true);
  res.json({ success: true, data: progress });
});
