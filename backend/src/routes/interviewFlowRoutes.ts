import { Router } from 'express';
import {
  getInterviewStageHandler,
  scheduleStageInterviewHandler,
  submitEvaluationHandler,
  exchangeInterviewTokenHandler,
  getCandidateInterviewHandler,
} from '@/controllers/interviewFlowController';
import { candidateAuthMiddleware } from '@/middleware/candidateAuth';
import { validate, interviewEvaluationSchema, scheduleStageInterviewSchema } from '@/middleware/validate';

const router = Router();

// Recruiter-scoped (mounted under /candidates/:candidateId — Clerk auth via parent).
export const interviewStageRecruiterRouter = Router({ mergeParams: true });
interviewStageRecruiterRouter.get('/interview-stage', getInterviewStageHandler);
interviewStageRecruiterRouter.post(
  '/interview-stage/schedule',
  validate(scheduleStageInterviewSchema),
  scheduleStageInterviewHandler,
);

// Recruiter evaluation (mounted under /interviews).
export const interviewEvaluationRouter = Router();
interviewEvaluationRouter.post(
  '/:interviewId/evaluation',
  validate(interviewEvaluationSchema),
  submitEvaluationHandler,
);

// Candidate (public exchange + session authed status).
export const interviewCandidateRouter = Router();
interviewCandidateRouter.post('/interview/exchange', exchangeInterviewTokenHandler);
interviewCandidateRouter.get('/interview', candidateAuthMiddleware, getCandidateInterviewHandler);

export default router;
