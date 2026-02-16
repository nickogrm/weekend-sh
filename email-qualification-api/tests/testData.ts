import type { Verdict } from '../src/types/index.js';

interface TestCase {
  email: string;
  expectedVerdict: Verdict;
  description: string;
  flags?: string[];
}

// Comprehensive test dataset
export const TEST_CASES: TestCase[] = [
  // ============ PERSONAL PROVIDERS ============
  // Gmail variants
  { email: 'user@gmail.com', expectedVerdict: 'personal', description: 'Gmail standard' },
  { email: 'user@googlemail.com', expectedVerdict: 'personal', description: 'Gmail alternate' },
  { email: 'USER@GMAIL.COM', expectedVerdict: 'personal', description: 'Gmail uppercase' },
  { email: '  user@gmail.com  ', expectedVerdict: 'personal', description: 'Gmail with whitespace' },
  { email: 'user+tag@gmail.com', expectedVerdict: 'personal', description: 'Gmail plus addressing', flags: ['plus_addressing'] },

  // Microsoft
  { email: 'user@outlook.com', expectedVerdict: 'personal', description: 'Outlook' },
  { email: 'user@outlook.fr', expectedVerdict: 'personal', description: 'Outlook France' },
  { email: 'user@hotmail.com', expectedVerdict: 'personal', description: 'Hotmail' },
  { email: 'user@live.com', expectedVerdict: 'personal', description: 'Live' },
  { email: 'user@msn.com', expectedVerdict: 'personal', description: 'MSN' },

  // Yahoo
  { email: 'user@yahoo.com', expectedVerdict: 'personal', description: 'Yahoo US' },
  { email: 'user@yahoo.fr', expectedVerdict: 'personal', description: 'Yahoo France' },
  { email: 'user@ymail.com', expectedVerdict: 'personal', description: 'YMail' },

  // Apple
  { email: 'user@icloud.com', expectedVerdict: 'personal', description: 'iCloud' },
  { email: 'user@me.com', expectedVerdict: 'personal', description: 'Apple Me' },
  { email: 'user@mac.com', expectedVerdict: 'personal', description: 'Apple Mac' },

  // Other providers
  { email: 'user@protonmail.com', expectedVerdict: 'personal', description: 'ProtonMail' },
  { email: 'user@proton.me', expectedVerdict: 'personal', description: 'Proton.me' },
  { email: 'user@aol.com', expectedVerdict: 'personal', description: 'AOL' },
  { email: 'user@mail.com', expectedVerdict: 'personal', description: 'Mail.com' },
  { email: 'user@gmx.com', expectedVerdict: 'personal', description: 'GMX' },

  // French ISPs
  { email: 'user@free.fr', expectedVerdict: 'personal', description: 'Free.fr' },
  { email: 'user@orange.fr', expectedVerdict: 'personal', description: 'Orange.fr' },
  { email: 'user@wanadoo.fr', expectedVerdict: 'personal', description: 'Wanadoo' },
  { email: 'user@sfr.fr', expectedVerdict: 'personal', description: 'SFR' },
  { email: 'user@laposte.net', expectedVerdict: 'personal', description: 'La Poste' },

  // Russian providers
  { email: 'user@mail.ru', expectedVerdict: 'personal', description: 'Mail.ru' },
  { email: 'user@yandex.ru', expectedVerdict: 'personal', description: 'Yandex' },

  // Chinese providers
  { email: 'user@qq.com', expectedVerdict: 'personal', description: 'QQ Mail' },
  { email: 'user@163.com', expectedVerdict: 'personal', description: '163.com' },

  // ============ DISPOSABLE EMAILS ============
  { email: 'user@tempmail.com', expectedVerdict: 'disposable', description: 'TempMail' },
  { email: 'user@guerrillamail.com', expectedVerdict: 'disposable', description: 'Guerrilla Mail' },
  { email: 'user@mailinator.com', expectedVerdict: 'disposable', description: 'Mailinator' },
  { email: 'user@10minutemail.com', expectedVerdict: 'disposable', description: '10 Minute Mail' },
  { email: 'user@throwaway.email', expectedVerdict: 'disposable', description: 'Throwaway' },
  { email: 'user@yopmail.com', expectedVerdict: 'disposable', description: 'YOPmail' },
  { email: 'user@maildrop.cc', expectedVerdict: 'disposable', description: 'Maildrop' },

  // ============ EDUCATION ============
  // US Universities
  { email: 'student@stanford.edu', expectedVerdict: 'education', description: 'Stanford', flags: ['edu'] },
  { email: 'prof@mit.edu', expectedVerdict: 'education', description: 'MIT', flags: ['edu'] },
  { email: 'user@harvard.edu', expectedVerdict: 'education', description: 'Harvard', flags: ['edu'] },
  { email: 'user@berkeley.edu', expectedVerdict: 'education', description: 'Berkeley', flags: ['edu'] },
  { email: 'user@caltech.edu', expectedVerdict: 'education', description: 'Caltech', flags: ['edu'] },

  // UK Universities (.ac.uk)
  { email: 'student@ox.ac.uk', expectedVerdict: 'education', description: 'Oxford', flags: ['edu'] },
  { email: 'student@cam.ac.uk', expectedVerdict: 'education', description: 'Cambridge', flags: ['edu'] },
  { email: 'student@imperial.ac.uk', expectedVerdict: 'education', description: 'Imperial College', flags: ['edu'] },
  { email: 'user@ucl.ac.uk', expectedVerdict: 'education', description: 'UCL', flags: ['edu'] },

  // French universities
  { email: 'etudiant@univ-paris1.fr', expectedVerdict: 'education', description: 'Sorbonne', flags: ['edu'] },

  // Generic .edu TLD
  { email: 'user@random-school.edu', expectedVerdict: 'education', description: 'Generic .edu', flags: ['edu'] },
  { email: 'user@school.edu.au', expectedVerdict: 'education', description: 'Australian .edu.au', flags: ['edu'] },

  // ============ GOVERNMENT ============
  // US Government
  { email: 'contact@state.gov', expectedVerdict: 'government', description: 'US State Dept', flags: ['gov'] },
  { email: 'info@nasa.gov', expectedVerdict: 'government', description: 'NASA', flags: ['gov'] },
  { email: 'tip@fbi.gov', expectedVerdict: 'government', description: 'FBI', flags: ['gov'] },
  { email: 'user@whitehouse.gov', expectedVerdict: 'government', description: 'White House', flags: ['gov'] },

  // UK Government
  { email: 'contact@service.gov.uk', expectedVerdict: 'government', description: 'UK Gov', flags: ['gov'] },
  { email: 'user@nhs.gov.uk', expectedVerdict: 'government', description: 'NHS', flags: ['gov'] },

  // French Government
  { email: 'contact@service.gouv.fr', expectedVerdict: 'government', description: 'French Gov', flags: ['gov'] },
  { email: 'user@education.gouv.fr', expectedVerdict: 'government', description: 'French Education Ministry', flags: ['gov'] },
  { email: 'user@interieur.gouv.fr', expectedVerdict: 'government', description: 'French Interior Ministry', flags: ['gov'] },

  // Other governments
  { email: 'user@gov.au', expectedVerdict: 'government', description: 'Australian Gov', flags: ['gov'] },
  { email: 'user@service.gov.br', expectedVerdict: 'government', description: 'Brazilian Gov', flags: ['gov'] },
  { email: 'user@agency.gob.mx', expectedVerdict: 'government', description: 'Mexican Gov', flags: ['gov'] },

  // EU
  { email: 'user@europa.eu', expectedVerdict: 'government', description: 'EU', flags: ['gov'] },

  // ============ BUSINESS (PRIVATE B2B) ============
  { email: 'john@acme-corp.com', expectedVerdict: 'private_b2b', description: 'Standard business' },
  { email: 'sales@startup.io', expectedVerdict: 'private_b2b', description: 'Startup .io' },
  { email: 'contact@entreprise.fr', expectedVerdict: 'private_b2b', description: 'French business' },
  { email: 'info@company.co.uk', expectedVerdict: 'private_b2b', description: 'UK business' },
  { email: 'team@saas-product.app', expectedVerdict: 'private_b2b', description: '.app domain' },
  { email: 'hello@agency.design', expectedVerdict: 'private_b2b', description: '.design domain' },
  { email: 'user@mail.company.com', expectedVerdict: 'private_b2b', description: 'Subdomain business', flags: ['subdomain'] },

  // ============ EDGE CASES ============
  // Plus addressing on business
  { email: 'john+newsletter@company.com', expectedVerdict: 'private_b2b', description: 'Business plus addressing', flags: ['plus_addressing'] },

  // Subdomains
  { email: 'user@mail.acme.com', expectedVerdict: 'private_b2b', description: 'Mail subdomain', flags: ['subdomain'] },
  { email: 'user@support.company.io', expectedVerdict: 'private_b2b', description: 'Support subdomain', flags: ['subdomain'] },

  // International domains (IDN would be converted to punycode)
  { email: 'user@company.de', expectedVerdict: 'private_b2b', description: 'German domain' },
  { email: 'user@societe.fr', expectedVerdict: 'private_b2b', description: 'French domain' },

  // ============ INVALID EMAILS ============
  { email: 'not-an-email', expectedVerdict: 'unknown', description: 'No @ symbol', flags: ['invalid_syntax'] },
  { email: '@domain.com', expectedVerdict: 'unknown', description: 'No local part', flags: ['invalid_syntax'] },
  { email: 'user@', expectedVerdict: 'unknown', description: 'No domain', flags: ['invalid_syntax'] },
  { email: 'user@domain', expectedVerdict: 'unknown', description: 'No TLD', flags: ['invalid_syntax'] },
  { email: '', expectedVerdict: 'unknown', description: 'Empty string', flags: ['invalid_syntax'] },
  { email: '   ', expectedVerdict: 'unknown', description: 'Whitespace only', flags: ['invalid_syntax'] },
];

// Group test cases by verdict for easier testing
export const TEST_CASES_BY_VERDICT = {
  personal: TEST_CASES.filter(t => t.expectedVerdict === 'personal'),
  disposable: TEST_CASES.filter(t => t.expectedVerdict === 'disposable'),
  education: TEST_CASES.filter(t => t.expectedVerdict === 'education'),
  government: TEST_CASES.filter(t => t.expectedVerdict === 'government'),
  private_b2b: TEST_CASES.filter(t => t.expectedVerdict === 'private_b2b'),
  unknown: TEST_CASES.filter(t => t.expectedVerdict === 'unknown'),
};

// Edge cases that need special attention
export const EDGE_CASES = TEST_CASES.filter(t =>
  t.description.includes('subdomain') ||
  t.description.includes('plus') ||
  t.description.includes('whitespace') ||
  t.description.includes('uppercase')
);

// Known false positive risks (for monitoring)
export const FALSE_POSITIVE_RISKS = [
  { email: 'user@startup-on-google-workspace.com', note: 'Business on Google Workspace might look like personal' },
  { email: 'user@private-school.com', note: 'Private school not in SWOT might be classified as B2B' },
  { email: 'user@contractor-for-gov.com', note: 'Government contractor on custom domain is B2B' },
];
