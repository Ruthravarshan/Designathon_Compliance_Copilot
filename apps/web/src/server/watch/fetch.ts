import "server-only";
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

async function assertPublicHost(url: URL): Promise<void> {
  if (isDisallowedHostname(url.hostname)) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source host is not allowed.");
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source host could not be resolved.");
  }

  if (records.length === 0) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source host has no address.");
  }
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source host resolves to a private address.");
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, "The source response is too large.");
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new AppError(ERROR_CODES.BAD_REQUEST, "The source response is too large.");
      }
      chunks.push(Buffer.from(value));
    }
  }

  return Buffer.concat(chunks);
}

/**
 * Fetch a remote document with SSRF guards: http(s) only, allow-listed host,
 * public DNS only (checked on every redirect hop), bounded size and timeout.
 */
export async function safeFetchBytes(input: string, options: FetchOptions): Promise<FetchedBytes> {
  let current = parseHttpUrl(input);
  if (!current) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "Enter a safe http(s) URL.");
  }
  if (!hostAllowed(current, options.allowedDomains)) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The URL host is not on the allowlist.");
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicHost(current);

      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": userAgent(),
          accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5",
        },
      }).catch(() => {
        throw new AppError(ERROR_CODES.BAD_REQUEST, "The source could not be reached.");
      });

      if (REDIRECT_STATUS.has(response.status)) {
        const location = response.headers.get("location");
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

      if (!response.ok) {
        throw new AppError(ERROR_CODES.BAD_REQUEST, `The source returned HTTP ${response.status}.`);
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      const bytes = await readCapped(response, maxBytes);
      return { finalUrl: current.href, contentType, bytes };
    }

    throw new AppError(ERROR_CODES.BAD_REQUEST, "The source redirected too many times.");
  } finally {
    clearTimeout(timer);
  }
}

/** Decode a fetched response into text and citable clauses. */
export async function extractDocument(fetched: FetchedBytes): Promise<ExtractedDocument> {
  return extractFromBytes(fetched);
}

/** Raw HTML for listing pages where we need anchors, not text. */
export function decodeHtml(fetched: FetchedBytes): string {
  return decodeHtmlBytes(fetched.bytes);
}

