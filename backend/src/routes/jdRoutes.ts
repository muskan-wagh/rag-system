import { Router } from 'express';
import { parseJdHandler } from '@/controllers/jdController';

const router = Router();

router.post('/parse', parseJdHandler);

export default router;
