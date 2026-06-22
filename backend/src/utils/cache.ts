const cache = new Map<string, { value: unknown; expiry: number }>();

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number = 300000): void {
  cache.set(key, { value, expiry: Date.now() + ttlMs });
}
