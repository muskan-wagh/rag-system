import { Router } from 'express';
import { searchCandidatesHandler, compareCandidatesHandler } from '@/controllers/candidateController';

const router = Router();

router.post('/search', searchCandidatesHandler);
router.post('/compare', compareCandidatesHandler);

export default router;
