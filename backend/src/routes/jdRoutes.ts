import { Router } from 'express';
import { parseJdHandler } from '@/controllers/jdController';
import { validate, jdTextSchema } from '@/middleware/validate';

const router = Router();

router.post('/parse', validate(jdTextSchema), parseJdHandler);

export default router;