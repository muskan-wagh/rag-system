import { getRedisClient } from '@/services/redis/manager';

const CHANNEL = 'app:events';

export function publishEvent(event: string, payload: Record<string, unknown>): void {
  const client = getRedisClient();
  if (!client) return;
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  client.publish(CHANNEL, message).catch(() => {});
}
