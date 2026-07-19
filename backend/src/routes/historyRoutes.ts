import { Router } from 'express';
import { getHistoryHandler } from '@/controllers/historyController';

const router = Router();

router.get('/history', getHistoryHandler);

export default router;
