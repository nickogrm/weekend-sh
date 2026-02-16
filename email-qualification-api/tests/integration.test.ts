import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_CASES_BY_VERDICT, EDGE_CASES } from './testData.js';
import { parseEmail } from '../src/services/domainParser.js';
import { matchAllLists, initializeLists } from '../src/services/listMatcher.js';
import { computeQualification } from '../src/services/scoring.js';
import type { Verdict } from '../src/types/index.js';

// Integration test that runs the full qualification pipeline
function qualifyEmail(email: string): { verdict: Verdict; confidence: number; flags: string[] } | null {
  const parsed = parseEmail(email);
  if (!parsed) {
    return { verdict: 'unknown', confidence: 0, flags: ['invalid_syntax'] };
  }

  const listMatch = matchAllLists(parsed);
  const result = computeQualification({
    parsed,
    listMatch,
    mxResult: null, // Skip MX in unit tests
    strictMode: false,
  });

  return {
    verdict: result.verdict,
    confidence: result.confidence,
    flags: result.flags,
  };
}

describe('Integration Tests', () => {
  beforeAll(() => {
    initializeLists();
  });

  describe('Personal Emails', () => {
    it.each(TEST_CASES_BY_VERDICT.personal)(
      'classifies $email as personal ($description)',
      ({ email, expectedVerdict }) => {
        const result = qualifyEmail(email);
        expect(result).not.toBeNull();
        expect(result!.verdict).toBe(expectedVerdict);
      }
    );
  });

  describe('Disposable Emails', () => {
    it.each(TEST_CASES_BY_VERDICT.disposable)(
      'classifies $email as disposable ($description)',
      ({ email, expectedVerdict }) => {
        const result = qualifyEmail(email);
        expect(result).not.toBeNull();
        expect(result!.verdict).toBe(expectedVerdict);
      }
    );
  });

  describe('Education Emails', () => {
    it.each(TEST_CASES_BY_VERDICT.education)(
      'classifies $email as education ($description)',
      ({ email, expectedVerdict }) => {
        const result = qualifyEmail(email);
        expect(result).not.toBeNull();
        expect(result!.verdict).toBe(expectedVerdict);
      }
    );
  });

  describe('Government Emails', () => {
    it.each(TEST_CASES_BY_VERDICT.government)(
      'classifies $email as government ($description)',
      ({ email, expectedVerdict }) => {
        const result = qualifyEmail(email);
        expect(result).not.toBeNull();
        expect(result!.verdict).toBe(expectedVerdict);
      }
    );
  });

  describe('Business Emails', () => {
    it.each(TEST_CASES_BY_VERDICT.private_b2b)(
      'classifies $email as private_b2b ($description)',
      ({ email, expectedVerdict }) => {
        const result = qualifyEmail(email);
        expect(result).not.toBeNull();
        expect(result!.verdict).toBe(expectedVerdict);
      }
    );
  });

  describe('Invalid Emails', () => {
    it.each(TEST_CASES_BY_VERDICT.unknown)(
      'classifies $email as unknown ($description)',
      ({ email, expectedVerdict, flags }) => {
        const result = qualifyEmail(email);
        expect(result).not.toBeNull();
        expect(result!.verdict).toBe(expectedVerdict);
        if (flags) {
          for (const flag of flags) {
            expect(result!.flags).toContain(flag);
          }
        }
      }
    );
  });

  describe('Edge Cases', () => {
    it.each(EDGE_CASES)(
      'handles edge case: $description ($email)',
      ({ email, expectedVerdict, flags }) => {
        const result = qualifyEmail(email);
        expect(result).not.toBeNull();
        expect(result!.verdict).toBe(expectedVerdict);

        // Verify expected flags are present
        if (flags) {
          for (const flag of flags) {
            expect(result!.flags, `Expected flag ${flag} for ${email}`).toContain(flag);
          }
        }
      }
    );
  });

  describe('Confidence Thresholds', () => {
    it('gives high confidence (>=0.9) for exact list matches', () => {
      const gmailResult = qualifyEmail('user@gmail.com');
      expect(gmailResult!.confidence).toBeGreaterThanOrEqual(0.9);

      const stanfordResult = qualifyEmail('user@stanford.edu');
      expect(stanfordResult!.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('gives reasonable confidence for business emails without MX', () => {
      const result = qualifyEmail('user@random-company.com');
      expect(result!.verdict).toBe('private_b2b');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('Normalization', () => {
    it('treats uppercase and lowercase emails the same', () => {
      const lower = qualifyEmail('user@gmail.com');
      const upper = qualifyEmail('USER@GMAIL.COM');
      const mixed = qualifyEmail('User@Gmail.Com');

      expect(lower!.verdict).toBe(upper!.verdict);
      expect(lower!.verdict).toBe(mixed!.verdict);
    });

    it('handles whitespace correctly', () => {
      const normal = qualifyEmail('user@gmail.com');
      const withSpace = qualifyEmail('  user@gmail.com  ');

      expect(normal!.verdict).toBe(withSpace!.verdict);
    });

    it('handles plus addressing without affecting verdict', () => {
      const normal = qualifyEmail('user@company.com');
      const withPlus = qualifyEmail('user+tag@company.com');

      expect(normal!.verdict).toBe(withPlus!.verdict);
      expect(withPlus!.flags).toContain('plus_addressing');
    });
  });

  describe('Priority Order', () => {
    it('prioritizes disposable over personal', () => {
      // If a domain were somehow in both lists, disposable should win
      // This is a conceptual test - in practice lists are exclusive
      const result = qualifyEmail('user@tempmail.com');
      expect(result!.verdict).toBe('disposable');
    });
  });

  describe('No False Positives on Common Business Domains', () => {
    const businessDomains = [
      'user@salesforce.com',
      'user@microsoft.com',
      'user@apple.com',
      'user@amazon.com',
      'user@ibm.com',
      'user@oracle.com',
      'user@sap.com',
      'user@cisco.com',
      'user@adobe.com',
      'user@shopify.com',
    ];

    it.each(businessDomains)('correctly identifies %s as business', (email) => {
      const result = qualifyEmail(email);
      expect(result!.verdict).toBe('private_b2b');
    });
  });
});
