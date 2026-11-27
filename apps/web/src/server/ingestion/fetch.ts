import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { z } from "zod";
import { IngestionError } from "./errors";

const MAX_URL_LENGTH = 2048;
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_REDIRECTS = 5;
const ROBOTS_MAX_BYTES = 256 * 1024;
const ROBOTS_TTL_MS = 15 * 60_000;
const ROBOTS_CACHE_LIMIT = 64;

const urlSchema = z.string().trim().min(1).max(MAX_URL_LENGTH).url();

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface TransportResult {
  status: number;
  headers: Record<string, string>;
  bytes: Uint8Array;
}

export interface TransportInput {
  url: URL;
  address: ResolvedAddress;
  headers: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
}

export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;
export type FetchTransport = (input: TransportInput) => Promise<TransportResult>;

export interface RobotsRule {
  path: string;
  allowed: boolean;
}

export interface RobotsCache {
  get(origin: string): { rules: RobotsRule[]; fetchedAt: number } | null;
  set(origin: string, value: { rules: RobotsRule[]; fetchedAt: number }): void;
}

export interface FetchOptions {
  allowedDomains: readonly string[];
  userAgent: string;
  allowHttp?: boolean;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  resolve?: AddressResolver;
  transport?: FetchTransport;
  robotsCache?: RobotsCache;
  /** Callers that must inspect 401/403/404 (robots.txt) opt in explicitly. */
  acceptNonSuccess?: boolean;
  now?: () => number;
}

export interface FetchedResource {
  url: URL;
  status: number;
  contentType: string | null;
  bytes: Uint8Array;
  retrievedAt: Date;
}

function normalizeHost(value: string): string {
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  if (!host || host.includes("/") || host.includes(":")) {
    return "";
  }
  return host;
}

/** Exact hosts or wildcard subdomains only; suffix tricks cannot pass. */
export function isHostAllowed(hostname: string, allowedDomains: readonly string[]): boolean {
  const host = normalizeHost(hostname);
  if (!host) {
    return false;
  }

  return allowedDomains.some((entry) => {
    const rule = normalizeHost(entry);
    if (!rule) {
      return false;
    }
    if (rule.startsWith("*.")) {
      const base = rule.slice(2);
      return host.endsWith(`.${base}`) && host !== base;
    }
    return host === rule;
  });
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const result: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const number = Number.parseInt(part, 10);
    if (number > 255) {
      return null;
    }
    result.push(number);
  }
  return result;
}

function blockedIpv4(value: string): boolean {
  const octets = parseIpv4(value);
  if (!octets) {
    return true;
  }
  const a = octets[0] ?? -1;
  const b = octets[1] ?? -1;
  const c = octets[2] ?? -1;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 ||
    a === 255
  );
}

function expandIpv6(value: string): number[] | null {
  let address = value.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").split("%")[0] ?? "";
  if (address.includes(".")) {
    const separator = address.lastIndexOf(":");
    if (separator < 0) {
      return null;
    }
    const tail = parseIpv4(address.slice(separator + 1));
    if (!tail) {
      return null;
    }
    const high = tail[0] ?? 0;
    const low = tail[1] ?? 0;
    address = `${address.slice(0, separator + 1)}${high.toString(16)}:${low.toString(16)}`;
  }

  const halves = address.split("::");
  if (halves.length > 2) {
    return null;
  }
  const left = (halves[0] ?? "").split(":").filter((part) => part.length > 0);
  const right = (halves[1] ?? "").split(":").filter((part) => part.length > 0);
  const groups =
    halves.length === 2
      ? [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right]
      : [...left, ...right];
  if (groups.length !== 8) {
    return null;
  }

  const numbers: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) {
      return null;
    }
    numbers.push(Number.parseInt(group, 16));
  }
  return numbers;
}

