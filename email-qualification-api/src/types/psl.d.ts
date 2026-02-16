declare module 'psl' {
  interface ParsedDomain {
    input: string;
    tld: string | null;
    sld: string | null;
    domain: string | null;
    subdomain: string | null;
    listed: boolean;
    error?: { code: string; message: string };
  }

  export function parse(domain: string): ParsedDomain;
  export function get(domain: string): string | null;
  export function isValid(domain: string): boolean;
}
