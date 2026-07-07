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
} from '@/controllers/candidateController';

const router = Router();

router.post('/search', searchCandidatesHandler);
router.post('/compare', compareCandidatesHandler);
router.post('/batch', batchCandidatesHandler);
router.get('/:id', getCandidateHandler);
router.patch('/:id/status', updateCandidateStatusHandler);
router.post('/:id/notes', addCandidateNoteHandler);
router.get('/:id/notes', getCandidateNotesHandler);
router.post('/:id/screening-questions', screeningQuestionsHandler);
router.post('/:id/closing-strategy', closingStrategyHandler);
router.get('/:id/similar', getSimilarCandidatesHandler);

export default router;
