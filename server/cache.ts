import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let isRedisConnected = false;

// In-memory fallback cache when Redis is not available or during local dev
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

export function isRedisActive(): boolean {
  return isRedisConnected;
}

export async function initRedis(): Promise<RedisClientType | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[Cache] REDIS_URL not provided. Using in-memory fallback cache.');
    return null;
  }

  try {
    const client: RedisClientType = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            console.warn('[Redis] Max reconnection attempts reached. Continuing with MemoryStore fallback.');
            return false;
          }
          return Math.min(retries * 200, 2000);
        },
      },
    });

    client.on('error', (err) => {
      console.warn('[Redis Client Warning]', err.message || err);
      isRedisConnected = false;
    });

    client.on('connect', () => {
      console.log('[Redis] Connected successfully to', redisUrl);
      isRedisConnected = true;
    });

    client.on('ready', () => {
      isRedisConnected = true;
    });

    await client.connect();
    redisClient = client;
    isRedisConnected = true;
    return client;
  } catch (err) {
    console.warn('[Redis] Connection failed, falling back to MemoryStore/MemoryCache:', (err as Error).message);
    isRedisConnected = false;
    redisClient = null;
    return null;
  }
}

/**
 * Retrieve cached item by key
 */
export async function cacheGet<T = any>(key: string): Promise<T | null> {
  try {
    if (isRedisConnected && redisClient) {
      const data = await redisClient.get(key);
      if (typeof data === 'string') {
        return JSON.parse(data) as T;
      }
      return null;
    }
  } catch (e) {
    console.warn(`[Cache] Redis get error for key "${key}":`, e);
  }

  // Memory fallback
  const cached = memoryCache.get(key);
  if (cached) {
    if (Date.now() < cached.expiresAt) {
      return cached.value as T;
    }
    memoryCache.delete(key);
  }
  return null;
}

/**
 * Set cached item with TTL in seconds (default: 60s)
 */
export async function cacheSet(key: string, value: any, ttlSeconds = 60): Promise<void> {
  try {
    if (isRedisConnected && redisClient) {
      await redisClient.set(key, JSON.stringify(value), {
        EX: ttlSeconds,
      });
      return;
    }
  } catch (e) {
    console.warn(`[Cache] Redis set error for key "${key}":`, e);
  }

  // Memory fallback
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate key or keys matching prefix pattern
 */
export async function cacheDel(keyOrPattern: string): Promise<void> {
  try {
    if (isRedisConnected && redisClient) {
      if (keyOrPattern.includes('*')) {
        const keys = await redisClient.keys(keyOrPattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } else {
        await redisClient.del(keyOrPattern);
      }
    }
  } catch (e) {
    console.warn(`[Cache] Redis del error for "${keyOrPattern}":`, e);
  }

  if (keyOrPattern.includes('*')) {
    const prefix = keyOrPattern.replace('*', '');
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  } else {
    memoryCache.delete(keyOrPattern);
  }
}
