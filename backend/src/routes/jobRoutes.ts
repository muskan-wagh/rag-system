import { Router } from 'express';
import { listJobsHandler, createJobHandler } from '@/controllers/assessmentController';
import { validate, createJobSchema } from '@/middleware/validate';

/**
 * Minimal jobs router — creation + selection only, scoped to what the
 * assessment setup needs. No full Jobs management UI/API here.
 */
const router = Router();

router.get('/', listJobsHandler);
router.post('/', validate(createJobSchema), createJobHandler);

export default router;
