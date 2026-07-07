import { Router } from 'express';
import { scanBiasHandler } from '@/controllers/biasController';
import { validate, jdTextSchema } from '@/middleware/validate';

const router = Router();

router.post('/scan-bias', validate(jdTextSchema), scanBiasHandler);

export default router;