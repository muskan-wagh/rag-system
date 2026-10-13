import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { normalizeStage } from '@/services/hiring/stageTypes';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { listJobPipeline } from '@/services/hiring/jobApplicationService';

/**
 * Job-centric workflow endpoints (connected-hiring vertical slice).
 *
 * - GET/PATCH /jobs/:jobId/config — per-job progression_config
 *   (recruiter-controlled automation toggles; hire is never automatic).
 * - GET /jobs/:jobId/hiring-summary — the complete job-level picture
 *   from real DB state: stage counts, pass rates, pipeline, drop-offs.
 *
 * Data rules: screening <- screening_results; assessment <-
 * assessment_invites/attempts via job assessments; technical/HR <-
 * interviews/interview_evaluations (job-linked, falling back to
 * hiring_progression_events); final <- candidate_status_log +
 * hiring_progression_events. No duplicated state.
 */

export const DEFAULT_PROGRESSION_CONFIG = {
  screening_to_assessment: false,
  assessment_to_technical: false,
  technical_to_hr: false,
  hr_to_offer: false,
  assessment_auto_invite: false,
  interview_auto_invite: false,
  /**
   * Explicit, authorized override that lets a recruiter keep issuing
   * assessment invitations for a job they have closed. Fail-closed: absent,
   * non-boolean, or `false` all mean a closed job refuses invitations.
   *
   * Added by migration 20261008_job_lifecycle.sql, which backfills it to
   * `false` on every existing job.
   */
  allow_invites_when_closed: false,
} as const;

export type ProgressionConfig = typeof DEFAULT_PROGRESSION_CONFIG;

const CONFIG_KEYS = Object.keys(DEFAULT_PROGRESSION_CONFIG) as Array<
  keyof ProgressionConfig
>;

export function mergeProgressionConfig(raw: unknown): ProgressionConfig {
  const rec =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const merged: Record<string, boolean> = { ...DEFAULT_PROGRESSION_CONFIG };
  for (const key of CONFIG_KEYS) {
    if (typeof rec[key] === 'boolean') merged[key] = rec[key] as boolean;
  }
  return merged as ProgressionConfig;
}

async function requireOwnedJob(recruiterId: string, jobId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, description, progression_config')
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load job: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (!data) {
    throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);
  }
  return data as {
    id: string;
    title: string;
    description: string | null;
    progression_config: unknown;
  };
}

export const getJobConfigHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const jobId = String((req.params as Record<string, unknown>).jobId || '');
  const job = await requireOwnedJob(recruiterId, jobId);
  res.status(200).json({
    success: true,
    data: { jobId: job.id, progression_config: mergeProgressionConfig(job.progression_config) },
  });
});

