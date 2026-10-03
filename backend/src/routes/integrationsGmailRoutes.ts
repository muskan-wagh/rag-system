import { Router } from 'express';
import {
  gmailGetHandler,
  gmailConnectHandler,
  gmailCallbackHandler,
  gmailDeleteHandler,
  gmailAuthUrlHandler,
} from '@/controllers/gmailController';

const router = Router();

// Canonical Gmail integration endpoints (spec-compliant).
router.get('/', gmailGetHandler);
// Spec example: redirect straight to Google's consent screen.
router.get('/connect', gmailConnectHandler);
// JSON variant for popup flows (Settings card + outreach modal can use either).
router.get('/auth-url', gmailAuthUrlHandler);
// Public: Google redirects here without a Clerk token (state binds recruiter).
router.get('/callback', gmailCallbackHandler);
// Idempotent disconnect (revokes at Google best-effort, clears encrypted store).
router.delete('/', gmailDeleteHandler);

export default router;
