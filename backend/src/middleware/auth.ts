import { Request, Response, NextFunction } from 'express';
import { createClerkClient } from '@clerk/backend';
import { config } from '@/config';
import { getOrCreateRecruiter } from '@/services/recruiter';
import { logger } from '@/utils/logger';

const clerkClient = createClerkClient({ secretKey: config.clerkSecretKey });

const PUBLIC_PATHS = ['/api/upload'];

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

  try {
    const recruiter = await getOrCreateRecruiter({ clerkId });
    req.recruiter = recruiter;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[auth] Failed to get or create recruiter', { message, clerkId });
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}