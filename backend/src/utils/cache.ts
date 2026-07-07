import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

const REDIS_PLACEHOLDER = 'YOUR_UPSTASH_PASSWORD';
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (config.redis.url.includes(REDIS_PLACEHOLDER)) {
    logger.warn('Redis not configured — cache disabled. Set REDIS_URL in .env');
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
  redis.on('error', (err) => {
    logger.warn('Cache Redis error', { error: err.message });
  });
  return redis;
}

export async function getCached<T>(key: string): Promise<T | undefined> {
  const client = getRedis();
  if (!client) return undefined;
  try {
    const val = await client.get(key);
    if (val) return JSON.parse(val) as T;
  } catch {
    // cache miss
  }
  return undefined;
}

export async function setCache<T>(key: string, value: T, ttlMs: number = 300000): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'PX', ttlMs);
  } catch (err) {
    logger.warn('Cache set failed', { error: err });
  }
}
