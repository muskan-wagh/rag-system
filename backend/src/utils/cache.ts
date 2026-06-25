const cache = new Map<string, { value: unknown; expiry: number }>();
const MAX_ENTRIES = 500;
const accessOrder: string[] = [];

function touchKey(key: string): void {
  const idx = accessOrder.indexOf(key);
  if (idx !== -1) {
    accessOrder.splice(idx, 1);
  }
  accessOrder.push(key);
}

function evictLRU(): void {
  while (cache.size > MAX_ENTRIES) {
    const oldest = accessOrder.shift();
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
}

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    const idx = accessOrder.indexOf(key);
    if (idx !== -1) accessOrder.splice(idx, 1);
    return undefined;
  }
  touchKey(key);
  return entry.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number = 300000): void {
  cache.set(key, { value, expiry: Date.now() + ttlMs });
  touchKey(key);
  evictLRU();
}
