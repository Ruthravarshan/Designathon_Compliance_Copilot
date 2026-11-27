import "server-only";
import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  decodeHtml as decodeHtmlBytes,
  extractDocument as extractFromBytes,
  type ExtractedDocument,
} from "@/lib/watch/extract";
import { hostAllowed, isDisallowedHostname, isPrivateIp, parseHttpUrl } from "@/lib/watch/urls";

const DEFAULT_MAX_BYTES = 6_000_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export interface FetchOptions {
  allowedDomains: readonly string[];
  maxBytes?: number;
  timeoutMs?: number;
}

export interface FetchedBytes {
  finalUrl: string;
  contentType: string;
  bytes: Buffer;
}

export type { ExtractedDocument };

function userAgent(): string {
  return (
    process.env.WATCH_USER_AGENT ??
    "Mozilla/5.0 (compatible; HexaComplianceCopilot/0.1; +https://hexaware.com)"
  );
}

interface PinnedResponse {
  status: number;
  headers: Record<string, string>;
  bytes: Buffer;
}

/**
 * Resolve once and return a public address to connect to. The address is pinned
 * for the actual connection so a DNS rebinding hostname cannot swap a validated
 * public IP for loopback or a cloud metadata address between check and connect.
 */
async function resolvePublicAddress(hostname: string): Promise<string> {
  if (isDisallowedHostname(hostname)) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source host is not allowed.");
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source host could not be resolved.");
  }

  if (records.length === 0) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source host has no address.");
  }
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source host resolves to a private address.");
  }

  const address = records[0]?.address;
  if (!address) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source host has no usable address.");
  }
  return address;
}

/** Direct request to the pinned IP; TLS still verifies the original hostname. */
function pinnedRequest(
  url: URL,
  address: string,
  options: { timeoutMs: number; maxBytes: number; userAgent: string; accept: string },
): Promise<PinnedResponse> {
  return new Promise<PinnedResponse>((resolve, reject) => {
    const secure = url.protocol === "https:";
    const port = url.port ? Number.parseInt(url.port, 10) : secure ? 443 : 80;
    const baseOptions: http.RequestOptions = {
      host: address,
      port,
      method: "GET",
      path: `${url.pathname || "/"}${url.search}`,
      headers: {
        host: url.host,
        "user-agent": options.userAgent,
        accept: options.accept,
        connection: "close",
      },
    };

    const onResponse = (response: http.IncomingMessage): void => {
      const status = response.statusCode ?? 0;
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === "string") {
          headers[key.toLowerCase()] = value;
        } else if (Array.isArray(value)) {
          headers[key.toLowerCase()] = value.join(", ");
        }
      }

      if (REDIRECT_STATUS.has(status)) {
        response.resume();
        resolve({ status, headers, bytes: Buffer.alloc(0) });
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > options.maxBytes) {
          response.destroy();
          reject(new AppError(ERROR_CODES.BAD_REQUEST, "The source response is too large."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ status, headers, bytes: Buffer.concat(chunks) }));
      response.on("error", () =>
        reject(new AppError(ERROR_CODES.BAD_REQUEST, "The source response could not be read.")),
      );
    };

    const request = secure
      ? https.request({ ...baseOptions, servername: url.hostname }, onResponse)
      : http.request(baseOptions, onResponse);

    const timer = setTimeout(() => {
      request.destroy();
      reject(new AppError(ERROR_CODES.BAD_REQUEST, "The source took too long to respond."));
    }, options.timeoutMs);
    request.on("close", () => clearTimeout(timer));
    request.on("error", () =>
      reject(new AppError(ERROR_CODES.BAD_REQUEST, "The source could not be reached.")),
    );
    request.end();
  });
}

/**
 * Fetch a remote document with SSRF guards: http(s) only, allow-listed host,
 * public DNS resolved and pinned on every redirect hop, bounded size and an
 * absolute timeout (not just socket inactivity).
 */
export async function safeFetchBytes(input: string, options: FetchOptions): Promise<FetchedBytes> {
  let current = parseHttpUrl(input);
  if (!current) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "Enter a safe http(s) URL.");
  }
  if (!hostAllowed(current, options.allowedDomains)) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The URL host is not on the allowlist.");
  }

  const requestOptions = {
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent: userAgent(),
    accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5",
  };

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const address = await resolvePublicAddress(current.hostname);
    const response = await pinnedRequest(current, address, requestOptions);

    if (REDIRECT_STATUS.has(response.status)) {
      const location = response.headers["location"];
      if (!location) {
        throw new AppError(ERROR_CODES.BAD_REQUEST, "The source returned an empty redirect.");
      }
      const next = parseHttpUrl(new URL(location, current).href);
      if (!next || !hostAllowed(next, options.allowedDomains)) {
        throw new AppError(ERROR_CODES.BAD_REQUEST, "The source redirected to a blocked host.");
      }
      current = next;
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, `The source returned HTTP ${response.status}.`);
    }

    return {
      finalUrl: current.href,
      contentType: (response.headers["content-type"] ?? "").toLowerCase(),
      bytes: response.bytes,
    };
  }

  throw new AppError(ERROR_CODES.BAD_REQUEST, "The source redirected too many times.");
}

/** Decode a fetched response into text and citable clauses. */
export async function extractDocument(fetched: FetchedBytes): Promise<ExtractedDocument> {
  return extractFromBytes(fetched);
}

/** Raw HTML for listing pages where we need anchors, not text. */
export function decodeHtml(fetched: FetchedBytes): string {
  return decodeHtmlBytes(fetched.bytes);
}

