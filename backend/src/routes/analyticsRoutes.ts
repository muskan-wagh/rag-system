import { Router } from 'express';
import { getAnalyticsHandler } from '@/controllers/analyticsController';

const router = Router();

router.get('/', getAnalyticsHandler);

export default router;
