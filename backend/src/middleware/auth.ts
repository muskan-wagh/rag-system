import { Request, Response, NextFunction } from 'express';
import { createClerkClient } from '@clerk/backend';
import { config } from '@/config';
import { getOrCreateRecruiter } from '@/services/recruiter';
import { RecruiterRecord } from '@/services/supabase/database';
import { memoryCache } from '@/utils/memory-cache';
import { logger } from '@/utils/logger';

const clerkClient = createClerkClient({ secretKey: config.clerkSecretKey });

const PUBLIC_PATHS = ['/api/upload'];

const RECRUITER_CACHE_TTL = 300_000;

function isPublicPath(req: Request): boolean {
  return PUBLIC_PATHS.some((path) => req.path === path || req.path.startsWith(path + '/'));
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (isPublicPath(req)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = decodeJwtPayload(token);

  if (!payload || !payload.sub || typeof payload.sub !== 'string') {
    res.status(401).json({ success: false, error: 'Invalid token format' });
    return;
  }

  const clerkId = payload.sub;

  // Check in-memory cache first — avoids DB lookup on every request
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