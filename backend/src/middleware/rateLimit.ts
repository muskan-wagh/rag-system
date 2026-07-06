import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { config } from '@/config';

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10);
const LLM_MAX = parseInt(process.env.RATE_LIMIT_LLM_MAX ?? '15', 10);

const LLM_PATHS = ['/api/jd/', '/api/candidates/search', '/api/candidates/compare'];

function isLlmPath(path: string): boolean {
  return LLM_PATHS.some((p) => path.includes(p));
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (parseInt(config.port.toString(), 10) === 0) {
    return next();
  }

  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const path = req.path;

  const entry = windows.get(ip);
  if (!entry || now > entry.resetAt) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  const limit = isLlmPath(path) ? LLM_MAX : MAX_REQUESTS;

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    logger.warn('Rate limit exceeded', { ip, path, count: entry.count, limit });

    res.status(429).json({
      success: false,
      error: `Too many requests. Try again in ${retryAfter}s.`,
    });
    return;
  }

  entry.count++;
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) {
      windows.delete(key);
    }
  }
}, 60_000);
