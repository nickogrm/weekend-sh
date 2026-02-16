import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config, isDev } from './config/env.js';
import { qualifyRoutes } from './routes/qualify.js';
import { healthRoutes } from './routes/health.js';
import { authHook, initDevApiKeys } from './middleware/auth.js';
import { rateLimitHook, startRateLimitCleanup } from './middleware/rateLimit.js';
import { initializeLists } from './services/listMatcher.js';
import { getRedis, disconnectRedis } from './lib/redis.js';

// Create Fastify instance with logger
const fastify = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'request_id',
  bodyLimit: 1_048_576, // 1MB max body size
});

// Register plugins
async function registerPlugins(): Promise<void> {
  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // API doesn't serve HTML
  });

  // Swagger API documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Email Qualification API',
        description: 'API for qualifying email addresses as B2B, personal, education, or government',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${config.PORT}` }],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // CORS configuration
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // In development, allow all origins
      if (isDev) {
        callback(null, true);
        return;
      }

      // In production, check against config
      if (!origin || config.CORS_ORIGINS.includes('*') || config.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: false,
    maxAge: 3600,
  });
}

// Register hooks
function registerHooks(): void {
  // Authentication hook for API routes
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for health checks
    if (request.url.startsWith('/health')) {
      return;
    }

    await authHook(request, reply);
  });

  // Rate limiting hook (after auth to have keyInfo)
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip rate limiting for health checks
    if (request.url.startsWith('/health')) {
      return;
    }

    await rateLimitHook(request, reply);
  });
}

// Register routes
async function registerRoutes(): Promise<void> {
  await fastify.register(healthRoutes);
  await fastify.register(qualifyRoutes);
}

// Error handlers
function registerErrorHandlers(): void {
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, 'Request error');

    // Handle Zod validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Validation error',
          details: error.validation,
        },
        metadata: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Handle other errors
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
        message: isDev ? error.message : 'An error occurred',
      },
      metadata: {
        request_id: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
      metadata: {
        request_id: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });
}

// Initialize and start server
async function start(): Promise<void> {
  try {
    // Initialize Redis (non-blocking, graceful degradation)
    fastify.log.info('Connecting to Redis...');
    const redis = getRedis();
    if (!redis) {
      fastify.log.warn('Redis unavailable, running in degraded mode (in-memory only)');
    }

    // Initialize services
    fastify.log.info('Initializing domain lists...');
    initializeLists();

    // Initialize dev API keys
    fastify.log.info('Initializing API keys...');
    initDevApiKeys();

    // Register everything
    await registerPlugins();
    registerHooks();
    await registerRoutes();
    registerErrorHandlers();

    // Start rate limit cleanup
    startRateLimitCleanup();

    // Start server
    await fastify.listen({
      port: config.PORT,
      host: config.HOST,
    });

    fastify.log.info(`Server running on http://${config.HOST}:${config.PORT}`);
    fastify.log.info(`Environment: ${config.NODE_ENV}`);

    if (isDev) {
      fastify.log.info('Development API key: eq_test_00000000000000000000000000000000');
    }
  } catch (error) {
    fastify.log.fatal(error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);
  await disconnectRedis();
  await fastify.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
start();

export { fastify };
