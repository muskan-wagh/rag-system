import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisAvailable } from '@/services/redis/manager';
import { logger } from '@/utils/logger';
import { ErrorCodes } from './errorCodes';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10);
const LLM_MAX = parseInt(process.env.RATE_LIMIT_LLM_MAX ?? '15', 10);

const LLM_PATHS = ['/api/jd/', '/api/candidates/search', '/api/candidates/compare'];

function isLlmPath(path: string): boolean {
  return LLM_PATHS.some((p) => path.includes(p));
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (!isRedisAvailable()) {
    return next();
  }

  const client = getRedisClient()!;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const path = req.path;
  const limit = isLlmPath(path) ? LLM_MAX : MAX_REQUESTS;
  const key = `ratelimit:${ip}`;

  client
    .multi()
    .set(key, 0, 'PX', WINDOW_MS, 'NX')
    .incr(key)
    .exec()
    .then((results) => {
      if (!results) return next();
      const count = results[1][1] as number;
      if (count > limit) {
        return client.pttl(key).then((ttl) => {
          const retryAfter = Math.ceil(ttl / 1000);
          logger.warn('Rate limit exceeded', { ip, path, count, limit });
          res.status(429).json({
            success: false,
            code: ErrorCodes.RATE_LIMITED,
            error: `Too many requests. Try again in ${retryAfter}s.`,
          });
        });
      }
      next();
    })
    .catch((err) => {
      logger.warn('Rate limiter error, allowing request', { error: err.message });
      next();
    });
}
