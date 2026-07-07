import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

const CHANNEL = 'app:events';
const REDIS_PLACEHOLDER = 'YOUR_UPSTASH_PASSWORD';

let pubClient: Redis | null = null;

function getPubClient(): Redis | null {
  if (pubClient) return pubClient;
  if (config.redis.url.includes(REDIS_PLACEHOLDER)) {
    return null;
  }
  pubClient = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });
  pubClient.on('error', (err) => {
    logger.warn('Events pub client error', { error: err.message });
  });
  return pubClient;
}

export function publishEvent(event: string, payload: Record<string, unknown>): void {
  const client = getPubClient();
  if (!client) return;
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  client.publish(CHANNEL, message).catch(() => {});
}
