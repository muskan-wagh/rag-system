import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { ErrorCodes } from './errorCodes';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10);
const LLM_MAX = parseInt(process.env.RATE_LIMIT_LLM_MAX ?? '15', 10);

const LLM_PATHS = ['/api/jd/', '/api/candidates/search', '/api/candidates/compare'];

const REDIS_PLACEHOLDER = 'YOUR_UPSTASH_PASSWORD';

function isLlmPath(path: string): boolean {
  return LLM_PATHS.some((p) => path.includes(p));
}

let redis: Redis | null = null;
let redisReady = false;

function getRedis(): Redis | null {
  if (redisReady) return redis;
  if (redis) return redis;

  if (config.redis.url.includes(REDIS_PLACEHOLDER)) {
    logger.warn('Redis not configured — rate limiter disabled. Set REDIS_URL in .env');
    return null;
  }

  redis = new Redis(config.redis.url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

  redis.on('ready', () => { redisReady = true; });
  redis.on('error', (err) => {
    logger.warn('Rate limiter Redis error', { error: err.message });
  });

  return redis;
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const client = getRedis();
  if (!client || !redisReady) {
    return next();
  }

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
