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
} from '@/controllers/candidateController';
import {
  validate,
  searchSchema,
  compareSchema,
  batchSchema,
  updateStatusSchema,
  addNoteSchema,
  idParamSchema,
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
router.get('/:id/similar', validate(idParamSchema, 'params'), getSimilarCandidatesHandler);

export default router;