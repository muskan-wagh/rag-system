import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import {
  loadWorkspace,
  listShortlistedForAssessment,
  loadCandidateJourney,
} from '@/services/hiring/assessmentWorkspace';
import {
  shortlistCandidate,
  reverseShortlist,
  checkShortlistEligibility,
} from '@/services/hiring/shortlistService';
import { makeRecruiterDecision, isRecruiterDecision, nextDecisionFor, canSendAssessmentTo } from '@/services/hiring/decisionService';
import { setJobStatus, JOB_STATUS } from '@/services/hiring/jobLifecycleService';
import { getApplicationRecord } from '@/services/hiring/applicationService';
import { mergeProgressionConfig } from '@/controllers/jobWorkflowController';
import { getSupabaseClient } from '@/services/supabase/client';

/**
 * Job-scoped recruitment workspace endpoints.
 *
 * These power the single Assessments workspace that replaced the fragmented
 * Shortlisting / Assessments / Coding rounds / Interviews sections. Every route
 * is keyed by a job id and resolves ownership from it, so one job's data can
 * never surface in another's workflow.
 */

function recruiterIdOf(req: Request): string {
  const id = req.recruiter?.id as string | undefined;
  if (!id) throw new AppError('Authentication required', 401, ErrorCodes.UNAUTHORIZED);
  return id;
}

/**
 * GET /api/jobs/:jobId/workspace
 * Everything the workspace renders for the selected job, in one round trip.
 */
export const getWorkspaceHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;

  const workspace = await loadWorkspace({ recruiterId, jobId });

  res.status(200).json({
    success: true,
    data: workspace,
  });
});

/**
 * GET /api/jobs/:jobId/shortlisted
 * The eligible assessment list — only candidates a recruiter shortlisted on
 * THIS job.
 */
export const listShortlistedHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 200));

  const rows = await listShortlistedForAssessment({ recruiterId, jobId, limit });

  res.status(200).json({
    success: true,
    data: { jobId, candidates: rows, total: rows.length },
  });
});

/**
 * GET /api/jobs/:jobId/applications/:candidateId/journey
 * The unified recruitment timeline for one candidate on one job.
 */
export const getJourneyHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;
  const candidateId = req.params.candidateId as string;

  const journey = await loadCandidateJourney({ recruiterId, jobId, candidateId });

  res.status(200).json({ success: true, data: journey });
});

/**
 * GET /api/jobs/:jobId/applications/:candidateId/shortlist-eligibility
 * Whether the Shortlist button should be enabled, and why not when it is not.
 */
export const getShortlistEligibilityHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;
  const candidateId = req.params.candidateId as string;

  const eligibility = await checkShortlistEligibility({ recruiterId, jobId, candidateId });

  res.status(200).json({ success: true, data: eligibility });
});

/**
 * POST /api/jobs/:jobId/applications/:candidateId/shortlist
 * Shortlist for THIS job only.
 *
 * Idempotent: pressing the button twice creates one event, because the trigger
 * id is derived from the application row.
 */
export const shortlistHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;
  const candidateId = req.params.candidateId as string;
  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 2000) : undefined;

  const result = await shortlistCandidate({ recruiterId, jobId, candidateId, note });

  res.status(result.changed ? 201 : 200).json({
    success: true,
    data: {
      applicationId: result.applicationId,
      jobId: result.jobId,
      candidateId: result.candidateId,
      stage: result.toStage,
      previousStage: result.fromStage,
      changed: result.changed,
      deduplicated: result.deduplicated,
      usedOverride: result.usedOverride,
      screeningScore: result.screeningScore,
      shortlistedAt: result.changed ? new Date().toISOString() : null,
      message: result.changed
        ? 'Candidate shortlisted for this job.'
        : 'Candidate is already shortlisted for this job.',
    },
  });
});

/**
 * DELETE /api/jobs/:jobId/applications/:candidateId/shortlist
 * Reverse a shortlist. Audited, not erased — the original decision stays in the
 * timeline and on the application row.
 */
export const unshortlistHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;
  const candidateId = req.params.candidateId as string;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 2000) : undefined;
  const toStage = req.body?.toStage === 'Applied' ? 'Applied' : 'Screening';

  const result = await reverseShortlist({ recruiterId, jobId, candidateId, toStage, reason });

  res.status(200).json({
    success: true,
    data: {
      applicationId: result.applicationId,
      stage: result.toStage,
      changed: result.changed,
      message: result.changed
        ? `Shortlist reversed — candidate moved back to ${result.toStage}.`
        : 'Candidate is not shortlisted.',
    },
  });
});

