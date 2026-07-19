import { Router } from 'express';
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
