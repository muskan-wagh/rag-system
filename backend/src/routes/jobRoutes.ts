import { Router } from 'express';
import { listJobsHandler, createJobHandler } from '@/controllers/assessmentController';
import {
  getJobConfigHandler,
  updateJobConfigHandler,
  jobHiringSummaryHandler,
  listJobCandidatesHandler,
  jobPipelineHandler,
} from '@/controllers/jobWorkflowController';
import {
  getWorkspaceHandler,
  listShortlistedHandler,
  getJourneyHandler,
  getShortlistEligibilityHandler,
  shortlistHandler,
  unshortlistHandler,
  decisionHandler,
  assessmentPermissionHandler,
  setJobStatusHandler,
  updateAutomationHandler,
  applicationContextHandler,
} from '@/controllers/workspaceController';
import { validate, createJobSchema, jobConfigSchema, jobIdParamSchema } from '@/middleware/validate';

/**
 * Jobs router.
 *
 * The standalone `/jobs` FRONTEND page was removed and its functionality folded
 * into the Assessments workspace, but every backend route here is preserved and
 * extended. Nothing was deleted: job creation, per-job progression config, the
 * hiring summary, the candidate list and the pipeline view all still work and
 * are still what the workspace reads.
 *
 * New in this file:
 *   • job lifecycle (open/closed) and per-job automation overrides
 *   • the workspace payload — one round trip for the whole recruitment pipeline
 *   • the job-scoped shortlisted list (assessment eligibility)
 *   • shortlist / un-shortlist / recruiter-decision transitions
 *   • the unified per-candidate journey view
 */
const router = Router();

router.get('/', listJobsHandler);
router.post('/', validate(createJobSchema), createJobHandler);

// ── job lifecycle ────────────────────────────────────────────────────────────
router.patch('/:jobId/status', validate(jobIdParamSchema, 'params'), setJobStatusHandler);
router.patch('/:jobId/automation', validate(jobIdParamSchema, 'params'), updateAutomationHandler);

// ── workspace ────────────────────────────────────────────────────────────────
router.get('/:jobId/workspace', validate(jobIdParamSchema, 'params'), getWorkspaceHandler);
router.get('/:jobId/shortlisted', validate(jobIdParamSchema, 'params'), listShortlistedHandler);
router.get('/:jobId/applications/:candidateId/journey', validate(jobIdParamSchema, 'params'), getJourneyHandler);
router.get(
  '/:jobId/applications/:candidateId/context',
  validate(jobIdParamSchema, 'params'),
  applicationContextHandler,
);

// ── shortlist ────────────────────────────────────────────────────────────────
router.get(
  '/:jobId/applications/:candidateId/shortlist-eligibility',
  validate(jobIdParamSchema, 'params'),
  getShortlistEligibilityHandler,
);
router.post(
  '/:jobId/applications/:candidateId/shortlist',
  validate(jobIdParamSchema, 'params'),
  shortlistHandler,
);
router.delete(
  '/:jobId/applications/:candidateId/shortlist',
  validate(jobIdParamSchema, 'params'),
  unshortlistHandler,
);

// ── recruiter decisions ──────────────────────────────────────────────────────
router.get(
  '/:jobId/applications/:candidateId/assessment-permission',
  validate(jobIdParamSchema, 'params'),
  assessmentPermissionHandler,
);
router.post(
  '/:jobId/applications/:candidateId/decision',
  validate(jobIdParamSchema, 'params'),
  decisionHandler,
);

// ── pre-existing job reads (unchanged) ───────────────────────────────────────
router.get('/:jobId/config', validate(jobIdParamSchema, 'params'), getJobConfigHandler);
router.patch('/:jobId/config', validate(jobIdParamSchema, 'params'), validate(jobConfigSchema), updateJobConfigHandler);
router.get('/:jobId/hiring-summary', validate(jobIdParamSchema, 'params'), jobHiringSummaryHandler);
router.get('/:jobId/candidates', validate(jobIdParamSchema, 'params'), listJobCandidatesHandler);
router.get('/:jobId/pipeline', validate(jobIdParamSchema, 'params'), jobPipelineHandler);

export default router;