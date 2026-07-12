import { Router } from 'express';
import { getDashboardHandler } from '@/controllers/dashboardController';
import { getCandidatesPageHandler } from '@/controllers/candidatesPageController';

const router = Router();

router.get('/dashboard', getDashboardHandler);
router.get('/candidates-page', getCandidatesPageHandler);

export default router;
