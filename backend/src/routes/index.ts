import { Router } from 'express';
import jdRoutes from './jdRoutes';
import candidateRoutes from './candidateRoutes';
import sessionRoutes from './sessionRoutes';
import uploadRoutes from './uploadRoutes';
import biasRoutes from './biasRoutes';
import dashboardRoutes from './dashboardRoutes';
import historyRoutes from './historyRoutes';

import {
  listSavedSearchesHandler,
  createSavedSearchHandler,
  updateSavedSearchHandler,
  deleteSavedSearchHandler,
  listTalentPoolsHandler,
  createTalentPoolHandler,
  getTalentPoolHandler,
  updateTalentPoolHandler,
  deleteTalentPoolHandler,
  addCandidateToPoolHandler,
  removeCandidateFromPoolHandler,
  listSearchHistoryHandler,
} from '@/controllers/searchController';

const router = Router();

router.use('/jd', jdRoutes);
router.use('/candidates', candidateRoutes);

// Root-level routers
router.use('/', dashboardRoutes);
router.use('/', sessionRoutes);
router.use('/', uploadRoutes);
router.use('/', biasRoutes);
router.use('/', historyRoutes);

// Search & talent-pool routes (inlined to avoid Express 5 router.use('/', subRouter) cascading issues)
router.get('/saved-searches', listSavedSearchesHandler);
router.post('/saved-searches', createSavedSearchHandler);
router.put('/saved-searches/:id', updateSavedSearchHandler);
router.delete('/saved-searches/:id', deleteSavedSearchHandler);

router.get('/talent-pools', listTalentPoolsHandler);
router.post('/talent-pools', createTalentPoolHandler);
router.get('/talent-pools/:id', getTalentPoolHandler);
router.put('/talent-pools/:id', updateTalentPoolHandler);
router.delete('/talent-pools/:id', deleteTalentPoolHandler);
router.post('/talent-pools/:id/candidates', addCandidateToPoolHandler);
router.delete('/talent-pools/:id/candidates/:candidateId', removeCandidateFromPoolHandler);

router.get('/search-history', listSearchHistoryHandler);

export default router;
