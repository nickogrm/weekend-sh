import { describe, it, expect } from 'vitest';
import {
  validateEmailSyntax,
  parseEmail,
  extractDomain,
  getRegistrableDomain,
} from '../src/services/domainParser.js';

describe('domainParser', () => {
  describe('validateEmailSyntax', () => {
    it('accepts valid emails', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user123@example.co.uk',
        'USER@EXAMPLE.COM',
        'a@b.co',
      ];

      for (const email of validEmails) {
        const result = validateEmailSyntax(email);
        expect(result.valid, `Expected ${email} to be valid`).toBe(true);
      }
    });

    it('rejects invalid emails', () => {
      const invalidEmails = [
        '',
        '   ',
        'not-an-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user@@domain.com',
        'user@domain..com',
      ];

      for (const email of invalidEmails) {
        const result = validateEmailSyntax(email);
        expect(result.valid, `Expected ${email} to be invalid`).toBe(false);
      }
    });

    it('rejects emails exceeding max length', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateEmailSyntax(longEmail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum length');
    });

    it('handles whitespace by trimming', () => {
      const result = validateEmailSyntax('  user@example.com  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('parseEmail', () => {
    it('parses standard email correctly', () => {
      const result = parseEmail('user@example.com');
      expect(result).not.toBeNull();
      expect(result!.local).toBe('user');
      expect(result!.domain).toBe('example.com');
      expect(result!.registrableDomain).toBe('example.com');
      expect(result!.tld).toBe('com');
      expect(result!.isSubdomain).toBe(false);
    });

    it('handles subdomains', () => {
      const result = parseEmail('user@mail.example.com');
      expect(result).not.toBeNull();
      expect(result!.domain).toBe('mail.example.com');
      expect(result!.registrableDomain).toBe('example.com');
      expect(result!.isSubdomain).toBe(true);
    });

    it('handles multi-part TLDs (ac.uk)', () => {
      const result = parseEmail('student@ox.ac.uk');
      expect(result).not.toBeNull();
      expect(result!.domain).toBe('ox.ac.uk');
      expect(result!.registrableDomain).toBe('ox.ac.uk');
      expect(result!.tld).toBe('ac.uk');
      expect(result!.isSubdomain).toBe(false);
    });

    it('handles French government domains (gouv.fr)', () => {
      const result = parseEmail('user@service.gouv.fr');
      expect(result).not.toBeNull();
      expect(result!.domain).toBe('service.gouv.fr');
      // gouv.fr is a public suffix, so service.gouv.fr is the registrable domain
      expect(result!.registrableDomain).toBe('service.gouv.fr');
    });

    it('handles plus addressing', () => {
      const result = parseEmail('user+newsletter@example.com');
      expect(result).not.toBeNull();
      expect(result!.local).toBe('user+newsletter');
      expect(result!.localNormalized).toBe('user');
      expect(result!.isPlusAddressing).toBe(true);
    });

    it('normalizes to lowercase', () => {
      const result = parseEmail('USER@EXAMPLE.COM');
      expect(result).not.toBeNull();
      expect(result!.local).toBe('user');
      expect(result!.domain).toBe('example.com');
    });

    it('returns null for invalid emails', () => {
      expect(parseEmail('not-an-email')).toBeNull();
      expect(parseEmail('')).toBeNull();
      expect(parseEmail('@domain.com')).toBeNull();
    });

    it('handles deep subdomains', () => {
      const result = parseEmail('user@dept.mail.company.com');
      expect(result).not.toBeNull();
      expect(result!.domain).toBe('dept.mail.company.com');
      expect(result!.registrableDomain).toBe('company.com');
      expect(result!.isSubdomain).toBe(true);
    });
  });

  describe('extractDomain', () => {
    it('extracts domain from email', () => {
      expect(extractDomain('user@example.com')).toBe('example.com');
      expect(extractDomain('user@EXAMPLE.COM')).toBe('example.com');
      expect(extractDomain('user@sub.example.com')).toBe('sub.example.com');
    });

    it('returns null for invalid input', () => {
      expect(extractDomain('no-at-symbol')).toBeNull();
    });
  });

  describe('getRegistrableDomain', () => {
    it('returns registrable domain for simple domains', () => {
      expect(getRegistrableDomain('example.com')).toBe('example.com');
      expect(getRegistrableDomain('sub.example.com')).toBe('example.com');
    });

    it('handles multi-part TLDs', () => {
      expect(getRegistrableDomain('ox.ac.uk')).toBe('ox.ac.uk');
      expect(getRegistrableDomain('student.ox.ac.uk')).toBe('ox.ac.uk');
    });
  });
});
