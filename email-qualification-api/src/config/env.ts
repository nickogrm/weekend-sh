import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_TLS: z.coerce.boolean().default(false),

  // Security
  API_KEY_SALT: z.string().min(32).default('development-salt-replace-in-prod!'),
  CORS_ORIGINS: z.string().default('*').transform(v => v.split(',')),

  // Features
  ENABLE_MX_CHECK: z.coerce.boolean().default(true),
  MX_TIMEOUT_MS: z.coerce.number().default(2000),
  MX_CACHE_TTL_SECONDS: z.coerce.number().default(3600),

  // Lists
  LISTS_AUTO_UPDATE: z.coerce.boolean().default(false),
  LISTS_UPDATE_INTERVAL_HOURS: z.coerce.number().default(24),

  // Storage
  DEFAULT_STORE_MODE: z.enum(['none', 'hash', 'plain']).default('hash'),
  DEFAULT_TTL_DAYS: z.coerce.number().default(90),

  // Rate limiting
  RATE_LIMIT_FREE_PER_MIN: z.coerce.number().default(10),
  RATE_LIMIT_STARTER_PER_MIN: z.coerce.number().default(60),
  RATE_LIMIT_PRO_PER_MIN: z.coerce.number().default(300),
});

export type EnvConfig = z.infer<typeof envSchema>;

function loadEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    for (const error of result.error.errors) {
      console.error(`  ${error.path.join('.')}: ${error.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const config = loadEnv();

// Derived configuration
export const isDev = config.NODE_ENV === 'development';
export const isProd = config.NODE_ENV === 'production';
export const isStaging = config.NODE_ENV === 'staging';
