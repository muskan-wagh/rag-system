import { Router } from 'express';
import { generateLinkHandler, getSessionHandler } from '@/controllers/sessionController';
import { validate, jdTextSchema, idParamSchema } from '@/middleware/validate';

const router = Router();

router.post('/generate-link', validate(jdTextSchema), generateLinkHandler);
router.get('/sessions/:id', validate(idParamSchema, 'params'), getSessionHandler);

export default router;