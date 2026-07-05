import { Router } from 'express';
import {
  searchCandidatesHandler,
  compareCandidatesHandler,
  getCandidateHandler,
  batchCandidatesHandler,
  screeningQuestionsHandler,
  closingStrategyHandler,
} from '@/controllers/candidateController';

const router = Router();

router.post('/search', searchCandidatesHandler);
router.post('/compare', compareCandidatesHandler);
router.post('/batch', batchCandidatesHandler);
router.get('/:id', getCandidateHandler);
router.post('/:id/screening-questions', screeningQuestionsHandler);
router.post('/:id/closing-strategy', closingStrategyHandler);

export default router;
