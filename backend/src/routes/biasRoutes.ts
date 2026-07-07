import { Router } from 'express';
import { scanBiasHandler } from '@/controllers/biasController';

const router = Router();

router.post('/scan-bias', scanBiasHandler);

export default router;
