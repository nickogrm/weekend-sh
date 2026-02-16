import { Redis } from 'ioredis';
import { config } from '../config/env.js';

let redis: Redis | null = null;
let isConnected = false;

/**
 * Get or create Redis client.
 * Returns null if Redis is unavailable (graceful degradation).
 */
export function getRedis(): Redis | null {
  if (!redis) {
    try {
      redis = new Redis(config.REDIS_URL, {
        tls: config.REDIS_TLS ? {} : undefined,
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 5) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      redis.on('connect', () => {
        isConnected = true;
      });

      redis.on('error', (err: Error) => {
        isConnected = false;
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Redis error (falling back to in-memory):', err.message);
        }
      });

      redis.on('close', () => {
        isConnected = false;
      });

      redis.connect().catch(() => {
        isConnected = false;
      });
    } catch {
      redis = null;
      isConnected = false;
    }
  }

  return isConnected ? redis : null;
}

/**
 * Check if Redis is connected and responsive
 */
export async function isRedisHealthy(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Disconnect Redis (for graceful shutdown)
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
    isConnected = false;
  }
}

/**
 * Check connection status without pinging
 */
export function isRedisConnected(): boolean {
  return isConnected;
}
