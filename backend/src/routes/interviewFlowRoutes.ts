import { Router } from 'express';
import {
  getInterviewStageHandler,
  scheduleStageInterviewHandler,
  submitEvaluationHandler,
  exchangeInterviewTokenHandler,
  getCandidateInterviewHandler,
  rescheduleInterviewHandler,
  cancelInterviewHandler,
  resendInterviewInviteHandler,
  updateInterviewStatusHandler,
} from '@/controllers/interviewFlowController';
import {
  listInterviewProblemsHandler,
  getCodingSessionHandler,
  pushCodingProblemHandler,
  resetCodingSessionHandler,
  runCodingSessionHandler,
  endInterviewHandler,
  getCandidateCodingSessionHandler,
  updateCandidateCodeHandler,
  runCandidateCodeHandler,
} from '@/controllers/interviewLiveController';
import {
  postCandidateLivekitTokenHandler,
  postCandidateVideoEventHandler,
  postRecruiterLivekitTokenHandler,
} from '@/controllers/interviewVideoController';
import { candidateAuthMiddleware } from '@/middleware/candidateAuth';
import {
  validate,
  interviewEvaluationSchema,
  scheduleStageInterviewSchema,
  rescheduleInterviewSchema,
  interviewStatusSchema,
  pushCodingProblemSchema,
  updateLiveCodeSchema,
  runLiveCodeSchema,
  videoEventSchema,
} from '@/middleware/validate';

const router = Router();

// Recruiter-scoped (mounted under /candidates/:candidateId — Clerk auth via parent).
export const interviewStageRecruiterRouter = Router({ mergeParams: true });
interviewStageRecruiterRouter.get('/interview-stage', getInterviewStageHandler);
interviewStageRecruiterRouter.post(
  '/interview-stage/schedule',
  validate(scheduleStageInterviewSchema),
  scheduleStageInterviewHandler,
);

// Recruiter evaluation + interview lifecycle (mounted under /interviews).
export const interviewEvaluationRouter = Router();
interviewEvaluationRouter.post(
  '/:interviewId/evaluation',
  validate(interviewEvaluationSchema),
  submitEvaluationHandler,
);
interviewEvaluationRouter.patch(
  '/:interviewId/schedule',
  validate(rescheduleInterviewSchema),
  rescheduleInterviewHandler,
);
interviewEvaluationRouter.post('/:interviewId/cancel', cancelInterviewHandler);
interviewEvaluationRouter.post('/:interviewId/resend', resendInterviewInviteHandler);
interviewEvaluationRouter.patch('/:interviewId/status', validate(interviewStatusSchema), updateInterviewStatusHandler);

// Recruiter live-coding (mounted under /interviews).
export const interviewLiveRecruiterRouter = Router();
interviewLiveRecruiterRouter.get('/problems', listInterviewProblemsHandler);
interviewLiveRecruiterRouter.get('/:interviewId/coding-session', getCodingSessionHandler);
interviewLiveRecruiterRouter.post(
  '/:interviewId/coding-session/problem',
  validate(pushCodingProblemSchema),
  pushCodingProblemHandler,
);
interviewLiveRecruiterRouter.post('/:interviewId/coding-session/reset', resetCodingSessionHandler);
interviewLiveRecruiterRouter.post(
  '/:interviewId/coding-session/run',
  validate(runLiveCodeSchema),
  runCodingSessionHandler,
);
interviewLiveRecruiterRouter.post('/:interviewId/end', endInterviewHandler);
// Interviewer video token (LiveKit video layer only — coding/WS untouched).
interviewLiveRecruiterRouter.post('/:interviewId/livekit-token', postRecruiterLivekitTokenHandler);

// Candidate (public exchange + session authed status + live coding).
export const interviewCandidateRouter = Router();
interviewCandidateRouter.post('/interview/exchange', exchangeInterviewTokenHandler);
interviewCandidateRouter.get('/interview', candidateAuthMiddleware, getCandidateInterviewHandler);
interviewCandidateRouter.get('/interview/coding-session', candidateAuthMiddleware, getCandidateCodingSessionHandler);
interviewCandidateRouter.patch(
  '/interview/coding-session/code',
  candidateAuthMiddleware,
  validate(updateLiveCodeSchema),
  updateCandidateCodeHandler,
);
interviewCandidateRouter.post(
  '/interview/coding-session/run',
  candidateAuthMiddleware,
  validate(runLiveCodeSchema),
  runCandidateCodeHandler,
);
// Candidate video token + observable a/v signals (LiveKit video layer only).
interviewCandidateRouter.post('/interview/livekit-token', candidateAuthMiddleware, postCandidateLivekitTokenHandler);
interviewCandidateRouter.post(
  '/interview/video-event',
  candidateAuthMiddleware,
  validate(videoEventSchema),
  postCandidateVideoEventHandler,
);

export default router;
