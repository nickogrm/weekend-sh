import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { qualifyRoutes } from '../src/routes/qualify.js';
import { healthRoutes } from '../src/routes/health.js';
import { authHook, initDevApiKeys } from '../src/middleware/auth.js';
import { rateLimitHook } from '../src/middleware/rateLimit.js';
import { initializeLists } from '../src/services/listMatcher.js';

const DEV_API_KEY = 'eq_test_00000000000000000000000000000000';

async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors);

  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/health')) return;
    await authHook(request, reply);
  });

  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/health')) return;
    await rateLimitHook(request, reply);
  });

  await app.register(healthRoutes);
  await app.register(qualifyRoutes);

  return app;
}

describe('API Endpoints', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    initializeLists();
    initDevApiKeys();
    app = await buildApp();
  });

  describe('Health', () => {
    it('GET /health returns healthy', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('healthy');
    });

    it('GET /health/live returns alive', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/live' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('alive');
    });

    it('GET /health/ready returns readiness', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.checks.lists_loaded).toBe('ok');
    });
  });

  describe('Authentication', () => {
    it('rejects requests without API key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email',
        payload: { email: 'test@gmail.com' },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid API key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email',
        headers: { 'x-api-key': 'eq_test_invalid00000000000000000000' },
        payload: { email: 'test@gmail.com' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('accepts valid API key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email',
        headers: { 'x-api-key': DEV_API_KEY },
        payload: { email: 'test@gmail.com' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /v1/qualify-email', () => {
    it('classifies gmail as personal', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email',
        headers: { 'x-api-key': DEV_API_KEY },
        payload: { email: 'user@gmail.com' },
      });
      const body = JSON.parse(res.body);
      expect(body.verdict).toBe('personal');
      expect(body.is_business_email).toBe(false);
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.metadata.request_id).toBeDefined();
    });

    it('classifies custom domain as private_b2b', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email',
        headers: { 'x-api-key': DEV_API_KEY },
        payload: { email: 'ceo@acmecorp.com' },
      });
      const body = JSON.parse(res.body);
      expect(body.verdict).toBe('private_b2b');
      expect(body.is_business_email).toBe(true);
      expect(body.is_private_b2b).toBe(true);
    });

    it('returns unknown for invalid email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email',
        headers: { 'x-api-key': DEV_API_KEY },
        payload: { email: 'not-an-email' },
      });
      const body = JSON.parse(res.body);
      expect(body.verdict).toBe('unknown');
      expect(body.flags).toContain('invalid_syntax');
    });

    it('rejects empty body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email',
        headers: { 'x-api-key': DEV_API_KEY },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('includes rate limit headers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email',
        headers: { 'x-api-key': DEV_API_KEY },
        payload: { email: 'user@gmail.com' },
      });
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('POST /v1/qualify-email/batch', () => {
    it('qualifies multiple emails', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email/batch',
        headers: { 'x-api-key': DEV_API_KEY },
        payload: {
          emails: ['user@gmail.com', 'ceo@acmecorp.com', 'user@yopmail.com'],
        },
      });
      const body = JSON.parse(res.body);
      expect(body.results).toHaveLength(3);
      expect(body.results[0].verdict).toBe('personal');
      expect(body.results[1].verdict).toBe('private_b2b');
      expect(body.results[2].verdict).toBe('disposable');
      expect(body.metadata.total_count).toBe(3);
      expect(body.metadata.verdicts_summary).toBeDefined();
    });

    it('rejects empty emails array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/qualify-email/batch',
        headers: { 'x-api-key': DEV_API_KEY },
        payload: { emails: [] },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('404', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/unknown',
        headers: { 'x-api-key': DEV_API_KEY },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
