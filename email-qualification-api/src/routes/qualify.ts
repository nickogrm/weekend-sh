import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import { parseEmail, validateEmailSyntax } from '../services/domainParser.js';
import { matchAllLists, getListVersions } from '../services/listMatcher.js';
import { lookupMx } from '../services/mxLookup.js';
import { computeQualification, isPrivateB2B, isBusinessEmail } from '../services/scoring.js';
import type { QualifyEmailRequest, QualifyEmailResponse, QualifyLogEvent } from '../types/index.js';

// Request validation schema
const qualifyEmailSchema = z.object({
  email: z.string().min(1).max(254),
  context: z.object({
    form_id: z.string().max(100).optional(),
    page_url: z.string().url().max(2000).optional(),
    referrer: z.string().url().max(2000).optional(),
    ip: z.string().optional(),
    user_agent: z.string().max(500).optional(),
    lead_id: z.string().max(100).optional(),
    campaign: z.string().max(100).optional(),
    source: z.string().max(100).optional(),
  }).optional(),
  options: z.object({
    strict_mode: z.boolean().default(false),
    enable_mx_check: z.boolean().default(false),
    store_mode: z.enum(['none', 'hash', 'plain']).default('hash'),
    ttl_days: z.number().int().min(1).max(365).default(90),
  }).optional(),
});

const batchQualifySchema = z.object({
  emails: z.array(z.string().min(1).max(254)).min(1).max(100),
  context: z.object({
    form_id: z.string().max(100).optional(),
    campaign: z.string().max(100).optional(),
    source: z.string().max(100).optional(),
  }).optional(),
  options: z.object({
    enable_mx_check: z.boolean().default(false),
    store_mode: z.enum(['none', 'hash', 'plain']).default('hash'),
  }).optional(),
});

/**
 * Hash email for privacy-compliant storage
 */
function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

/**
 * Core email qualification logic
 */
async function qualifyEmailInternal(
  email: string,
  options: { enable_mx_check?: boolean; strict_mode?: boolean },
  requestId: string,
  startTime: number
): Promise<QualifyEmailResponse> {
  // Step 1: Validate syntax
  const syntaxResult = validateEmailSyntax(email);
  if (!syntaxResult.valid) {
    return {
      verdict: 'unknown',
      is_business_email: false,
      is_private_b2b: false,
      confidence: 0,
      flags: ['invalid_syntax'],
      reasons: [syntaxResult.error || 'Invalid email syntax'],
      domain: {
        raw: '',
        registrable: '',
        tld: '',
      },
      provider_match: null,
      metadata: {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - startTime,
        cache_hit: false,
        mx_checked: false,
        mx_records_count: null,
        list_versions: getListVersions(),
      },
    };
  }

  // Step 2: Parse domain
  const parsed = parseEmail(email);
  if (!parsed) {
    return {
      verdict: 'unknown',
      is_business_email: false,
      is_private_b2b: false,
      confidence: 0,
      flags: ['invalid_syntax'],
      reasons: ['Unable to parse email domain'],
      domain: {
        raw: '',
        registrable: '',
        tld: '',
      },
      provider_match: null,
      metadata: {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - startTime,
        cache_hit: false,
        mx_checked: false,
        mx_records_count: null,
        list_versions: getListVersions(),
      },
    };
  }

  // Step 3: Match against lists
  const listMatch = matchAllLists(parsed);

  // Step 4: Optional MX check (only if no list match found or for business emails)
  let mxResult = null;
  if (options.enable_mx_check && !listMatch.match.matched) {
    mxResult = await lookupMx(parsed.registrableDomain);
  }

  // Step 5: Compute qualification result
  const qualification = computeQualification({
    parsed,
    listMatch,
    mxResult,
    strictMode: options.strict_mode || false,
  });

  // Build response
  return {
    verdict: qualification.verdict,
    is_business_email: isBusinessEmail(qualification.verdict),
    is_private_b2b: isPrivateB2B(qualification.verdict),
    confidence: qualification.confidence,
    flags: qualification.flags,
    reasons: qualification.reasons,
    domain: {
      raw: parsed.domain,
      registrable: parsed.registrableDomain,
      tld: parsed.tld,
    },
    provider_match: qualification.providerMatch,
    metadata: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
      cache_hit: mxResult?.cached || false,
      mx_checked: mxResult !== null,
      mx_records_count: mxResult?.records.length ?? null,
      list_versions: getListVersions(),
    },
  };
}

export async function qualifyRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /v1/qualify-email - Single email qualification
  fastify.post<{
    Body: QualifyEmailRequest;
  }>('/v1/qualify-email', async (request, reply) => {
    const startTime = Date.now();
    const requestId = `req_${uuidv4().slice(0, 8)}`;

    // Validate request body
    const parseResult = qualifyEmailSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          details: parseResult.error.flatten(),
        },
        metadata: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const { email, context, options } = parseResult.data;

    try {
      const result = await qualifyEmailInternal(
        email,
        {
          enable_mx_check: options?.enable_mx_check,
          strict_mode: options?.strict_mode,
        },
        requestId,
        startTime
      );

      // Log the qualification event
      const logEvent: QualifyLogEvent = {
        level: 'info',
        timestamp: result.metadata.timestamp,
        request_id: requestId,
        event: 'email_qualified',
        client_id: request.apiKeyInfo?.client_id || 'unknown',
        verdict: result.verdict,
        confidence: result.confidence,
        flags: result.flags,
        domain: result.domain.registrable,
        tld: result.domain.tld,
        mx_provider: result.flags.includes('mx_google') ? 'google' :
                     result.flags.includes('mx_microsoft') ? 'microsoft' : undefined,
        latency_ms: result.metadata.latency_ms,
        cache_hit: result.metadata.cache_hit,
        form_id: context?.form_id,
        page_url: context?.page_url,
        campaign: context?.campaign,
      };

      request.log.info(logEvent);

      return result;
    } catch (error) {
      request.log.error({ error, requestId }, 'Email qualification failed');
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
        metadata: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // POST /v1/qualify-email/batch - Batch email qualification
  fastify.post<{
    Body: { emails: string[]; context?: object; options?: object };
  }>('/v1/qualify-email/batch', async (request, reply) => {
    const startTime = Date.now();
    const requestId = `req_${uuidv4().slice(0, 8)}`;

    // Validate request body
    const parseResult = batchQualifySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          details: parseResult.error.flatten(),
        },
        metadata: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const { emails, options } = parseResult.data;

    try {
      // Process emails in parallel
      const results = await Promise.all(
        emails.map((email, index) =>
          qualifyEmailInternal(
            email,
            {
              enable_mx_check: options?.enable_mx_check,
              strict_mode: false,
            },
            `${requestId}_${index}`,
            startTime
          )
        )
      );

      // Compute verdict summary
      const verdictsSummary: Record<string, number> = {};
      for (const result of results) {
        verdictsSummary[result.verdict] = (verdictsSummary[result.verdict] || 0) + 1;
      }

      return {
        results,
        metadata: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          total_count: emails.length,
          latency_ms: Date.now() - startTime,
          verdicts_summary: verdictsSummary,
        },
      };
    } catch (error) {
      request.log.error({ error, requestId }, 'Batch email qualification failed');
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
        metadata: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });
}