export const updateJobConfigHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const jobId = String((req.params as Record<string, unknown>).jobId || '');
  await requireOwnedJob(recruiterId, jobId);
  const merged = mergeProgressionConfig((req.body as Record<string, unknown>)?.progression_config ?? req.body);
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('jobs')
    .update({ progression_config: merged })
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId);
  if (error) {
    throw new AppError(`Failed to save job config: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  res.status(200).json({ success: true, data: { jobId, progression_config: merged } });
});

// ---------- hiring summary ----------

export interface StageBucket {
  count: number;
  candidateIds: string[];
}

/**
 * Interview counts for ONE job.
 *
 * The previous implementation resolved interview invites with a bare
 * `.in('candidate_id', candidateIds)` — no job scoping — so a candidate who
 * was in technical interview for job B inflated job A's technical and HR
 * buckets, and evaluations were counted across every job the candidate had
 * ever touched. Every query here is now anchored to this job.
 */
async function countInterviewsForJob(
  jobId: string,
  memberIds: Set<string>,
): Promise<{ technical: { count: number; hrCount: number }; hr: { count: number; hrCount: number }; evalOutcomes: Record<string, number> }> {
  const supabase = getSupabaseClient();
  const empty = {
    technical: { count: 0, hrCount: 0 },
    hr: { count: 0, hrCount: 0 },
    evalOutcomes: {} as Record<string, number>,
  };
  if (memberIds.size === 0) return empty;

  // Interviews explicitly linked to this job.
  const { data: jobInterviews } = await supabase
    .from('interviews')
    .select('id, candidate_id')
    .eq('job_id', jobId);
  const interviews = ((jobInterviews || []) as Array<{ id: string; candidate_id: string }>).filter(
    (i) => memberIds.has(i.candidate_id),
  );
  const interviewIds = interviews.map((i) => i.id);

  // Interviews implied by this job's own progression events (legacy rows
  // written before `interviews.job_id` existed).
  const { data: progEvents } = await supabase
    .from('hiring_progression_events')
    .select('candidate_id, to_stage, status')
    .eq('job_id', jobId);
  const impliedCandidates = ((progEvents || []) as Array<{ candidate_id: string; to_stage: string; status: string }>)
    .filter((e) => ['Technical Round', 'Interview'].includes(normalizeStage(e.to_stage) ?? e.to_stage))
    .filter((e) => memberIds.has(e.candidate_id) && (e.status === 'completed' || e.status === 'pending'))
    .map((e) => e.candidate_id);

  let technicalCount = 0;
  let hrCount = 0;
  const invitedCandidates = new Set<string>();

  if (interviewIds.length > 0) {
    const { data: invites } = await supabase
      .from('interview_invites')
      .select('candidate_id, stage')
      .in('interview_id', interviewIds);
    for (const inv of (invites || []) as Array<{ candidate_id: string; stage: string }>) {
      if (!memberIds.has(inv.candidate_id)) continue;
      invitedCandidates.add(inv.candidate_id);
      if (normalizeStage(inv.stage) === 'Interview') hrCount += 1;
      else technicalCount += 1;
    }
  }
  // Candidates implied by progression but with no invite row yet still count
  // as technical pipeline.
  for (const cid of impliedCandidates) {
    if (!invitedCandidates.has(cid)) technicalCount += 1;
  }

  // Evaluations scoped to THIS job's interviews only.
  const evalOutcomes: Record<string, number> = {};
  if (interviewIds.length > 0) {
    const { data: evals } = await supabase
      .from('interview_evaluations')
      .select('overall_recommendation')
      .in('interview_id', interviewIds);
    for (const e of (evals || []) as Array<{ overall_recommendation: string }>) {
      evalOutcomes[e.overall_recommendation] = (evalOutcomes[e.overall_recommendation] || 0) + 1;
    }
  }

  return {
    technical: { count: technicalCount, hrCount },
    hr: { count: hrCount, hrCount },
    evalOutcomes,
  };
}

/** Map a progression to_stage to the canonical pipeline bucket. */
function bucketForStage(rawStage: string): string {
  // Normalized first so a pre-migration row still lands in the right bucket.
  // `Interview` previously meant "technical"; the 20261009 migration rewrote
  // those rows to `Technical Round`, and `normalizeStage` keeps the canonical
  // value distinct.
  switch (normalizeStage(rawStage)) {
    case 'Screening':
      return 'screening';
    case 'Shortlisted':
      return 'shortlisted';
    case 'Assessment':
      return 'assessment';
    case 'Technical Round':
      return 'technical';
    case 'Interview':
      return 'hr';
    case 'Final Decision':
      return 'finalDecision';
    case 'Hired':
      return 'hired';
    case 'Rejected':
    case 'Withdrawn':
    case 'Hold':
      return 'rejected';
    default:
      return 'applied';
  }
}

/**
 * GET /jobs/:jobId/candidates — the job's pipeline from `job_applications`.
 *
 * One row per candidate, so the same person can never appear twice for a job.
 * Ownership is enforced on the job before any candidate data is read.
 */
export const listJobCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const jobId = String((req.params as Record<string, unknown>).jobId || '');
  const query = req.query as Record<string, string | undefined>;
  await requireOwnedJob(recruiterId, jobId);

  const limit = Math.min(parseInt(query.limit || '100', 10) || 100, 500);
  const offset = Math.max(parseInt(query.offset || '0', 10) || 0, 0);

  const rows = await listJobPipeline(jobId, recruiterId, {
    stage: query.stage && query.stage !== 'all' ? query.stage : undefined,
    limit,
    offset,
  });

  res.status(200).json({ success: true, data: { jobId, candidates: rows, total: rows.length } });
});

/**
 * GET /jobs/:jobId/pipeline — stage buckets with counts, from the
 * authoritative application table.
 */
export const jobPipelineHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const jobId = String((req.params as Record<string, unknown>).jobId || '');
  await requireOwnedJob(recruiterId, jobId);

  const rows = await listJobPipeline(jobId, recruiterId, { limit: 10_000 });
  const counts: Record<string, number> = {};
  const byStage: Record<string, Array<{ id: string; name: string }>> = {};
  for (const row of rows) {
    const stage = String(row.stage || 'Applied');
    counts[stage] = (counts[stage] || 0) + 1;
    const bucket = (byStage[stage] ||= []);
    if (bucket.length < 200) {
      bucket.push({
        id: String(row.candidate_id),
        name: String(row.full_name || 'Unknown'),
      });
    }
  }

  res.status(200).json({ success: true, data: { jobId, total: rows.length, counts, byStage } });
});

export const jobHiringSummaryHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const jobId = String((req.params as Record<string, unknown>).jobId || '');
  await requireOwnedJob(recruiterId, jobId);
  const supabase = getSupabaseClient();

  // Job's assessments (assessment invites/attempts resolve via these).
  const { data: assessments } = await supabase
    .from('assessments')
    .select('id, status')
    .eq('job_id', jobId)
    .eq('recruiter_id', recruiterId);
  const assessmentIds = ((assessments || []) as Array<{ id: string; status: string }>).map((a) => a.id);
  const publishedAssessment = ((assessments || []) as Array<{ id: string; status: string }>).some(
    (a) => a.status === 'published',
  );

  // Screening truth for this job.
  const { data: screeningRows } = await supabase
    .from('screening_results')
    .select('candidate_id, overall, status')
    .eq('job_id', jobId);
  const screening = (screeningRows || []) as Array<{ candidate_id: string; overall: number; status: string }>;
  const screeningPassed = screening.filter((r) => r.status === 'passed').length;
  const screeningFailed = screening.filter((r) => r.status === 'failed').length;
  const screeningOverridden = screening.filter((r) => r.status === 'overridden').length;

  // Assessment invites + attempts for this job's assessments.
  let inviteRows: Array<{ candidate_id: string; status: string }> = [];
  let attemptRows: Array<{ candidate_id: string; status: string; passed: boolean | null }> = [];
  if (assessmentIds.length > 0) {
    const { data: invites } = await supabase
      .from('assessment_invites')
      .select('candidate_id, status')
      .in('assessment_id', assessmentIds);
    inviteRows = (invites || []) as Array<{ candidate_id: string; status: string }>;
    const { data: attempts } = await supabase
      .from('assessment_attempts')
      .select('candidate_id, status, passed')
      .in('assessment_id', assessmentIds);
    attemptRows = (attempts || []) as Array<{ candidate_id: string; status: string; passed: boolean | null }>;
  }
  const assessmentInvited = new Set(inviteRows.map((i) => i.candidate_id)).size;
  const assessmentStarted = attemptRows.filter((a) => a.status === 'in_progress').length;
  const assessmentSubmitted = attemptRows.filter((a) => a.status === 'submitted' || a.status === 'evaluated');
  const assessmentPassed = assessmentSubmitted.filter((a) => a.passed === true).length;
  const invitedSet = new Set(inviteRows.map((i) => i.candidate_id));
  const attemptedSet = new Set(attemptRows.map((a) => a.candidate_id));

  // Candidate membership comes from `job_applications` — the authoritative
  // (job, candidate) table with a UNIQUE constraint.
  //
  // It previously had to be inferred by unioning screening results,
  // assessment invites, attempts, interviews and progression events, which
  // double-counted candidates (a candidate appearing in several evidence
  // tables) and let cross-job records bleed into a job's stage buckets
  // (interview invites were fetched by `.in('candidate_id', ...)` with no
  // job scoping at all).
  const pipelineRows = await listJobPipeline(jobId, recruiterId, { limit: 10_000 });
  const allCandidateIds = new Set<string>(
    pipelineRows.map((r) => String(r.candidate_id)).filter(Boolean),
  );

  // Evidence below is now strictly JOINED to this job.
  const { technical, hr, evalOutcomes } = await countInterviewsForJob(jobId, allCandidateIds);
  const technicalCount = technical.count;
  const hrCount = technical.hrCount;

  // Current stage per candidate is the application row itself — one row,
  // one stage, so buckets are mutually exclusive by construction.
  const buckets: Record<string, StageBucket> = {
    applied: { count: 0, candidateIds: [] },
    screening: { count: 0, candidateIds: [] },
    // Shortlisted is its own bucket: it is a real recruiter decision between
    // screening and assessment, and folding it into 'applied' made the
    // shortlisting stage invisible in the job summary.
    shortlisted: { count: 0, candidateIds: [] },
    assessment: { count: 0, candidateIds: [] },
    technical: { count: 0, candidateIds: [] },
    hr: { count: 0, candidateIds: [] },
    finalDecision: { count: 0, candidateIds: [] },
    hired: { count: 0, candidateIds: [] },
    rejected: { count: 0, candidateIds: [] },
  };
  const push = (bucket: string, id: string) => {
    const b = buckets[bucket] || buckets.applied;
    b.count += 1;
    if (b.candidateIds.length < 200) b.candidateIds.push(id);
  };
  for (const row of pipelineRows) {
    const id = String(row.candidate_id);
    const stage = String(row.stage || 'Applied');
    push(bucketForStage(stage), id);
    // Per-candidate refinement using this job's own evidence.
    if (attemptedSet.has(id) || invitedSet.has(id)) {
      if (bucketForStage(stage) === 'screening') {
        buckets.screening.count -= 1;
        buckets.screening.candidateIds = buckets.screening.candidateIds.filter((c) => c !== id);
        push('assessment', id);
      }
    }
  }

  const total = allCandidateIds.size;
  const passRate = (passed: number, denom: number) =>
    denom === 0 ? 0 : Math.round((passed / denom) * 1000) / 10;

  res.status(200).json({
    success: true,
    data: {
      jobId,
      total,
      stages: {
        applied: buckets.applied.count,
        screening: buckets.screening.count,
        assessment: buckets.assessment.count,
        technical: buckets.technical.count,
        hr: buckets.hr.count,
        finalDecision: buckets.finalDecision.count,
        hired: buckets.hired.count,
        rejected: buckets.rejected.count,
      },
      // Candidate id samples (capped) so each stage card can deep-link.
      stageCandidates: {
        applied: buckets.applied.candidateIds,
        screening: buckets.screening.candidateIds,
        assessment: buckets.assessment.candidateIds,
        technical: buckets.technical.candidateIds,
        hr: buckets.hr.candidateIds,
        finalDecision: buckets.finalDecision.candidateIds,
        hired: buckets.hired.candidateIds,
        rejected: buckets.rejected.candidateIds,
      },
      screening: {
        screened: screening.length,
        passed: screeningPassed,
        failed: screeningFailed,
        overridden: screeningOverridden,
        passRate: passRate(screeningPassed, screening.length),
      },
      assessment: {
        templatePublished: publishedAssessment,
        invited: assessmentInvited,
        started: assessmentStarted,
        completed: assessmentSubmitted.length,
        passed: assessmentPassed,
        passRate: passRate(assessmentPassed, assessmentSubmitted.length),
      },
      technical: { count: technicalCount + hrCount, technical: technicalCount, hr: hrCount, evalOutcomes },
      final: {
        decisions: buckets.finalDecision.count,
        hired: buckets.hired.count,
        rejected: buckets.rejected.count,
      },
      dropOffs: {
        screeningFailed: screeningFailed,
        assessmentNotPassed: Math.max(0, assessmentSubmitted.length - assessmentPassed),
        rejected: buckets.rejected.count,
      },
    },
  });
});
