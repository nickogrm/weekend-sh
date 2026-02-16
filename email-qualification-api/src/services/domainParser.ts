import psl from 'psl';
import type { ParsedEmail } from '../types/index.js';

// RFC 5322 simplified regex for email validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const MAX_EMAIL_LENGTH = 254;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates email syntax according to RFC 5322 (simplified)
 */
export function validateEmailSyntax(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();

  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: `Email exceeds maximum length of ${MAX_EMAIL_LENGTH}` };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email syntax' };
  }

  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1) {
    return { valid: false, error: 'Missing @ symbol' };
  }

  const domain = trimmed.slice(atIndex + 1);
  if (!domain.includes('.')) {
    return { valid: false, error: 'Domain must contain a dot' };
  }

  return { valid: true };
}

/**
 * Converts IDN (internationalized domain name) to ASCII punycode
 */
function toAsciiDomain(domain: string): string {
  try {
    // Use URL API to handle punycode conversion
    const url = new URL(`http://${domain}`);
    return url.hostname;
  } catch {
    return domain.toLowerCase();
  }
}

/**
 * Checks if domain contains non-ASCII characters (IDN)
 */
function isIdnDomain(domain: string): boolean {
  return /[^\x00-\x7F]/.test(domain);
}

/**
 * Parses an email address and extracts domain information using PSL
 */
export function parseEmail(email: string): ParsedEmail | null {
  const validation = validateEmailSyntax(email);
  if (!validation.valid) {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  const local = normalized.slice(0, atIndex);
  const rawDomain = normalized.slice(atIndex + 1);

  // Handle plus addressing: user+tag@domain.com -> user@domain.com
  const plusIndex = local.indexOf('+');
  const localNormalized = plusIndex !== -1 ? local.slice(0, plusIndex) : local;
  const isPlusAddressing = plusIndex !== -1;

  // Check for IDN and convert to ASCII
  const isIdn = isIdnDomain(rawDomain);
  const domain = toAsciiDomain(rawDomain);

  // Use PSL to get registrable domain (eTLD+1)
  const parsed = psl.parse(domain);

  if (parsed.error || !parsed.domain) {
    // Fallback: use the full domain if PSL fails
    return {
      local,
      localNormalized,
      domain,
      registrableDomain: domain,
      tld: domain.split('.').pop() || '',
      isSubdomain: false,
      isPlusAddressing,
      isIdn,
    };
  }

  const registrableDomain = parsed.domain;
  const tld = parsed.tld || domain.split('.').pop() || '';

  // Check if the raw domain is a subdomain of the registrable domain
  const isSubdomain = domain !== registrableDomain && domain.endsWith(`.${registrableDomain}`);

  return {
    local,
    localNormalized,
    domain,
    registrableDomain,
    tld,
    isSubdomain,
    isPlusAddressing,
    isIdn,
  };
}

/**
 * Extracts just the domain part from an email
 */
export function extractDomain(email: string): string | null {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return null;
  return email.slice(atIndex + 1).trim().toLowerCase();
}

/**
 * Gets the registrable domain using PSL
 */
export function getRegistrableDomain(domain: string): string {
  const parsed = psl.parse(domain.toLowerCase());
  return parsed.domain || domain;
}
