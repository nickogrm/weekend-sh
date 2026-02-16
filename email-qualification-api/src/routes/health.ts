import type { FastifyInstance } from 'fastify';
import { getListVersions } from '../services/listMatcher.js';
import { isRedisHealthy, isRedisConnected } from '../lib/redis.js';

const startTime = Date.now();

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /health - Basic health check
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'healthy',
      version: process.env.npm_package_version || '1.0.0',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    };
  });

  // GET /health/ready - Readiness check
  fastify.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error' | 'degraded'> = {
      lists_loaded: 'ok',
    };

    // Check if lists are loaded
    const versions = getListVersions();
    if (versions.personal === '0.0.0') {
      checks.lists_loaded = 'error';
    }

    // Redis check (degraded mode is acceptable)
    checks.redis = await isRedisHealthy() ? 'ok' : 'degraded';

    const allOk = Object.values(checks).every(v => v === 'ok' || v === 'degraded');

    if (!allOk) {
      reply.status(503);
    }

    return {
      ready: allOk,
      checks,
    };
  });

  // GET /health/live - Liveness check (for Kubernetes)
  fastify.get('/health/live', async (_request, _reply) => {
    return { status: 'alive' };
  });
}
