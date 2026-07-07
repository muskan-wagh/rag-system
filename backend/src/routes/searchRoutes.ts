import { Router } from 'express';
import { searchCandidatesHandler } from '@/controllers/searchController';

const router = Router();

router.post('/search', searchCandidatesHandler);

export default router;
