import { Router } from 'express';
import { generateLinkHandler, getSessionHandler } from '@/controllers/sessionController';

const router = Router();

router.post('/generate-link', generateLinkHandler);
router.get('/sessions/:id', getSessionHandler);

export default router;
