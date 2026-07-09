import { getRedisClient } from '@/services/redis/manager';
import { logger } from '@/utils/logger';

export async function getCached<T>(key: string): Promise<T | undefined> {
  const client = getRedisClient();
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
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'PX', ttlMs);
  } catch (err) {
    logger.warn('Cache set failed', { error: err });
  }
}
