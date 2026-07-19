class MemoryCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  private cleanupTimer: NodeJS.Timeout;
  private maxSize: number;

  constructor(private defaultTTL: number = 30_000, maxSize = 5000) {
    this.maxSize = maxSize;
    this.cleanupTimer = setInterval(() => this.cleanup(), 10_000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.store.clear();
  }
}

export const memoryCache = new MemoryCache();