function blockedIpv6(value: string): boolean {
  const groups = expandIpv6(value);
  if (!groups) {
    return true;
  }
  const g = (index: number): number => groups[index] ?? -1;
  if (groups.every((group) => group === 0)) {
    return true;
  }
  if (g(0) === 0 && g(1) === 0 && g(2) === 0 && g(3) === 0 && g(4) === 0 && g(5) === 0 && g(6) === 0 && g(7) === 1) {
    return true;
  }
  if ((g(0) & 0xfe00) === 0xfc00) {
    return true;
  }
  if ((g(0) & 0xffc0) === 0xfe80) {
    return true;
  }
  if ((g(0) & 0xff00) === 0xff00) {
    return true;
  }
  if (g(0) === 0x2001 && g(1) === 0x0db8) {
    return true;
  }

  const embeddedIpv4 = (high: number, low: number): string =>
    `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
  const upperZero = g(0) === 0 && g(1) === 0 && g(2) === 0 && g(3) === 0 && g(4) === 0;
  // ::ffff:a.b.c.d (mapped) and ::a.b.c.d (compatible)
  if (upperZero && (g(5) === 0xffff || g(5) === 0)) {
    if (blockedIpv4(embeddedIpv4(g(6), g(7)))) {
      return true;
    }
  }
  // NAT64 well-known prefix and 6to4 both embed an IPv4 destination.
  if (g(0) === 0x64 && g(1) === 0xff9b && g(2) === 0 && g(3) === 0 && g(4) === 0 && g(5) === 0) {
    return blockedIpv4(embeddedIpv4(g(6), g(7)));
  }
  if (g(0) === 0x2002) {
    return blockedIpv4(embeddedIpv4(g(1), g(2)));
  }
  return false;
}

/** Blocks loopback, private, link-local, unique-local, multicast, metadata and mapped ranges. */
export function isBlockedAddress(address: string): boolean {
  const value = address.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (value.includes(":")) {
    return blockedIpv6(value);
  }
  return blockedIpv4(value);
}

export function parseHttpUrl(input: string | URL, allowHttp: boolean): URL {
  const raw = input instanceof URL ? input.toString() : input;
  const parsed = urlSchema.safeParse(raw);
  if (!parsed.success) {
    throw new IngestionError("BAD_REQUEST", "The source URL is not valid.");
  }

  let url: URL;
  try {
    url = new URL(parsed.data);
  } catch {
    throw new IngestionError("BAD_REQUEST", "The source URL is not valid.");
  }

  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new IngestionError("UNSUPPORTED_SCHEME", "Only https source URLs are allowed.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new IngestionError("CREDENTIALS_NOT_ALLOWED", "Source URLs must not contain credentials.");
  }
  const expectedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port !== "" && url.port !== expectedPort) {
    throw new IngestionError("HOST_NOT_ALLOWED", "Source URLs must use the default port.");
  }
  if (url.hostname.startsWith("[") || parseIpv4(url.hostname)) {
    throw new IngestionError("HOST_NOT_ALLOWED", "Literal IP addresses are not valid source hosts.");
  }
  return url;
}

async function defaultResolve(hostname: string): Promise<ResolvedAddress[]> {
  try {
    const records = await dnsLookup(hostname, { all: true, verbatim: true });
    return records.map((record) => ({
      address: record.address,
      family: record.family === 6 ? 6 : 4,
    }));
  } catch {
    throw new IngestionError("DNS_RESOLUTION_FAILED", "The source host could not be resolved.");
  }
}

async function pinnedAddress(
  hostname: string,
  resolver: AddressResolver | undefined,
): Promise<ResolvedAddress> {
  const records = await (resolver ?? defaultResolve)(hostname);
  const safe = records.filter((record) => !isBlockedAddress(record.address));
  const chosen = safe[0];
  if (!chosen) {
    throw new IngestionError("PRIVATE_ADDRESS_BLOCKED", "The source host resolved to a blocked address.");
  }
  return chosen;
}

function normalizeResponseHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      result[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      result[key.toLowerCase()] = value.join(", ");
    }
  }
  return result;
}

/** Direct connection to the pinned IP; TLS uses the original hostname for SNI and verification. */
export const defaultTransport: FetchTransport = ({
  url,
  address,
  headers,
  timeoutMs,
  maxBytes,
}) =>
  new Promise<TransportResult>((resolve, reject) => {
    const secure = url.protocol === "https:";
    const client = secure ? https : http;
    const path = `${url.pathname || "/"}${url.search}`;
    const requestOptions: http.RequestOptions = {
      host: address.address,
      port: url.port ? Number.parseInt(url.port, 10) : secure ? 443 : 80,
      method: "GET",
      path,
      timeout: timeoutMs,
      headers: {
        host: url.host,
        "user-agent": headers["user-agent"] ?? "PolicyPulse/2.0",
        accept: headers.accept ?? "*/*",
        connection: "close",
      },
      ...(secure ? { servername: url.hostname } : {}),
    };

    const request = client.request(requestOptions, (response) => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          response.destroy();
          request.destroy();
          reject(new IngestionError("RESPONSE_TOO_LARGE", "The source response exceeded the size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          headers: normalizeResponseHeaders(response.headers),
          bytes: Buffer.concat(chunks),
        });
      });
      response.on("error", () => {
        reject(new IngestionError("FETCH_FAILED", "The source response could not be read."));
      });
    });

    request.on("timeout", () => {
      request.destroy();
      reject(new IngestionError("FETCH_TIMEOUT", "The source took too long to respond."));
    });
    request.on("error", () => {
      reject(new IngestionError("FETCH_FAILED", "The source could not be reached."));
    });
    request.end();
  });

export async function fetchUrl(input: string | URL, options: FetchOptions): Promise<FetchedResource> {
  let current = parseHttpUrl(input, options.allowHttp === true);
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!isHostAllowed(current.hostname, options.allowedDomains)) {
    throw new IngestionError("HOST_NOT_ALLOWED", "The source host is not in the configured allowlist.");
  }

  const transport = options.transport ?? defaultTransport;
  const headers: Record<string, string> = {
    "user-agent": options.userAgent,
    accept: "application/pdf,text/html;q=0.9,*/*;q=0.1",
  };

  for (let hop = 0; ; hop += 1) {
    // Resolve on every hop and connect to the address directly: no DNS rebinding window.
    const address = await pinnedAddress(current.hostname, options.resolve);
    const result = await transport({ url: current, address, headers, timeoutMs, maxBytes });

    if (result.status >= 300 && result.status < 400) {
      const location = result.headers.location;
      if (!location) {
        throw new IngestionError("FETCH_FAILED", "The source redirect had no target.");
      }
      if (hop >= maxRedirects) {
        throw new IngestionError("TOO_MANY_REDIRECTS", "The source redirected too many times.");
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new IngestionError("REDIRECT_NOT_ALLOWED", "The source redirect target is not valid.");
      }
      current = parseHttpUrl(next, options.allowHttp === true);
      if (!isHostAllowed(current.hostname, options.allowedDomains)) {
        throw new IngestionError("HOST_NOT_ALLOWED", "A redirect left the configured allowlist.");
      }
      continue;
    }

    if ((result.status < 200 || result.status >= 300) && !options.acceptNonSuccess) {
      throw new IngestionError("FETCH_FAILED", "The source returned an unsuccessful response.");
    }

    const contentType = result.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? null;
    return {
      url: current,
      status: result.status,
      contentType,
      bytes: result.bytes,
      retrievedAt: new Date((options.now ?? Date.now)()),
    };
  }
}

export function parseRobots(text: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let agents: string[] = [];
  let group: RobotsRule[] = [];

  const flush = (): void => {
    if (agents.includes("*")) {
      rules.push(...group);
    }
    agents = [];
    group = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const clean = line.split("#")[0]?.trim() ?? "";
    if (clean === "") {
      continue;
    }
    const separator = clean.indexOf(":");
    if (separator < 1) {
      continue;
    }
    const field = clean.slice(0, separator).trim().toLowerCase();
    const value = clean.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (group.length > 0) {
        flush();
      }
      agents.push(value.toLowerCase());
    } else if (field === "allow" || field === "disallow") {
      if (agents.length === 0 || (field === "disallow" && value === "")) {
        continue;
      }
      group.push({ path: value, allowed: field === "allow" });
    }
  }
  flush();
  return rules;
}

export function robotsAllows(path: string, rules: readonly RobotsRule[]): boolean {
  const matching = rules.filter((rule) => rule.path !== "" && path.startsWith(rule.path));
  if (matching.length === 0) {
    return true;
  }
  const longest = matching.reduce((best, rule) => (rule.path.length > best.path.length ? rule : best));
  return longest.allowed;
}

export function createRobotsCache(now: () => number = Date.now): RobotsCache {
  const cache = new Map<string, { rules: RobotsRule[]; fetchedAt: number }>();
  return {
    get(origin) {
      const entry = cache.get(origin);
      if (!entry) {
        return null;
      }
      if (now() - entry.fetchedAt > ROBOTS_TTL_MS) {
        cache.delete(origin);
        return null;
      }
      cache.set(origin, entry);
      return entry;
    },
    set(origin, value) {
      if (!cache.has(origin) && cache.size >= ROBOTS_CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          cache.delete(oldest);
        }
      }
      cache.set(origin, value);
    },
  };
}

/** Listing crawls only: one robots.txt fetch per host, wildcard group only, no bypass. */
export async function assertRobotsAllowed(target: string | URL, options: FetchOptions): Promise<void> {
  const url = target instanceof URL ? target : parseHttpUrl(target, options.allowHttp === true);
  const origin = url.origin;
  const cache = options.robotsCache ?? createRobotsCache(options.now ?? Date.now);
  const cached = cache.get(origin);
  let rules: RobotsRule[];

  if (cached) {
    rules = cached.rules;
  } else {
    const robotsUrl = new URL("/robots.txt", origin);
    const response = await fetchUrl(robotsUrl, {
      ...options,
      maxBytes: ROBOTS_MAX_BYTES,
      acceptNonSuccess: true,
    });
    if (response.status === 401 || response.status === 403) {
      throw new IngestionError("ROBOTS_DISALLOWED", "The source disallows automated access.");
    }
    rules = response.status === 200 ? parseRobots(new TextDecoder().decode(response.bytes)) : [];
    cache.set(origin, { rules, fetchedAt: (options.now ?? Date.now)() });
  }

  if (!robotsAllows(`${url.pathname}${url.search}`, rules)) {
    throw new IngestionError("ROBOTS_DISALLOWED", "The source disallows crawling this path.");
  }
}

/** Support contact comes from owner settings; CRLF is stripped by validation. */
export function userAgentFor(supportEmail: string): string {
  const parsed = z.string().trim().email().max(254).safeParse(supportEmail);
  if (!parsed.success || /[\r\n]/.test(parsed.data)) {
    throw new IngestionError("BAD_REQUEST", "A valid support email is required for ingestion.");
  }
  return `PolicyPulse/2.0 (compliance ingestion; mailto:${parsed.data})`;
}
