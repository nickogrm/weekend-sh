import type { ListMatchResult, ListVersions, ParsedEmail } from '../types/index.js';

// In-memory storage for lists with hot reload support
interface DomainLists {
  personal: Set<string>;
  disposable: Set<string>;
  education: Set<string>;
  governmentExact: Set<string>;
  governmentPatterns: GovPattern[];
  versions: ListVersions;
}

interface GovPattern {
  pattern: string;       // e.g., "*.gouv.fr"
  regex: RegExp;
  country?: string;
}

let lists: DomainLists = {
  personal: new Set(),
  disposable: new Set(),
  education: new Set(),
  governmentExact: new Set(),
  governmentPatterns: [],
  versions: {
    personal: '0.0.0',
    disposable: '0.0.0',
    education: '0.0.0',
    government: '0.0.0',
  },
};

// Personal/public email providers (subset - full list in data files)
const DEFAULT_PERSONAL_PROVIDERS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr', 'msn.com',
  'yahoo.com', 'yahoo.fr', 'ymail.com', 'rocketmail.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'aol.fr',
  'mail.com', 'email.com',
  'gmx.com', 'gmx.fr', 'gmx.de',
  'zoho.com', 'zohomail.com',
  'yandex.com', 'yandex.ru',
  'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru',
  'free.fr', 'orange.fr', 'wanadoo.fr', 'sfr.fr', 'laposte.net', 'bbox.fr',
  'web.de', 't-online.de',
  'libero.it', 'virgilio.it', 'alice.it',
  'qq.com', '163.com', '126.com', 'sina.com',
  'naver.com', 'daum.net',
];

// Disposable email domains (subset - full list from external source)
const DEFAULT_DISPOSABLE_DOMAINS = [
  'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'guerrillamail.org',
  'mailinator.com', 'mailinator.net',
  'throwaway.email', 'throwawaymail.com',
  '10minutemail.com', '10minutemail.net',
  'fakeinbox.com', 'trashmail.com', 'trashmail.net',
  'getnada.com', 'dispostable.com',
  'yopmail.com', 'yopmail.fr',
  'sharklasers.com', 'spam4.me', 'grr.la',
  'mohmal.com', 'tempail.com', 'emailondeck.com',
  'maildrop.cc', 'mailnesia.com', 'mintemail.com',
];

// Education domains (subset - full list from SWOT)
const DEFAULT_EDUCATION_DOMAINS = [
  // US
  'stanford.edu', 'mit.edu', 'harvard.edu', 'berkeley.edu', 'caltech.edu',
  'yale.edu', 'princeton.edu', 'columbia.edu', 'cornell.edu', 'upenn.edu',
  // UK
  'ox.ac.uk', 'cam.ac.uk', 'ucl.ac.uk', 'imperial.ac.uk', 'lse.ac.uk',
  'ed.ac.uk', 'manchester.ac.uk', 'kcl.ac.uk',
  // France
  'polytechnique.edu', 'ens.fr', 'hec.edu',
  'univ-paris1.fr', 'sorbonne-universite.fr', 'u-paris.fr',
  // Germany
  'tum.de', 'lmu.de', 'hu-berlin.de', 'fu-berlin.de',
  // Generic patterns will be handled by TLD rules
];

// Government patterns and exact domains
const DEFAULT_GOV_PATTERNS: GovPattern[] = [
  // Generic
  { pattern: '*.gov', regex: /\.gov$/i },
  { pattern: '*.gov.*', regex: /\.gov\.[a-z]{2,3}$/i },
  { pattern: '*.gob.*', regex: /\.gob\.[a-z]{2,3}$/i }, // Spanish
  { pattern: '*.gouv.*', regex: /\.gouv\.[a-z]{2,3}$/i }, // French

  // Specific countries
  { pattern: '*.gov.uk', regex: /\.gov\.uk$/i, country: 'UK' },
  { pattern: '*.gov.au', regex: /\.gov\.au$/i, country: 'AU' },
  { pattern: '*.gov.ca', regex: /\.gc\.ca$/i, country: 'CA' }, // Canada uses gc.ca
  { pattern: '*.gouv.fr', regex: /\.gouv\.fr$/i, country: 'FR' },
  { pattern: '*.gov.br', regex: /\.gov\.br$/i, country: 'BR' },
  { pattern: '*.gob.mx', regex: /\.gob\.mx$/i, country: 'MX' },
  { pattern: '*.go.jp', regex: /\.go\.jp$/i, country: 'JP' },
  { pattern: '*.govt.nz', regex: /\.govt\.nz$/i, country: 'NZ' },
  { pattern: '*.gov.in', regex: /\.gov\.in$/i, country: 'IN' },
];

const DEFAULT_GOV_EXACT_DOMAINS = [
  // US
  'state.gov', 'whitehouse.gov', 'nasa.gov', 'fbi.gov', 'cia.gov',
  // EU
  'europa.eu', 'ec.europa.eu',
  // International orgs (often treated as gov-adjacent)
  'un.org', 'who.int', 'nato.int', 'oecd.org', 'worldbank.org',
];

