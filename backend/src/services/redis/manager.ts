import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

const REDIS_PLACEHOLDER = 'YOUR_UPSTASH_PASSWORD';

let client: Redis | null = null;
let isShuttingDown = false;

function isConfigured(): boolean {
  return !config.redis.url.includes(REDIS_PLACEHOLDER);
}

let clientOrigin = 'unknown';

export function setRedisClientOrigin(origin: string): void {
  clientOrigin = origin;
}

export function getRedisClient(): Redis | null {
  if (client) return client;
  if (!isConfigured()) return null;
  if (isShuttingDown) return null;

  logger.info(`Creating Redis client: ${clientOrigin}`);

  client = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (isShuttingDown) return null;
      if (times > 10) {
        logger.error('Redis: max retries exceeded, giving up');
        return null;
      }
      return Math.min(times * 200, 3000);
    },
    lazyConnect: true,
  });

  client.on('connect', () => logger.info('Redis client connected'));
  client.on('ready', () => logger.info('Redis client ready'));
  client.on('error', (err) => {
    if (err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOTFOUND')) {
      logger.error('Redis connection failed — check REDIS_URL in .env', { error: err.message });
    } else {
      logger.warn('Redis client error', { error: err.message });
    }
  });
  client.on('close', () => logger.warn('Redis client connection closed'));
  client.on('reconnecting', () => logger.info('Redis client reconnecting...'));

  return client;
}

export async function ensureRedisConnected(): Promise<Redis> {
  const r = getRedisClient();
  if (!r) {
    throw new Error('Redis is not configured. Set REDIS_URL in .env');
  }
  if (r.status !== 'ready' && r.status !== 'connecting' && r.status !== 'connect') {
    try {
      await r.connect();
    } catch (err: any) {
      throw new Error(`Cannot connect to Redis at ${config.redis.url}: ${err.message}`);
    }
  }
  return r;
}

export function shutdownRedis(): void {
  isShuttingDown = true;
  if (client) {
    client.disconnect();
    client = null;
  }
}

export function isRedisAvailable(): boolean {
  return isConfigured() && client !== null && client.status === 'ready';
}
