import type {
  Flag,
  ListMatchResult,
  MxLookupResult,
  ParsedEmail,
  ProviderMatch,
  QualificationResult,
  Verdict,
} from '../types/index.js';

interface ScoringInput {
  parsed: ParsedEmail;
  listMatch: {
    category: 'disposable' | 'personal' | 'education' | 'government' | null;
    match: ListMatchResult;
  };
  mxResult: MxLookupResult | null;
  strictMode: boolean;
}

// Base confidence scores by match type
const BASE_SCORES = {
  exact: 0.95,
  registrable: 0.90,
  suffix: 0.85,
  tld_pattern: 0.85,
};

// Score adjustments
const ADJUSTMENTS = {
  mx_valid: 0.05,
  mx_provider_known: 0.03,
  no_mx: -0.15,
  subdomain: 0.0, // neutral
};

/**
 * Build the list of flags based on classification results
 */
function buildFlags(
  parsed: ParsedEmail,
  listMatch: { category: string | null; match: ListMatchResult },
  mxResult: MxLookupResult | null
): Flag[] {
  const flags: Flag[] = [];

  // List match flags
  if (listMatch.category === 'personal') {
    flags.push('public_provider');
  }
  if (listMatch.category === 'disposable') {
    flags.push('disposable');
  }
  if (listMatch.category === 'education') {
    flags.push('edu');
  }
  if (listMatch.category === 'government') {
    flags.push('gov');
  }

  // MX flags
  if (mxResult) {
    if (mxResult.timedOut) {
      flags.push('mx_timeout');
    } else if (!mxResult.hasMx && mxResult.records.length === 0) {
      flags.push('no_mx');
    } else if (mxResult.provider === 'google') {
      flags.push('mx_google');
    } else if (mxResult.provider === 'microsoft') {
      flags.push('mx_microsoft');
    }
  }

  // Structural flags
  if (parsed.isSubdomain) {
    flags.push('subdomain');
  }
  if (parsed.isPlusAddressing) {
    flags.push('plus_addressing');
  }
  if (parsed.isIdn) {
    flags.push('idn');
  }

  return flags;
}

/**
 * Build human-readable reasons for the verdict
 */
function buildReasons(
  verdict: Verdict,
  listMatch: { category: string | null; match: ListMatchResult },
  mxResult: MxLookupResult | null,
  parsed: ParsedEmail
): string[] {
  const reasons: string[] = [];

  switch (verdict) {
    case 'personal':
      reasons.push(`${parsed.registrableDomain} is a known public email provider`);
      break;

    case 'disposable':
      reasons.push(`${parsed.registrableDomain} is a known disposable email domain`);
      break;

    case 'education':
      if (listMatch.match.matchType === 'tld_pattern') {
        reasons.push(`Domain matches education TLD pattern: ${listMatch.match.pattern}`);
      } else {
        reasons.push(`${parsed.registrableDomain} found in academic database`);
      }
      break;

    case 'government':
      if (listMatch.match.matchType === 'tld_pattern') {
        reasons.push(`Domain matches government TLD pattern: ${listMatch.match.pattern}`);
      } else {
        reasons.push(`${parsed.registrableDomain} is a known government domain`);
      }
      break;

    case 'private_b2b':
      reasons.push('Domain not in personal/disposable/edu/gov lists');
      if (mxResult?.hasMx) {
        reasons.push('Valid MX records found');
        if (mxResult.provider === 'google') {
          reasons.push('Google Workspace detected');
        } else if (mxResult.provider === 'microsoft') {
          reasons.push('Microsoft 365 detected');
        }
      }
      break;

    case 'unknown':
      reasons.push('Unable to classify domain with confidence');
      if (mxResult && !mxResult.hasMx && !mxResult.timedOut) {
        reasons.push('No MX records found');
      }
      if (mxResult?.timedOut) {
        reasons.push('MX lookup timed out');
      }
      break;
  }

  // Limit to 5 reasons max
  return reasons.slice(0, 5);
}

/**
 * Calculate confidence score based on match and MX results
 */
function calculateConfidence(
  verdict: Verdict,
  listMatch: { category: string | null; match: ListMatchResult },
  mxResult: MxLookupResult | null
): number {
  let confidence: number;

  // Base score from list match type
  if (listMatch.match.matched && listMatch.match.matchType) {
    confidence = BASE_SCORES[listMatch.match.matchType] || 0.85;
  } else if (verdict === 'private_b2b') {
    // Business verdict without list match
    confidence = mxResult?.hasMx ? 0.85 : 0.70;
  } else {
    confidence = 0.50; // Unknown
  }

  // MX adjustments for business verdicts
  if (verdict === 'private_b2b' && mxResult) {
    if (mxResult.hasMx) {
      confidence += ADJUSTMENTS.mx_valid;
      if (mxResult.provider === 'google' || mxResult.provider === 'microsoft') {
        confidence += ADJUSTMENTS.mx_provider_known;
      }
    } else if (!mxResult.timedOut) {
      confidence += ADJUSTMENTS.no_mx;
    }
  }

  // Clamp to valid range
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Determine the final verdict based on all inputs
 */
function determineVerdict(
  listMatch: { category: string | null; match: ListMatchResult },
  mxResult: MxLookupResult | null,
  strictMode: boolean
): Verdict {
  // Direct list matches
  if (listMatch.category === 'disposable') return 'disposable';
  if (listMatch.category === 'personal') return 'personal';
  if (listMatch.category === 'education') return 'education';
  if (listMatch.category === 'government') return 'government';

  // No list match - determine based on MX and strictMode
  if (mxResult?.hasMx) {
    return 'private_b2b';
  }

  // No MX or not checked
  if (strictMode) {
    return 'unknown';
  }

  // In non-strict mode, assume business if no negative signals
  return mxResult === null ? 'private_b2b' : 'unknown';
}

/**
 * Build provider match info for response
 */
function buildProviderMatch(
  listMatch: { category: string | null; match: ListMatchResult }
): ProviderMatch | null {
  if (!listMatch.match.matched || !listMatch.match.list) {
    return null;
  }

  return {
    list: listMatch.match.list,
    match_type: listMatch.match.matchType!,
    pattern: listMatch.match.pattern,
  };
}

/**
 * Main scoring function - computes verdict, confidence, flags, and reasons
 */
export function computeQualification(input: ScoringInput): QualificationResult {
  const { parsed, listMatch, mxResult, strictMode } = input;

  const verdict = determineVerdict(listMatch, mxResult, strictMode);
  const confidence = calculateConfidence(verdict, listMatch, mxResult);
  const flags = buildFlags(parsed, listMatch, mxResult);
  const reasons = buildReasons(verdict, listMatch, mxResult, parsed);
  const providerMatch = buildProviderMatch(listMatch);

  return {
    verdict,
    confidence: Math.round(confidence * 100) / 100, // Round to 2 decimals
    flags,
    reasons,
    providerMatch,
  };
}

/**
 * Helper to determine if verdict indicates a valid B2B lead
 */
export function isPrivateB2B(verdict: Verdict): boolean {
  return verdict === 'private_b2b';
}

/**
 * Helper to determine if email appears to be business-related
 */
export function isBusinessEmail(verdict: Verdict): boolean {
  return verdict === 'private_b2b' || verdict === 'education' || verdict === 'government';
}
