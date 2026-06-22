import { Router } from 'express';
import {
  searchCandidatesHandler,
  compareCandidatesHandler,
  getCandidateHandler,
  batchCandidatesHandler,
} from '@/controllers/candidateController';

const router = Router();

router.post('/search', searchCandidatesHandler);
router.post('/compare', compareCandidatesHandler);
router.post('/batch', batchCandidatesHandler);
router.get('/:id', getCandidateHandler);

export default router;
