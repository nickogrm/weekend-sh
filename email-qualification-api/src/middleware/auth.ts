import crypto from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ApiKeyInfo } from '../types/index.js';
import { config } from '../config/env.js';

// In-memory API key store (in production, use Redis or database)
const apiKeys = new Map<string, ApiKeyInfo>();

// API key format: eq_[live|test]_[32 chars]
const API_KEY_REGEX = /^eq_(live|test)_[a-zA-Z0-9]{32}$/;

/**
 * Hash an API key for storage
 */
export function hashApiKey(key: string): string {
  return crypto
    .createHmac('sha256', config.API_KEY_SALT)
    .update(key)
    .digest('hex');
}

/**
 * Generate a new API key
 */
export function generateApiKey(env: 'live' | 'test'): string {
  const randomPart = crypto.randomBytes(24).toString('base64url').slice(0, 32);
  return `eq_${env}_${randomPart}`;
}

/**
 * Register an API key (for testing/development)
 */
export function registerApiKey(key: string, info: Omit<ApiKeyInfo, 'id'>): void {
  const hash = hashApiKey(key);
  apiKeys.set(hash, {
    id: hash.slice(0, 12),
    ...info,
  });
}

/**
 * Validate API key format
 */
function isValidKeyFormat(key: string): boolean {
  return API_KEY_REGEX.test(key);
}

/**
 * Look up API key info
 */
export function getApiKeyInfo(key: string): ApiKeyInfo | null {
  if (!isValidKeyFormat(key)) return null;

  const hash = hashApiKey(key);
  const info = apiKeys.get(hash);

  if (!info) return null;

  // Check expiration
  if (info.expires_at && new Date() > info.expires_at) {
    return null;
  }

  return info;
}

/**
 * Authentication hook for Fastify
 */
export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing API key. Provide X-API-Key header.',
      },
      metadata: {
        request_id: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const keyInfo = getApiKeyInfo(apiKey);

  if (!keyInfo) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
      },
      metadata: {
        request_id: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Attach key info to request for later use
  request.apiKeyInfo = keyInfo;
}

/**
 * Check CORS origin against client allowlist
 */
export function isOriginAllowed(origin: string | undefined, keyInfo: ApiKeyInfo): boolean {
  if (!origin) return true; // Server-side requests

  // Wildcard allows all
  if (keyInfo.cors_origins.includes('*')) return true;

  // Check exact match or pattern
  for (const allowed of keyInfo.cors_origins) {
    if (allowed === origin) return true;

    // Simple wildcard: *.example.com
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1); // .example.com
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith(suffix) || url.hostname === allowed.slice(2)) {
          return true;
        }
      } catch {
        continue;
      }
    }
  }

  return false;
}

/**
 * Initialize default API keys for development
 */
export function initDevApiKeys(): void {
  if (config.NODE_ENV !== 'production') {
    // Default development key
    registerApiKey('eq_test_00000000000000000000000000000000', {
      client_id: 'dev-client',
      tier: 'pro',
      scopes: ['read:qualify'],
      rate_limit_per_minute: 1000,
      rate_limit_per_day: 100000,
      cors_origins: ['*'],
      created_at: new Date(),
    });

    // Another test key for integration tests
    registerApiKey('eq_test_11111111111111111111111111111111', {
      client_id: 'test-client',
      tier: 'free',
      scopes: ['read:qualify'],
      rate_limit_per_minute: 10,
      rate_limit_per_day: 100,
      cors_origins: ['http://localhost:3000', 'http://localhost:5173'],
      created_at: new Date(),
    });
  }
}

// Extend FastifyRequest type
declare module 'fastify' {
  interface FastifyRequest {
    apiKeyInfo?: ApiKeyInfo;
  }
}
