import { hostAllowed, normalizeUrl, parseHttpUrl, resolveUrl } from "./urls";

export interface DiscoverOptions {
  /** Optional regular expression (string) an href must match, e.g. "ViewMasDirections\\.aspx\\?id=". */
  linkPattern?: string | null;
  allowedDomains: readonly string[];
  max?: number;
}

const DEFAULT_PATTERN =
  /(\.pdf(?:$|\?|#)|circular|notification|master-?direction|guideline|press-?release|legal)/i;

function safeRegExp(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

function decodeHref(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'");
}

/**
 * Pull candidate document links out of a listing page. Pure and bounded: it never
 * follows links, it only returns absolute, allow-listed, de-duplicated URLs.
 */
export function extractCandidateLinks(
  html: string,
  baseUrl: string,
  options: DiscoverOptions,
): string[] {
  const max = Math.max(1, options.max ?? 10);
  const rawPattern = options.linkPattern ?? null;
  const pattern = rawPattern ? safeRegExp(rawPattern) : null;
  if (rawPattern && !pattern) {
    return [];
  }
  const seen = new Set<string>();
  const results: string[] = [];

  const anchor = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchor.exec(html)) !== null) {
    const href = decodeHref(match[1] ?? match[2] ?? match[3] ?? "");
    const absolute = resolveUrl(baseUrl, href);
    if (!absolute) {
      continue;
    }

    const url = parseHttpUrl(absolute);
    if (!url || !hostAllowed(url, options.allowedDomains)) {
      continue;
    }

    const matches = pattern
      ? pattern.test(absolute) || pattern.test(href)
      : DEFAULT_PATTERN.test(url.pathname) || DEFAULT_PATTERN.test(url.search);

    if (!matches) {
      continue;
    }

    const key = normalizeUrl(absolute);
    if (key === "" || seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(absolute);
    if (results.length >= max) {
      break;
    }
  }

  return results;
}

/** A DIRECT source monitors a single known document URL for later changes. */
export function directCandidate(baseUrl: string, allowedDomains: readonly string[]): string[] {
  const url = parseHttpUrl(baseUrl);
  return url && hostAllowed(url, allowedDomains) ? [url.href] : [];
}
