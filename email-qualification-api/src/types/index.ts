// Verdict types
export type Verdict = 'private_b2b' | 'education' | 'government' | 'personal' | 'disposable' | 'unknown';

export type Flag =
  | 'invalid_syntax'
  | 'public_provider'
  | 'disposable'
  | 'edu'
  | 'gov'
  | 'no_mx'
  | 'mx_google'
  | 'mx_microsoft'
  | 'mx_timeout'
  | 'subdomain'
  | 'plus_addressing'
  | 'idn'
  | 'new_domain';

export type StoreMode = 'none' | 'hash' | 'plain';
export type MatchType = 'exact' | 'registrable' | 'suffix' | 'tld_pattern';

// Request types
export interface QualifyContext {
  form_id?: string;
  page_url?: string;
  referrer?: string;
  ip?: string;
  user_agent?: string;
  lead_id?: string;
  campaign?: string;
  source?: string;
}

export interface QualifyOptions {
  strict_mode?: boolean;
  enable_mx_check?: boolean;
  store_mode?: StoreMode;
  ttl_days?: number;
}

export interface QualifyEmailRequest {
  email: string;
  context?: QualifyContext;
  options?: QualifyOptions;
}

// Response types
export interface DomainInfo {
  raw: string;
  registrable: string;
  tld: string;
}

export interface ProviderMatch {
  list: string;
  match_type: MatchType;
  pattern?: string;
}

export interface ListVersions {
  personal: string;
  disposable: string;
  education: string;
  government: string;
}

export interface ResponseMetadata {
  request_id: string;
  timestamp: string;
  latency_ms: number;
  cache_hit: boolean;
  mx_checked: boolean;
  mx_records_count: number | null;
  list_versions: ListVersions;
}

export interface QualifyEmailResponse {
  verdict: Verdict;
  is_business_email: boolean;
  is_private_b2b: boolean;
  confidence: number;
  flags: Flag[];
  reasons: string[];
  domain: DomainInfo;
  provider_match: ProviderMatch | null;
  metadata: ResponseMetadata;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ErrorResponse {
  error: ErrorDetail;
  metadata: {
    request_id: string;
    timestamp: string;
  };
}

// Internal types
export interface ParsedEmail {
  local: string;
  localNormalized: string; // without plus addressing
  domain: string;
  registrableDomain: string;
  tld: string;
  isSubdomain: boolean;
  isPlusAddressing: boolean;
  isIdn: boolean;
}

export interface ListMatchResult {
  matched: boolean;
  list?: string;
  matchType?: MatchType;
  pattern?: string;
}

export interface MxLookupResult {
  hasMx: boolean;
  records: string[];
  provider?: 'google' | 'microsoft' | 'other';
  timedOut: boolean;
  cached: boolean;
}

export interface QualificationResult {
  verdict: Verdict;
  confidence: number;
  flags: Flag[];
  reasons: string[];
  providerMatch: ProviderMatch | null;
}

// API Key types
export interface ApiKeyInfo {
  id: string;
  client_id: string;
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  scopes: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  cors_origins: string[];
  created_at: Date;
  expires_at?: Date;
}

// Logging types
export interface QualifyLogEvent {
  level: string;
  timestamp: string;
  request_id: string;
  event: 'email_qualified';
  client_id: string;
  verdict: Verdict;
  confidence: number;
  flags: Flag[];
  domain: string;
  tld: string;
  mx_provider?: string;
  latency_ms: number;
  cache_hit: boolean;
  form_id?: string;
  page_url?: string;
  campaign?: string;
}