// Education TLD patterns (always edu)
const EDUCATION_TLD_PATTERNS = [
  /\.edu$/i,
  /\.edu\.[a-z]{2}$/i, // .edu.au, .edu.mx, etc.
  /\.ac\.[a-z]{2}$/i,  // .ac.uk, .ac.jp, etc.
  /\.edu\.[a-z]{2,3}$/i,
];

/**
 * Initialize lists with default data
 * In production, this would load from files or external sources
 */
export function initializeLists(): void {
  const now = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  lists = {
    personal: new Set(DEFAULT_PERSONAL_PROVIDERS),
    disposable: new Set(DEFAULT_DISPOSABLE_DOMAINS),
    education: new Set(DEFAULT_EDUCATION_DOMAINS),
    governmentExact: new Set(DEFAULT_GOV_EXACT_DOMAINS),
    governmentPatterns: DEFAULT_GOV_PATTERNS,
    versions: {
      personal: now,
      disposable: now,
      education: now,
      government: now,
    },
  };
}

/**
 * Update a specific list with new data
 */
export function updateList(
  listName: 'personal' | 'disposable' | 'education',
  domains: string[],
  version: string
): void {
  lists[listName] = new Set(domains.map(d => d.toLowerCase()));
  lists.versions[listName] = version;
}

/**
 * Get current list versions
 */
export function getListVersions(): ListVersions {
  return { ...lists.versions };
}

/**
 * Check if domain matches personal/public email providers
 */
export function matchPersonalProvider(parsed: ParsedEmail): ListMatchResult {
  // Check exact domain match
  if (lists.personal.has(parsed.domain)) {
    return { matched: true, list: 'public_providers', matchType: 'exact' };
  }

  // Check registrable domain
  if (lists.personal.has(parsed.registrableDomain)) {
    return { matched: true, list: 'public_providers', matchType: 'registrable' };
  }

  return { matched: false };
}

/**
 * Check if domain matches disposable email providers
 */
export function matchDisposable(parsed: ParsedEmail): ListMatchResult {
  if (lists.disposable.has(parsed.domain)) {
    return { matched: true, list: 'disposable_domains', matchType: 'exact' };
  }

  if (lists.disposable.has(parsed.registrableDomain)) {
    return { matched: true, list: 'disposable_domains', matchType: 'registrable' };
  }

  return { matched: false };
}

/**
 * Check if domain matches education/academic institutions
 */
export function matchEducation(parsed: ParsedEmail): ListMatchResult {
  // Check exact domain match
  if (lists.education.has(parsed.domain)) {
    return { matched: true, list: 'swot', matchType: 'exact' };
  }

  // Check registrable domain
  if (lists.education.has(parsed.registrableDomain)) {
    return { matched: true, list: 'swot', matchType: 'registrable' };
  }

  // Check TLD patterns (.edu, .ac.uk, etc.)
  for (const pattern of EDUCATION_TLD_PATTERNS) {
    if (pattern.test(parsed.domain)) {
      return {
        matched: true,
        list: 'edu_tld_rules',
        matchType: 'tld_pattern',
        pattern: pattern.source,
      };
    }
  }

  return { matched: false };
}

/**
 * Check if domain matches government institutions
 */
export function matchGovernment(parsed: ParsedEmail): ListMatchResult {
  // Check exact domain match first
  if (lists.governmentExact.has(parsed.domain)) {
    return { matched: true, list: 'gov_domains', matchType: 'exact' };
  }

  if (lists.governmentExact.has(parsed.registrableDomain)) {
    return { matched: true, list: 'gov_domains', matchType: 'registrable' };
  }

  // Check government patterns
  for (const govPattern of lists.governmentPatterns) {
    if (govPattern.regex.test(parsed.domain)) {
      return {
        matched: true,
        list: 'gov_rules',
        matchType: 'tld_pattern',
        pattern: govPattern.pattern,
      };
    }
  }

  return { matched: false };
}

/**
 * Main matching function - checks all lists in priority order
 * Returns the first match found, or null if no match
 */
export function matchAllLists(parsed: ParsedEmail): {
  category: 'disposable' | 'personal' | 'education' | 'government' | null;
  match: ListMatchResult;
} {
  // Priority 1: Disposable
  const disposableMatch = matchDisposable(parsed);
  if (disposableMatch.matched) {
    return { category: 'disposable', match: disposableMatch };
  }

  // Priority 2: Personal providers
  const personalMatch = matchPersonalProvider(parsed);
  if (personalMatch.matched) {
    return { category: 'personal', match: personalMatch };
  }

  // Priority 3: Education
  const eduMatch = matchEducation(parsed);
  if (eduMatch.matched) {
    return { category: 'education', match: eduMatch };
  }

  // Priority 4: Government
  const govMatch = matchGovernment(parsed);
  if (govMatch.matched) {
    return { category: 'government', match: govMatch };
  }

  return { category: null, match: { matched: false } };
}

// Initialize with defaults on module load
initializeLists();
