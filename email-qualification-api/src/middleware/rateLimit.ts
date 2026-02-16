import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ApiKeyInfo } from '../types/index.js';
import { getRedis } from '../lib/redis.js';

// In-memory fallback when Redis is unavailable
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const ipRateLimitStore = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;
const WINDOW_SECONDS = 60;
const IP_LIMIT_PER_MINUTE = 20;

/**
 * Check rate limit using Redis (with in-memory fallback)
 */
async function checkLimit(key: string, limit: number): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const redis = getRedis();

  if (redis) {
    try {
      const redisKey = `rl:${key}`;
      const count = await redis.incr(redisKey);

      if (count === 1) {
        await redis.expire(redisKey, WINDOW_SECONDS);
      }

      const ttl = await redis.ttl(redisKey);
      const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : WINDOW_MS);

      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    } catch {
      // Fallback to in-memory on Redis error
    }
  }

  return checkLimitMemory(rateLimitStore, key, limit);
}

function checkLimitMemory(
  store: Map<string, RateLimitEntry>,
  key: string,
  limit: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Get client IP from request
 */
function getClientIp(request: FastifyRequest): string {
  // Check common proxy headers
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }

  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return request.ip;
}

/**
 * Rate limiting hook that checks both API key and IP limits
 */
export async function rateLimitHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const keyInfo = request.apiKeyInfo;
  const clientIp = getClientIp(request);

  // If authenticated, use API key rate limits
  if (keyInfo) {
    const keyLimit = keyInfo.rate_limit_per_minute;
    const keyResult = await checkLimit(`key:${keyInfo.client_id}`, keyLimit);

    reply.header('X-RateLimit-Limit', keyLimit);
    reply.header('X-RateLimit-Remaining', keyResult.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(keyResult.resetAt / 1000));

    if (!keyResult.allowed) {
      reply.header('Retry-After', Math.ceil((keyResult.resetAt - Date.now()) / 1000));
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
          details: {
            limit: keyLimit,
            window_seconds: WINDOW_SECONDS,
            retry_after: Math.ceil((keyResult.resetAt - Date.now()) / 1000),
          },
        },
        metadata: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  const ipResult = await checkLimit(`ip:${clientIp}`, IP_LIMIT_PER_MINUTE);

  if (!ipResult.allowed) {
    reply.header('Retry-After', Math.ceil((ipResult.resetAt - Date.now()) / 1000));
    return reply.status(429).send({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests from this IP',
        details: {
          retry_after: Math.ceil((ipResult.resetAt - Date.now()) / 1000),
        },
      },
      metadata: {
        request_id: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Periodic cleanup of expired entries
 */
export function startRateLimitCleanup(intervalMs: number = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }

    for (const [key, entry] of ipRateLimitStore) {
      if (now > entry.resetAt) {
        ipRateLimitStore.delete(key);
      }
    }
  }, intervalMs);
}

/**
 * Clear all rate limit data (for testing)
 */
export function clearRateLimits(): void {
  rateLimitStore.clear();
  ipRateLimitStore.clear();
}

/**
 * Get rate limit tier config based on tier name
 */
export function getRateLimitConfig(tier: ApiKeyInfo['tier']): {
  perMinute: number;
  perDay: number;
} {
  switch (tier) {
    case 'free':
      return { perMinute: 10, perDay: 100 };
    case 'starter':
      return { perMinute: 60, perDay: 5000 };
    case 'pro':
      return { perMinute: 300, perDay: 50000 };
    case 'enterprise':
      return { perMinute: 1000, perDay: 500000 };
    default:
      return { perMinute: 10, perDay: 100 };
  }
}
