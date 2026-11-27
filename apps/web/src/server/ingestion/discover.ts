import { parse as parseHtml } from "node-html-parser";
import { IngestionError } from "./errors";
import {
  assertRobotsAllowed,
  fetchUrl,
  isHostAllowed,
  parseHttpUrl,
  type FetchOptions,
} from "./fetch";

const DEFAULT_MAX_CANDIDATES = 50;
const DEFAULT_MAX_DOCUMENTS = 25;
const DEFAULT_MAX_HTML_BYTES = 2 * 1024 * 1024;

export interface DiscoveredPdf {
  url: URL;
  retrievedAt: Date;
}

export interface DiscoveryResult {
  /** Anchors examined, capped so a hostile page cannot make us parse forever. */
  candidates: number;
  /** Unique, allowed, same-host PDF links, capped for one run. */
  pdfs: DiscoveredPdf[];
  skipped: number;
  truncated: boolean;
}

export interface DiscoverOptions extends FetchOptions {
  maxCandidates?: number;
  maxDocuments?: number;
  sameHostOnly?: boolean;
}

export interface HostLimiterOptions {
  maxConcurrency?: number;
  minSpacingMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface HostLimiter {
  run<T>(url: URL, task: () => Promise<T>): Promise<T>;
}

/** True only for a concrete PDF target, never for a page that merely mentions pdf. */
export function isPdfUrl(url: URL): boolean {
  if (url.pathname.toLowerCase().endsWith(".pdf")) {
    return true;
  }
  for (const value of url.searchParams.values()) {
    if (value.toLowerCase().endsWith(".pdf")) {
      return true;
    }
  }
  return url.searchParams.get("format") === "pdf" || url.searchParams.get("type") === "pdf";
}

/**
 * Extracts PDF links from a bounded HTML string. No scripts, styles, or JS rendering.
 * Every candidate is re-validated against the same allowlist used for the fetch.
 */
export function discoverPdfs(
  html: string,
  baseUrl: URL | string,
  options: DiscoverOptions,
): DiscoveryResult {
  const base = baseUrl instanceof URL ? baseUrl : parseHttpUrl(baseUrl, options.allowHttp === true);
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const maxDocuments = options.maxDocuments ?? DEFAULT_MAX_DOCUMENTS;
  const sameHostOnly = options.sameHostOnly !== false;

  const root = parseHtml(html);
  const anchors = root.querySelectorAll("a");
  const seen = new Set<string>();
  const pdfs: DiscoveredPdf[] = [];
  const retrievedAt = new Date((options.now ?? Date.now)());
  let candidates = 0;
  let skipped = 0;

  for (const anchor of anchors.slice(0, maxCandidates)) {
    const href = anchor.getAttribute("href");
    if (!href) {
      skipped += 1;
      continue;
    }
    let url: URL;
    try {
      url = parseHttpUrl(new URL(href, base), options.allowHttp === true);
    } catch {
      skipped += 1;
      continue;
    }
    candidates += 1;

    const allowed = isHostAllowed(url.hostname, options.allowedDomains);
    const sameHost = url.host === base.host;
    if (!allowed || (sameHostOnly && !sameHost) || !isPdfUrl(url)) {
      skipped += 1;
      continue;
    }

    url.hash = "";
    const key = url.toString();
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    pdfs.push({ url, retrievedAt });
  }

  return {
    candidates,
    pdfs: pdfs.slice(0, maxDocuments),
    skipped,
    truncated: anchors.length > maxCandidates || pdfs.length > maxDocuments,
  };
}

/** Listing crawl: robots first, then one HTML fetch, then bounded anchor parsing. */
export async function fetchListing(
  target: string | URL,
  options: DiscoverOptions,
): Promise<DiscoveryResult> {
  const url = target instanceof URL ? target : parseHttpUrl(target, options.allowHttp === true);
  if (!isHostAllowed(url.hostname, options.allowedDomains)) {
    throw new IngestionError(
      "HOST_NOT_ALLOWED",
      "The listing host is not in the configured allowlist.",
    );
  }
  await assertRobotsAllowed(url, options);
  const response = await fetchUrl(url, {
    ...options,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_HTML_BYTES,
  });
  const contentType = response.contentType ?? "";
  if (!contentType.startsWith("text/html") && !contentType.startsWith("application/xhtml+xml")) {
    throw new IngestionError("UNSUPPORTED_CONTENT", "The source did not return an HTML listing.");
  }

  const result = discoverPdfs(new TextDecoder().decode(response.bytes), response.url, options);
  if (result.pdfs.length === 0) {
    throw new IngestionError(
      "NO_DOCUMENTS_FOUND",
      "No reachable PDF documents were found in the listing.",
    );
  }
  return result;
}

interface PendingTask {
  run: () => void;
}

interface HostState {
  active: number;
  lastStart: number;
  queued: PendingTask[];
  waiting: boolean;
}

/** Bounded per-host scheduling: at most 2 in flight and at least 300ms between starts. */
export function createHostLimiter(options: HostLimiterOptions = {}): HostLimiter {
  const maxConcurrency = options.maxConcurrency ?? 2;
  const minSpacingMs = options.minSpacingMs ?? 300;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const hosts = new Map<string, HostState>();

  function stateFor(url: URL): HostState {
    let state = hosts.get(url.host);
    if (!state) {
      state = { active: 0, lastStart: Number.NEGATIVE_INFINITY, queued: [], waiting: false };
      hosts.set(url.host, state);
    }
    return state;
  }

  async function pump(host: string, state: HostState): Promise<void> {
    if (state.waiting || state.active >= maxConcurrency || state.queued.length === 0) {
      return;
    }
    const waitMs = state.lastStart + minSpacingMs - now();
    if (waitMs > 0) {
      state.waiting = true;
      await sleep(waitMs);
      state.waiting = false;
    }
    if (state.active >= maxConcurrency || state.queued.length === 0) {
      return;
    }
    const next = state.queued.shift();
    if (!next) {
      return;
    }
    state.active += 1;
    state.lastStart = now();
    next.run();
    void pump(host, state);
  }

  return {
    async run<T>(url: URL, task: () => Promise<T>): Promise<T> {
      const state = stateFor(url);
      return new Promise<T>((resolve, reject) => {
        state.queued.push({
          run() {
            void task()
              .then(resolve, reject)
              .finally(() => {
                state.active -= 1;
                void pump(hostKey(url), state);
              });
          },
        });
        void pump(hostKey(url), state);
      });
    },
  };
}

function hostKey(url: URL): string {
  return url.host;
}
