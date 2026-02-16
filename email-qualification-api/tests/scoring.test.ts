import { describe, it, expect } from 'vitest';
import {
  computeQualification,
  isPrivateB2B,
  isBusinessEmail,
} from '../src/services/scoring.js';
import type { ParsedEmail, MxLookupResult } from '../src/types/index.js';

describe('scoring', () => {
  const mockParsedEmail: ParsedEmail = {
    local: 'user',
    localNormalized: 'user',
    domain: 'example.com',
    registrableDomain: 'example.com',
    tld: 'com',
    isSubdomain: false,
    isPlusAddressing: false,
    isIdn: false,
  };

  describe('computeQualification', () => {
    it('returns personal verdict for personal provider match', () => {
      const result = computeQualification({
        parsed: { ...mockParsedEmail, registrableDomain: 'gmail.com' },
        listMatch: {
          category: 'personal',
          match: { matched: true, list: 'public_providers', matchType: 'exact' },
        },
        mxResult: null,
        strictMode: false,
      });

      expect(result.verdict).toBe('personal');
      expect(result.flags).toContain('public_provider');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('returns disposable verdict for disposable match', () => {
      const result = computeQualification({
        parsed: { ...mockParsedEmail, registrableDomain: 'tempmail.com' },
        listMatch: {
          category: 'disposable',
          match: { matched: true, list: 'disposable_domains', matchType: 'exact' },
        },
        mxResult: null,
        strictMode: false,
      });

      expect(result.verdict).toBe('disposable');
      expect(result.flags).toContain('disposable');
    });

    it('returns education verdict for edu match', () => {
      const result = computeQualification({
        parsed: { ...mockParsedEmail, registrableDomain: 'stanford.edu', tld: 'edu' },
        listMatch: {
          category: 'education',
          match: { matched: true, list: 'swot', matchType: 'exact' },
        },
        mxResult: null,
        strictMode: false,
      });

      expect(result.verdict).toBe('education');
      expect(result.flags).toContain('edu');
    });

    it('returns government verdict for gov match', () => {
      const result = computeQualification({
        parsed: { ...mockParsedEmail, registrableDomain: 'nasa.gov', tld: 'gov' },
        listMatch: {
          category: 'government',
          match: { matched: true, list: 'gov_rules', matchType: 'tld_pattern', pattern: '*.gov' },
        },
        mxResult: null,
        strictMode: false,
      });

      expect(result.verdict).toBe('government');
      expect(result.flags).toContain('gov');
    });

    it('returns private_b2b for business with valid MX', () => {
      const mxResult: MxLookupResult = {
        hasMx: true,
        records: ['aspmx.l.google.com'],
        provider: 'google',
        timedOut: false,
        cached: false,
      };

      const result = computeQualification({
        parsed: mockParsedEmail,
        listMatch: { category: null, match: { matched: false } },
        mxResult,
        strictMode: false,
      });

      expect(result.verdict).toBe('private_b2b');
      expect(result.flags).toContain('mx_google');
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('returns private_b2b in non-strict mode without MX check', () => {
      const result = computeQualification({
        parsed: mockParsedEmail,
        listMatch: { category: null, match: { matched: false } },
        mxResult: null,
        strictMode: false,
      });

      expect(result.verdict).toBe('private_b2b');
    });

    it('returns unknown in strict mode without MX', () => {
      const mxResult: MxLookupResult = {
        hasMx: false,
        records: [],
        timedOut: false,
        cached: false,
      };

      const result = computeQualification({
        parsed: mockParsedEmail,
        listMatch: { category: null, match: { matched: false } },
        mxResult,
        strictMode: true,
      });

      expect(result.verdict).toBe('unknown');
      expect(result.flags).toContain('no_mx');
    });

    it('includes subdomain flag when applicable', () => {
      const result = computeQualification({
        parsed: { ...mockParsedEmail, isSubdomain: true },
        listMatch: { category: null, match: { matched: false } },
        mxResult: null,
        strictMode: false,
      });

      expect(result.flags).toContain('subdomain');
    });

    it('includes plus_addressing flag when applicable', () => {
      const result = computeQualification({
        parsed: { ...mockParsedEmail, isPlusAddressing: true },
        listMatch: { category: null, match: { matched: false } },
        mxResult: null,
        strictMode: false,
      });

      expect(result.flags).toContain('plus_addressing');
    });

    it('handles MX timeout gracefully', () => {
      const mxResult: MxLookupResult = {
        hasMx: false,
        records: [],
        timedOut: true,
        cached: false,
      };

      const result = computeQualification({
        parsed: mockParsedEmail,
        listMatch: { category: null, match: { matched: false } },
        mxResult,
        strictMode: false,
      });

      expect(result.flags).toContain('mx_timeout');
    });
  });

  describe('isPrivateB2B', () => {
    it('returns true only for private_b2b verdict', () => {
      expect(isPrivateB2B('private_b2b')).toBe(true);
      expect(isPrivateB2B('personal')).toBe(false);
      expect(isPrivateB2B('education')).toBe(false);
      expect(isPrivateB2B('government')).toBe(false);
      expect(isPrivateB2B('disposable')).toBe(false);
      expect(isPrivateB2B('unknown')).toBe(false);
    });
  });

  describe('isBusinessEmail', () => {
    it('returns true for business-related verdicts', () => {
      expect(isBusinessEmail('private_b2b')).toBe(true);
      expect(isBusinessEmail('education')).toBe(true);
      expect(isBusinessEmail('government')).toBe(true);
    });

    it('returns false for non-business verdicts', () => {
      expect(isBusinessEmail('personal')).toBe(false);
      expect(isBusinessEmail('disposable')).toBe(false);
      expect(isBusinessEmail('unknown')).toBe(false);
    });
  });

  describe('confidence scoring', () => {
    it('gives higher confidence for exact matches', () => {
      const exactMatch = computeQualification({
        parsed: mockParsedEmail,
        listMatch: {
          category: 'personal',
          match: { matched: true, list: 'public_providers', matchType: 'exact' },
        },
        mxResult: null,
        strictMode: false,
      });

      const registrableMatch = computeQualification({
        parsed: mockParsedEmail,
        listMatch: {
          category: 'personal',
          match: { matched: true, list: 'public_providers', matchType: 'registrable' },
        },
        mxResult: null,
        strictMode: false,
      });

      expect(exactMatch.confidence).toBeGreaterThan(registrableMatch.confidence);
    });

    it('increases confidence with valid MX for business', () => {
      const withoutMx = computeQualification({
        parsed: mockParsedEmail,
        listMatch: { category: null, match: { matched: false } },
        mxResult: null,
        strictMode: false,
      });

      const withMx = computeQualification({
        parsed: mockParsedEmail,
        listMatch: { category: null, match: { matched: false } },
        mxResult: {
          hasMx: true,
          records: ['mail.example.com'],
          provider: 'other',
          timedOut: false,
          cached: false,
        },
        strictMode: false,
      });

      expect(withMx.confidence).toBeGreaterThan(withoutMx.confidence);
    });
  });
});
