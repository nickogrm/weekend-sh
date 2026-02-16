import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeLists,
  matchPersonalProvider,
  matchDisposable,
  matchEducation,
  matchGovernment,
  matchAllLists,
  getListVersions,
} from '../src/services/listMatcher.js';
import { parseEmail } from '../src/services/domainParser.js';

describe('listMatcher', () => {
  beforeEach(() => {
    initializeLists();
  });

  describe('matchPersonalProvider', () => {
    it('matches Gmail', () => {
      const parsed = parseEmail('user@gmail.com')!;
      const result = matchPersonalProvider(parsed);
      expect(result.matched).toBe(true);
      expect(result.list).toBe('public_providers');
    });

    it('matches Outlook', () => {
      const parsed = parseEmail('user@outlook.com')!;
      const result = matchPersonalProvider(parsed);
      expect(result.matched).toBe(true);
    });

    it('matches Yahoo variants', () => {
      for (const domain of ['yahoo.com', 'yahoo.fr', 'ymail.com']) {
        const parsed = parseEmail(`user@${domain}`)!;
        const result = matchPersonalProvider(parsed);
        expect(result.matched, `Expected ${domain} to match`).toBe(true);
      }
    });

    it('matches French ISPs', () => {
      for (const domain of ['free.fr', 'orange.fr', 'sfr.fr', 'laposte.net']) {
        const parsed = parseEmail(`user@${domain}`)!;
        const result = matchPersonalProvider(parsed);
        expect(result.matched, `Expected ${domain} to match`).toBe(true);
      }
    });

    it('does not match business domains', () => {
      const parsed = parseEmail('user@company.com')!;
      const result = matchPersonalProvider(parsed);
      expect(result.matched).toBe(false);
    });
  });

  describe('matchDisposable', () => {
    it('matches known disposable domains', () => {
      for (const domain of ['tempmail.com', 'guerrillamail.com', 'mailinator.com', 'yopmail.com']) {
        const parsed = parseEmail(`user@${domain}`)!;
        const result = matchDisposable(parsed);
        expect(result.matched, `Expected ${domain} to match`).toBe(true);
        expect(result.list).toBe('disposable_domains');
      }
    });

    it('does not match legitimate domains', () => {
      const parsed = parseEmail('user@company.com')!;
      const result = matchDisposable(parsed);
      expect(result.matched).toBe(false);
    });
  });

  describe('matchEducation', () => {
    it('matches US .edu domains', () => {
      const domains = ['stanford.edu', 'mit.edu', 'harvard.edu'];
      for (const domain of domains) {
        const parsed = parseEmail(`user@${domain}`)!;
        const result = matchEducation(parsed);
        expect(result.matched, `Expected ${domain} to match`).toBe(true);
      }
    });

    it('matches UK .ac.uk domains', () => {
      const domains = ['ox.ac.uk', 'cam.ac.uk', 'imperial.ac.uk'];
      for (const domain of domains) {
        const parsed = parseEmail(`user@${domain}`)!;
        const result = matchEducation(parsed);
        expect(result.matched, `Expected ${domain} to match`).toBe(true);
      }
    });

    it('matches generic .edu TLD', () => {
      const parsed = parseEmail('user@unknown-school.edu')!;
      const result = matchEducation(parsed);
      expect(result.matched).toBe(true);
      expect(result.matchType).toBe('tld_pattern');
    });

    it('matches .ac.* TLD pattern', () => {
      const parsed = parseEmail('user@unknown.ac.jp')!;
      const result = matchEducation(parsed);
      expect(result.matched).toBe(true);
      expect(result.matchType).toBe('tld_pattern');
    });

    it('does not match business domains', () => {
      const parsed = parseEmail('user@education-company.com')!;
      const result = matchEducation(parsed);
      expect(result.matched).toBe(false);
    });
  });

  describe('matchGovernment', () => {
    it('matches US .gov domains', () => {
      const domains = ['state.gov', 'nasa.gov', 'fbi.gov'];
      for (const domain of domains) {
        const parsed = parseEmail(`user@${domain}`)!;
        const result = matchGovernment(parsed);
        expect(result.matched, `Expected ${domain} to match`).toBe(true);
      }
    });

    it('matches UK .gov.uk domains', () => {
      const parsed = parseEmail('user@service.gov.uk')!;
      const result = matchGovernment(parsed);
      expect(result.matched).toBe(true);
      expect(result.matchType).toBe('tld_pattern');
    });

    it('matches French .gouv.fr domains', () => {
      const parsed = parseEmail('user@education.gouv.fr')!;
      const result = matchGovernment(parsed);
      expect(result.matched).toBe(true);
      expect(result.matchType).toBe('tld_pattern');
      expect(result.pattern).toContain('gouv.fr');
    });

    it('matches EU domains', () => {
      const parsed = parseEmail('user@europa.eu')!;
      const result = matchGovernment(parsed);
      expect(result.matched).toBe(true);
    });

    it('matches generic .gov.* pattern', () => {
      const parsed = parseEmail('user@agency.gov.br')!;
      const result = matchGovernment(parsed);
      expect(result.matched).toBe(true);
    });

    it('does not match business domains', () => {
      const parsed = parseEmail('user@government-consulting.com')!;
      const result = matchGovernment(parsed);
      expect(result.matched).toBe(false);
    });
  });

  describe('matchAllLists', () => {
    it('returns disposable for temp emails (highest priority)', () => {
      const parsed = parseEmail('user@tempmail.com')!;
      const { category, match } = matchAllLists(parsed);
      expect(category).toBe('disposable');
      expect(match.matched).toBe(true);
    });

    it('returns personal for Gmail', () => {
      const parsed = parseEmail('user@gmail.com')!;
      const { category, match } = matchAllLists(parsed);
      expect(category).toBe('personal');
      expect(match.matched).toBe(true);
    });

    it('returns education for .edu domains', () => {
      const parsed = parseEmail('user@stanford.edu')!;
      const { category, match } = matchAllLists(parsed);
      expect(category).toBe('education');
      expect(match.matched).toBe(true);
    });

    it('returns government for .gov domains', () => {
      const parsed = parseEmail('user@nasa.gov')!;
      const { category, match } = matchAllLists(parsed);
      expect(category).toBe('government');
      expect(match.matched).toBe(true);
    });

    it('returns null category for business domains', () => {
      const parsed = parseEmail('user@company.com')!;
      const { category, match } = matchAllLists(parsed);
      expect(category).toBeNull();
      expect(match.matched).toBe(false);
    });
  });

  describe('getListVersions', () => {
    it('returns version strings for all lists', () => {
      const versions = getListVersions();
      expect(versions.personal).toBeDefined();
      expect(versions.disposable).toBeDefined();
      expect(versions.education).toBeDefined();
      expect(versions.government).toBeDefined();
    });
  });
});
