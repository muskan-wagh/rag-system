import { Router } from 'express';
import {
  gmailStatusHandler,
  gmailAuthUrlHandler,
  gmailCallbackHandler,
  gmailDisconnectHandler,
} from '@/controllers/gmailController';

const router = Router();

router.get('/status', gmailStatusHandler);
router.get('/auth-url', gmailAuthUrlHandler);
// Public: Google redirects here without a Clerk token (state binds recruiter).
router.get('/callback', gmailCallbackHandler);
router.post('/disconnect', gmailDisconnectHandler);

export default router;
