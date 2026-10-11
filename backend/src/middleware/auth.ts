import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';
import { config } from '@/config';
import { getOrCreateRecruiter } from '@/services/recruiter';
import { RecruiterRecord } from '@/services/supabase/database';
import { memoryCache } from '@/utils/memory-cache';
import { logger } from '@/utils/logger';

const PUBLIC_PATHS = ['/', '/health', '/api/upload', '/api/gmail/callback', '/api/integrations/gmail/callback', '/api/candidate'];

const RECRUITER_CACHE_TTL = 300_000;

function isPublicPath(req: Request): boolean {
  return PUBLIC_PATHS.some((path) => req.path === path || req.path.startsWith(path + '/'));
}

/**
 * Verify a Clerk session token's SIGNATURE, expiry, issuer and audience.
 *
 * The previous implementation base64-decoded the payload without checking the
 * signature, which meant any attacker-authored three-part JWT with a `sub`
 * claim was accepted as a valid recruiter identity. Verification is mandatory:
 * an unverified token is never trusted, even if it looks structurally valid.
 */
export async function verifyClerkToken(
  token: string,
): Promise<{ clerkId: string } | { error: string }> {
  try {
    const payload = await verifyToken(token, { secretKey: config.clerkSecretKey });
    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') {
      return { error: 'Token missing subject claim' };
    }
    return { clerkId: sub };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Never echo the raw token or internal verification detail to the client.
    logger.warn('[auth] Clerk token verification failed', { message });
    return { error: 'Invalid or expired token' };
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Allow CORS preflight to pass through — browsers never send
  // Authorization on OPTIONS, cors() middleware already handles the response.
  if (req.method === 'OPTIONS') {
    return next();
  }

  if (isPublicPath(req)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  // Signature/expiry/audience verification. Never trust a decoded-but-unverified
  // payload: `getOrCreateRecruiter` auto-provisions, so an unverified `sub`
  // would let an attacker mint themselves a recruiter account.
  const verification = await verifyClerkToken(token);
  if ('error' in verification) {
    res.status(401).json({ success: false, error: verification.error });
    return;
  }
  const clerkId = verification.clerkId;

  // Check in-memory cache first — avoids DB lookup on every request.
  // Only reached AFTER successful signature verification.
  const cacheKey = `recruiter:clerk:${clerkId}`;
  const cached = memoryCache.get<RecruiterRecord>(cacheKey);
  if (cached) {
    req.recruiter = cached;
    next();
    return;
  }

  try {
    const recruiter = await getOrCreateRecruiter({ clerkId });
    memoryCache.set(cacheKey, recruiter, RECRUITER_CACHE_TTL);
    req.recruiter = recruiter;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[auth] Failed to get or create recruiter', { message, clerkId });
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}