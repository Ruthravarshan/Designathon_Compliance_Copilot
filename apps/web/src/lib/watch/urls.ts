/**
 * URL safety helpers for the regulatory watchdog. Everything here is pure so the
 * server fetch layer can share the exact same decisions and the rules are testable.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata", "metadata.google.internal"]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number.parseInt(part, 10);
    if (octet < 0 || octet > 255) {
      return null;
    }
    octets.push(octet);
  }

  return octets;
}

/** True for loopback, private, link-local, CGNAT, multicast, and metadata ranges. */
export function isPrivateIp(value: string): boolean {
  // Strip IPv6 literal brackets so bracketed loopback/private forms cannot slip
  // through the anchored checks below.
  const ip = value
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  if (ip.includes(":")) {
    // IPv6: loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10),
    // multicast, 6to4/NAT64 tunnels, and IPv4-embedded forms (mapped or compatible).
    if (ip === "::1" || ip === "::") {
      return true;
    }
    if (ip.startsWith("fc") || ip.startsWith("fd")) {
      return true;
    }
    if (/^fe[89ab]/.test(ip) || ip.startsWith("ff")) {
      return true;
    }
    if (/^64:ff9b::/.test(ip) || ip.startsWith("2002:")) {
      return true;
    }
    const embedded = /^(?:::ffff:|::)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
    if (embedded) {
      return isPrivateIp(embedded[1] ?? "");
    }
    // Conservative default: only global unicast (2000::/3) is considered public.
    // This blocks hex-encoded IPv4-compatible forms such as ::7f00:1 that the
    // URL parser normalises from bracketed loopback literals.
    if (!/^2[0-9a-f]/.test(ip)) {
      return true;
    }
    return false;
  }

  const octets = parseIpv4(ip);
  if (!octets) {
    return false;
  }

  const [a = 0, b = 0] = octets;

  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 192 && b === 0) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  if (a >= 224) {
    return true;
  }

  return false;
}

/** Reject hostnames that must never be fetched, before and after DNS resolution. */
export function isDisallowedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (host === "") {
    return true;
  }
  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return true;
  }
  if (parseIpv4(host) || host.includes(":")) {
    return isPrivateIp(host);
  }
  return false;
}

/** Parse an absolute http(s) URL without credentials. */
export function parseHttpUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (url.username || url.password) {
    return null;
  }
  // Non-default ports are a common SSRF route to internal services (Redis,
  // Postgres, admin panels). Only the scheme's default port is permitted.
  const expectedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port !== "" && url.port !== expectedPort) {
    return null;
  }
  if (isDisallowedHostname(url.hostname)) {
    return null;
  }

  return url;
}

/** Host must equal an allowed domain or be a subdomain of it. Empty allowlist denies. */
export function hostAllowed(url: URL, allowedDomains: readonly string[]): boolean {
  if (allowedDomains.length === 0) {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return allowedDomains.some((domain) => {
    const normalized = domain.trim().toLowerCase().replace(/^\./, "").replace(/\.$/, "");
    return normalized !== "" && (host === normalized || host.endsWith(`.${normalized}`));
  });
}

/** Canonical form used for de-duplication: lower host, no hash, no default port. */
export function normalizeUrl(value: string): string {
  const url = parseHttpUrl(value);
  if (!url) {
    return "";
  }
  const defaultPort = url.protocol === "https:" ? "443" : "80";
  const port = url.port === defaultPort ? "" : url.port;
  const search = url.search;
  return `${url.protocol}//${url.hostname.toLowerCase()}${port ? `:${port}` : ""}${url.pathname}${search}`;
}

/** Resolve an href against a base URL, keeping only safe absolute http(s) URLs. */
export function resolveUrl(base: string, href: string): string | null {
  const cleaned = href.trim().replace(/^['"]|['"]$/g, "");
  if (
    cleaned === "" ||
    cleaned.startsWith("#") ||
    cleaned.toLowerCase().startsWith("javascript:")
  ) {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(cleaned, base);
  } catch {
    return null;
  }

  return parseHttpUrl(resolved.href)?.href ?? null;
}
