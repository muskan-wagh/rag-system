import { Router } from 'express';
import { listJobsHandler, createJobHandler } from '@/controllers/assessmentController';
import {
  getJobConfigHandler,
  updateJobConfigHandler,
  jobHiringSummaryHandler,
  listJobCandidatesHandler,
  jobPipelineHandler,
} from '@/controllers/jobWorkflowController';
import { validate, createJobSchema, jobConfigSchema, jobIdParamSchema } from '@/middleware/validate';

/**
 * Jobs router: creation + selection, per-job progression config, and the
 * job-level hiring summary that powers clickable stage cards.
 */
const router = Router();

router.get('/', listJobsHandler);
router.post('/', validate(createJobSchema), createJobHandler);

router.get('/:jobId/config', validate(jobIdParamSchema, 'params'), getJobConfigHandler);
router.patch('/:jobId/config', validate(jobIdParamSchema, 'params'), validate(jobConfigSchema), updateJobConfigHandler);
router.get('/:jobId/hiring-summary', validate(jobIdParamSchema, 'params'), jobHiringSummaryHandler);
router.get('/:jobId/candidates', validate(jobIdParamSchema, 'params'), listJobCandidatesHandler);
router.get('/:jobId/pipeline', validate(jobIdParamSchema, 'params'), jobPipelineHandler);

export default router;
