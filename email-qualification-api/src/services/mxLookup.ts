import dns from 'dns/promises';
import type { MxLookupResult } from '../types/index.js';
import { config } from '../config/env.js';

// In-memory cache for MX records
interface CacheEntry {
  result: MxLookupResult;
  expiresAt: number;
}

const mxCache = new Map<string, CacheEntry>();

// Circuit breaker state
interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  openedAt: number;
}

const circuitBreaker: CircuitState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  openedAt: 0,
};

const CIRCUIT_THRESHOLD = 10;       // failures before opening
const CIRCUIT_RESET_MS = 30_000;    // 30 seconds
const FAILURE_WINDOW_MS = 60_000;   // 1 minute window for failures

// MX provider detection patterns
const MX_PATTERNS = {
  google: [
    /google\.com$/i,
    /googlemail\.com$/i,
    /aspmx\.l\.google\.com$/i,
    /smtp\.google\.com$/i,
  ],
  microsoft: [
    /outlook\.com$/i,
    /microsoft\.com$/i,
    /protection\.outlook\.com$/i,
    /mail\.protection\.outlook\.com$/i,
    /olc\.protection\.outlook\.com$/i,
  ],
};

/**
 * Detect email provider from MX records
 */
function detectProvider(records: string[]): 'google' | 'microsoft' | 'other' | undefined {
  if (records.length === 0) return undefined;

  for (const record of records) {
    const lower = record.toLowerCase();

    for (const pattern of MX_PATTERNS.google) {
      if (pattern.test(lower)) return 'google';
    }

    for (const pattern of MX_PATTERNS.microsoft) {
      if (pattern.test(lower)) return 'microsoft';
    }
  }

  return 'other';
}

/**
 * Check and update circuit breaker state
 */
function checkCircuitBreaker(): boolean {
  const now = Date.now();

  // Reset failures if window has passed
  if (now - circuitBreaker.lastFailure > FAILURE_WINDOW_MS) {
    circuitBreaker.failures = 0;
  }

  // Check if circuit should close
  if (circuitBreaker.isOpen && now - circuitBreaker.openedAt > CIRCUIT_RESET_MS) {
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
  }

  return circuitBreaker.isOpen;
}

/**
 * Record a failure in the circuit breaker
 */
function recordFailure(): void {
  const now = Date.now();
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = now;

  if (circuitBreaker.failures >= CIRCUIT_THRESHOLD) {
    circuitBreaker.isOpen = true;
    circuitBreaker.openedAt = now;
  }
}

/**
 * Get cached MX result if available and not expired
 */
function getCachedResult(domain: string): MxLookupResult | null {
  const entry = mxCache.get(domain);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    mxCache.delete(domain);
    return null;
  }

  return { ...entry.result, cached: true };
}

/**
 * Cache MX result
 */
function cacheResult(domain: string, result: MxLookupResult): void {
  const ttl = config.MX_CACHE_TTL_SECONDS * 1000;
  mxCache.set(domain, {
    result,
    expiresAt: Date.now() + ttl,
  });

  // Limit cache size
  if (mxCache.size > 10000) {
    const firstKey = mxCache.keys().next().value;
    if (firstKey) mxCache.delete(firstKey);
  }
}

/**
 * Perform DNS MX lookup with timeout
 */
export async function lookupMx(domain: string): Promise<MxLookupResult> {
  // Check cache first
  const cached = getCachedResult(domain);
  if (cached) return cached;

  // Check circuit breaker
  if (checkCircuitBreaker()) {
    return {
      hasMx: false,
      records: [],
      timedOut: true,
      cached: false,
    };
  }

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('DNS timeout')), config.MX_TIMEOUT_MS);
    });

    // Race DNS lookup against timeout
    const records = await Promise.race([
      dns.resolveMx(domain),
      timeoutPromise,
    ]);

    // Sort by priority and extract exchanges
    const sortedRecords = records
      .sort((a, b) => a.priority - b.priority)
      .map(r => r.exchange);

    const result: MxLookupResult = {
      hasMx: sortedRecords.length > 0,
      records: sortedRecords,
      provider: detectProvider(sortedRecords),
      timedOut: false,
      cached: false,
    };

    cacheResult(domain, result);
    return result;

  } catch (error) {
    const isTimeout = error instanceof Error && error.message === 'DNS timeout';

    if (isTimeout) {
      recordFailure();
      return {
        hasMx: false,
        records: [],
        timedOut: true,
        cached: false,
      };
    }

    // ENOTFOUND or ENODATA means no MX records
    const dnsError = error as NodeJS.ErrnoException;
    if (dnsError.code === 'ENOTFOUND' || dnsError.code === 'ENODATA') {
      // Try A record fallback - some domains receive mail without MX
      try {
        await dns.resolve4(domain);
        // Has A record, might accept mail
        const result: MxLookupResult = {
          hasMx: false, // No MX specifically
          records: [],
          timedOut: false,
          cached: false,
        };
        cacheResult(domain, result);
        return result;
      } catch {
        // No A record either
        const result: MxLookupResult = {
          hasMx: false,
          records: [],
          timedOut: false,
          cached: false,
        };
        cacheResult(domain, result);
        return result;
      }
    }

    // Other DNS errors
    recordFailure();
    return {
      hasMx: false,
      records: [],
      timedOut: false,
      cached: false,
    };
  }
}

/**
 * Clear the MX cache (useful for testing)
 */
export function clearMxCache(): void {
  mxCache.clear();
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(): { isOpen: boolean; failures: number } {
  return {
    isOpen: circuitBreaker.isOpen,
    failures: circuitBreaker.failures,
  };
}
