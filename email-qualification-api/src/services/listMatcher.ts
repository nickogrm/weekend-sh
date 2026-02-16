import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ListMatchResult, ListVersions, ParsedEmail } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../data');

interface DomainLists {
  personal: Set<string>;
  disposable: Set<string>;
  education: Set<string>;
  governmentExact: Set<string>;
  governmentPatterns: GovPattern[];
  educationPatterns: RegExp[];
  versions: ListVersions;
}

interface GovPattern {
  pattern: string;
  regex: RegExp;
}

let lists: DomainLists = {
  personal: new Set(),
  disposable: new Set(),
  education: new Set(),
  governmentExact: new Set(),
  governmentPatterns: [],
  educationPatterns: [],
  versions: {
    personal: '0.0.0',
    disposable: '0.0.0',
    education: '0.0.0',
    government: '0.0.0',
  },
};

function loadJsonFile<T>(filename: string): T {
  const content = readFileSync(resolve(dataDir, filename), 'utf-8');
  return JSON.parse(content);
}

/**
 * Initialize lists from JSON data files
 */
export function initializeLists(): void {
  const now = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const personalDomains = loadJsonFile<string[]>('personal.json');
  const disposableDomains = loadJsonFile<string[]>('disposable.json');
  const eduData = loadJsonFile<{ domains: string[]; patterns: string[] }>('education.json');
  const govData = loadJsonFile<{ domains: string[]; patterns: { pattern: string; regex: string }[] }>('government.json');

  lists = {
    personal: new Set(personalDomains),
    disposable: new Set(disposableDomains),
    education: new Set(eduData.domains),
    governmentExact: new Set(govData.domains),
    governmentPatterns: govData.patterns.map(p => ({
      pattern: p.pattern,
      regex: new RegExp(p.regex, 'i'),
    })),
    educationPatterns: eduData.patterns.map(p => {
      const escaped = p.replace(/\./g, '\\.');
      return new RegExp(`${escaped}$`, 'i');
    }),
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
  for (const pattern of lists.educationPatterns) {
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
