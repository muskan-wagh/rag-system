import { Router } from 'express';
import {
  runScreeningHandler,
  getScreeningStatusHandler,
  listScreeningResultsHandler,
  getScreeningResultHandler,
  advanceScreeningHandler,
  rejectScreeningHandler,
} from '@/controllers/screeningController';
import { validate, screeningRunSchema, screeningOverrideSchema } from '@/middleware/validate';

const router = Router();

router.post('/:jobId/screening/run', validate(screeningRunSchema), runScreeningHandler);
router.get('/:jobId/screening/status', getScreeningStatusHandler);
router.get('/:jobId/screening/results', listScreeningResultsHandler);
router.get('/:jobId/screening/results/:candidateId', getScreeningResultHandler);
router.post('/:jobId/screening/:candidateId/advance', validate(screeningOverrideSchema), advanceScreeningHandler);
router.post('/:jobId/screening/:candidateId/reject', validate(screeningOverrideSchema), rejectScreeningHandler);

export default router;
