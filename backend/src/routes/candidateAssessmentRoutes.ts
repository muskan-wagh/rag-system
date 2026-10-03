import { Router } from 'express';
import {
  exchangeTokenHandler,
  getAssessmentHandler,
  saveAnswerHandler,
  runCodeHandler,
  submitAttemptHandler,
  sessionCheckHandler,
} from '@/controllers/candidateAssessmentController';
import { candidateAuthMiddleware } from '@/middleware/candidateAuth';
import { validate, candidateAttemptParamSchema, saveAnswerSchema, runCodeSchema, exchangeTokenSchema } from '@/middleware/validate';

const router = Router();

// Public: single token exchange (issues HttpOnly session cookie).
router.post('/assessment/exchange', validate(exchangeTokenSchema), exchangeTokenHandler);

// Session check (reads cookie; no auth middleware so 401 is JSON not throw).
router.get('/session', sessionCheckHandler);

// All below require the candidate session cookie.
router.get('/assessment', candidateAuthMiddleware, getAssessmentHandler);
router.patch(
  '/attempts/:attemptId/answers',
  candidateAuthMiddleware,
  validate(candidateAttemptParamSchema, 'params'),
  validate(saveAnswerSchema),
  saveAnswerHandler,
);
router.post(
  '/attempts/:attemptId/code/run',
  candidateAuthMiddleware,
  validate(candidateAttemptParamSchema, 'params'),
  validate(runCodeSchema),
  runCodeHandler,
);
router.post(
  '/attempts/:attemptId/submit',
  candidateAuthMiddleware,
  validate(candidateAttemptParamSchema, 'params'),
  submitAttemptHandler,
);

export default router;
