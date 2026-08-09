import { config } from "@/lib/config";

/**
 * Small key/value cache with a Redis backend when REDIS_URL is set and an
 * in-process LRU otherwise. Redis is loaded lazily so the app runs with no
 * Redis installed at all.
 */

interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  readonly name: string;
}

class MemoryCache implements CacheBackend {
  readonly name = "memory";
  private store = new Map<string, { value: string; expiresAt: number }>();
  constructor(private maxEntries = 5000) {}

  async get(key: string): Promise<string | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    // Refresh recency for the LRU eviction below.
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

class RedisCache implements CacheBackend {
  readonly name = "redis";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private client: any) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, "EX", Math.max(1, Math.floor(ttlSeconds)));
    } catch {
      /* cache failures must never break a request */
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      /* ignore */
    }
  }
}

const globalForCache = globalThis as unknown as { __patCache?: CacheBackend };

function backend(): CacheBackend {
  if (globalForCache.__patCache) return globalForCache.__patCache;

  let instance: CacheBackend = new MemoryCache();
  if (config.redisUrl) {
    try {
      // Required lazily: ioredis is optional at runtime.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require("ioredis");
      const client = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 2,
        lazyConnect: false,
        enableOfflineQueue: false,
      });
      client.on("error", () => {
        /* handled per-operation; avoid unhandled error events */
      });
      instance = new RedisCache(client);
    } catch {
      instance = new MemoryCache();
    }
  }
  globalForCache.__patCache = instance;
  return instance;
}

export const cache = {
  get backendName(): string {
    return backend().name;
  },

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await backend().get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await backend().set(key, JSON.stringify(value), ttlSeconds);
  },

  async del(key: string): Promise<void> {
    await backend().del(key);
  },

  /** Get-or-compute with single-flight de-duplication per process. */
  async remember<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;

    const inflight = inflightMap.get(key);
    if (inflight) return inflight as Promise<T>;

    const promise = (async () => {
      try {
        const value = await fn();
        await this.setJson(key, value, ttlSeconds);
        return value;
      } finally {
        inflightMap.delete(key);
      }
    })();

    inflightMap.set(key, promise);
    return promise;
  },
};

const inflightMap = new Map<string, Promise<unknown>>();

export const cacheKeys = {
  ownership: (registration: string) => `ownership:v2:${registration.toUpperCase()}`,
  photo: (registration: string) => `photo:v1:${registration.toUpperCase()}`,
  liveCell: (key: string) => `live:v1:${key}`,
  aircraftIdentity: (registration: string) => `identity:v1:${registration.toUpperCase()}`,
};
