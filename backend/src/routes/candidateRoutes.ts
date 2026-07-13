import { Router } from 'express';
import {
  searchCandidatesHandler,
  compareCandidatesHandler,
  getCandidateHandler,
  batchCandidatesHandler,
  screeningQuestionsHandler,
  closingStrategyHandler,
  updateCandidateStatusHandler,
  addCandidateNoteHandler,
  getCandidateNotesHandler,
  getSimilarCandidatesHandler,
  getAllCandidatesHandler,
  scheduleInterviewHandler,
  getCandidateInterviewsHandler,
  updateInterviewHandler,
  makeOfferHandler,
  acceptOfferHandler,
  rejectCandidateHandler,
  sendInterviewEmailHandler,
  getCandidateTimelineHandler,
} from '@/controllers/candidateController';
import {
  validate,
  searchSchema,
  compareSchema,
  batchSchema,
  updateStatusSchema,
  addNoteSchema,
  idParamSchema,
  scheduleInterviewSchema,
  updateInterviewSchema,
  rejectCandidateSchema,
  makeOfferSchema,
} from '@/middleware/validate';

const router = Router();

router.get('/', getAllCandidatesHandler);
router.post('/search', validate(searchSchema), searchCandidatesHandler);
router.post('/compare', validate(compareSchema), compareCandidatesHandler);
router.post('/batch', validate(batchSchema), batchCandidatesHandler);
router.get('/:id', validate(idParamSchema, 'params'), getCandidateHandler);
router.patch('/:id/status', validate(idParamSchema, 'params'), validate(updateStatusSchema), updateCandidateStatusHandler);
router.post('/:id/notes', validate(idParamSchema, 'params'), validate(addNoteSchema), addCandidateNoteHandler);
router.get('/:id/notes', validate(idParamSchema, 'params'), getCandidateNotesHandler);
router.post('/:id/screening-questions', validate(idParamSchema, 'params'), screeningQuestionsHandler);
router.post('/:id/closing-strategy', validate(idParamSchema, 'params'), closingStrategyHandler);
router.post('/:id/interviews', validate(idParamSchema, 'params'), validate(scheduleInterviewSchema), scheduleInterviewHandler);
router.get('/:id/interviews', validate(idParamSchema, 'params'), getCandidateInterviewsHandler);
router.patch('/:id/interviews/:interviewId', validate(idParamSchema, 'params'), validate(updateInterviewSchema), updateInterviewHandler);
router.post('/:id/offer', validate(idParamSchema, 'params'), validate(makeOfferSchema), makeOfferHandler);
router.post('/:id/hire', validate(idParamSchema, 'params'), acceptOfferHandler);
router.post('/:id/reject', validate(idParamSchema, 'params'), validate(rejectCandidateSchema), rejectCandidateHandler);
router.post('/:id/send-email', validate(idParamSchema, 'params'), sendInterviewEmailHandler);
router.get('/:id/timeline', validate(idParamSchema, 'params'), getCandidateTimelineHandler);
router.get('/:id/similar', validate(idParamSchema, 'params'), getSimilarCandidatesHandler);

export default router;