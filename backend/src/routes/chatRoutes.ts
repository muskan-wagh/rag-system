import { Router } from 'express';
import { chatHandler } from '@/controllers/chatController';

const router = Router();

router.post('/', chatHandler);

export default router;