/**
 * POST /api/jobs/:jobId/applications/:candidateId/decision
 * Explicit recruiter decision: advance, hold or reject.
 */
export const decisionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;
  const candidateId = req.params.candidateId as string;
  const decision = req.body?.decision;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 2000) : undefined;
  const interviewerName =
    typeof req.body?.interviewerName === 'string' ? req.body.interviewerName.slice(0, 200) : undefined;

  if (!isRecruiterDecision(decision)) {
    throw new AppError(
      'decision must be one of: Technical Round, Interview, Final Decision, Hold, Rejected',
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  // Score context is recorded for the audit trail only. It never chooses the
  // destination — that is the whole point of this endpoint existing.
  const scoreContext =
    decision === 'Technical Round' && req.body?.percentage != null
      ? {
          percentage: Number(req.body.percentage),
          passed: req.body.passed != null ? Boolean(req.body.passed) : null,
          assessmentId: req.body.assessmentId ? String(req.body.assessmentId) : null,
        }
      : undefined;

  const result = await makeRecruiterDecision({
    recruiterId,
    jobId,
    candidateId,
    decision,
    reason,
    interviewerName,
    scoreContext,
  });

  res.status(result.changed ? 200 : 200).json({
    success: true,
    data: {
      ...result,
      availableDecisions: nextDecisionFor(result.toStage),
      message: result.changed
        ? `Candidate moved to ${result.toStage}.`
        : `Candidate is already at ${result.toStage}.`,
    },
  });
});

/**
 * GET /api/jobs/:jobId/applications/:candidateId/assessment-permission
 * Whether assessment actions are still valid for this candidate, with a reason.
 */
export const assessmentPermissionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;
  const candidateId = req.params.candidateId as string;

  const permission = await canSendAssessmentTo(recruiterId, jobId, candidateId);

  res.status(200).json({ success: true, data: permission });
});

/**
 * PATCH /api/jobs/:jobId/status
 * Open or close a job. Closing preserves every record.
 */
export const setJobStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;
  const status = req.body?.status;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;

  if (status !== JOB_STATUS.OPEN && status !== JOB_STATUS.CLOSED) {
    throw new AppError('status must be "open" or "closed"', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const result = await setJobStatus({ recruiterId, jobId, status, reason });

  res.status(200).json({
    success: true,
    data: {
      ...result,
      message:
        status === JOB_STATUS.CLOSED
          ? `"${result.title}" is closed. No new applications, invitations or progression. All existing candidates, assessments, interviews and reports are preserved and readable.`
          : `"${result.title}" is open and accepting applications again.`,
    },
  });
});

/**
 * PATCH /api/jobs/:jobId/automation
 * Toggle the per-job progression rules, including the closed-job invite override.
 */
export const updateAutomationHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;

  const { data: job } = await getSupabaseClient()
    .from('jobs')
    .select('progression_config')
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();

  if (!job) throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);

  const merged = mergeProgressionConfig(req.body?.progression_config ?? req.body);

  const { error } = await getSupabaseClient()
    .from('jobs')
    .update({ progression_config: merged })
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId);

  if (error) {
    throw new AppError(`Failed to update job settings: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  res.status(200).json({ success: true, data: { jobId, progression_config: merged } });
});

/**
 * GET /api/jobs/:jobId/applications/:candidateId/context
 * Everything the candidate-profile panel needs in one call: authoritative
 * stage, shortlist audit, screening score, available decisions.
 */
export const applicationContextHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = recruiterIdOf(req);
  const jobId = req.params.jobId as string;
  const candidateId = req.params.candidateId as string;

  const application = await getApplicationRecord(jobId, candidateId);
  if (!application) throw new AppError('Candidate is not in this job', 404, ErrorCodes.NOT_FOUND);

  const workspace = await loadWorkspace({ recruiterId, jobId, limit: 2000 });
  const row = workspace.pipeline.find((p) => p.candidateId === candidateId);

  res.status(200).json({
    success: true,
    data: {
      job: { id: workspace.job.id, title: workspace.job.title, status: workspace.job.status },
      readOnly: workspace.readOnly,
      application: {
        id: application.id,
        stage: row?.stage ?? application.current_stage,
        stageChangedAt: application.stage_changed_at ?? null,
        shortlistedAt: application.shortlisted_at ?? null,
        shortlistedBy: application.shortlisted_by ?? null,
        shortlistNote: application.shortlist_note ?? '',
        source: application.source,
        appliedAt: application.applied_at,
      },
      screening: row?.screening ?? null,
      assessment: row?.assessment ?? null,
      interview: row?.interview ?? null,
      availableDecisions: nextDecisionFor(row?.stage ?? application.current_stage),
    },
  });
});