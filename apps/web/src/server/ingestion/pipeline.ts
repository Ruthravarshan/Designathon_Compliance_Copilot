import { getStorageProvider } from "@/server/storage";
import type { StorageConnection, StorageProvider } from "@/server/storage/types";
import { generateExtraction } from "@/server/llm/gemini";
import { buildPrompt, isAllowedModel } from "@/server/llm/prompt";
import { deterministicExtraction } from "@/server/llm/fallback";
import { verifyExtraction } from "@/server/llm/verify";
import { fetchListing, createHostLimiter, type HostLimiter } from "./discover";
import { fetchUrl, userAgentFor, type FetchOptions } from "./fetch";
import { hasPdfMagic, parsePdf, type PdfOptions } from "./pdf";
import { IngestionError } from "./errors";
import {
  getRuntime,
  type CircularPersistence,
  type IngestionRepository,
  type JobRecord,
  type PersistInput,
} from "./runtime";
import { storePdf } from "./store";
import { beginStep, finishStep, initialSteps } from "./steps";
import type { PdfPage, RunStep, VerifiedExtraction } from "./types";

const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export interface PipelineDeps {
  repository?: IngestionRepository;
  persist?: CircularPersistence;
  now?: () => Date;
  fetchOptions?: Partial<FetchOptions>;
  hostLimiter?: HostLimiter;
  generate?: typeof generateExtraction;
  provider?: StorageProvider;
  pdfOptions?: PdfOptions;
  maxUploadBytes?: number;
}

export interface PipelineOutcome {
  status: "SUCCEEDED" | "FAILED";
  documentIds: string[];
  needsReview: boolean;
  findingCount: number;
  aiStatus: "VERIFIED" | "FALLBACK" | "NEEDS_REVIEW";
  steps: RunStep[];
  skipped: number;
}

interface CandidateFile {
  bytes: Uint8Array;
  filename: string;
  sourceUrl: string;
  issuer: string | null;
}

async function readBounded(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new IngestionError("RESPONSE_TOO_LARGE", "The stored file exceeded the size limit.");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function requireConnection(connection: StorageConnection | null): StorageConnection {
  if (!connection) {
    throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "No storage connection is configured.");
  }
  return connection;
}

async function collectFiles(
  job: JobRecord,
  deps: Required<Pick<PipelineDeps, "repository" | "now" | "hostLimiter">>,
  fetchOptions: FetchOptions,
  maxBytes: number,
  provider?: StorageProvider,
): Promise<CandidateFile[]> {
  const { payload } = job;
  if (payload.storageItemId) {
    const connection = requireConnection(
      await deps.repository.getConnection(job.workspaceId, payload.storageConnectionId),
    );
    const stored = await (provider ?? getStorageProvider(connection)).read({
      itemId: payload.storageItemId,
    });
    const bytes = await readBounded(stored.body, maxBytes);
    if (!hasPdfMagic(bytes)) {
      throw new IngestionError("INVALID_PDF", "The stored file is not a PDF.");
    }
    return [{ bytes, filename: payload.filename ?? "circular.pdf", sourceUrl: "", issuer: null }];
  }

  if (!payload.url) {
    throw new IngestionError("BAD_REQUEST", "The job has no source to ingest.");
  }
  if (!payload.sourceId) {
    throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "No ingestion source is configured.");
  }
  const source = await deps.repository.getSource(job.workspaceId, payload.sourceId);
  if (!source || !source.enabled) {
    throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "The ingestion source is not enabled.");
  }
  const allowedDomains = [...source.allowedDomains];
  const host = new URL(payload.url).hostname;
  if (!allowedDomains.includes(host)) {
    allowedDomains.push(host);
  }
  const options: FetchOptions = { ...fetchOptions, allowedDomains };

  if (job.mode === "listing") {
    const listing = await fetchListing(payload.url, options);
    const files: CandidateFile[] = [];
    for (const found of listing.pdfs) {
      const fetched = await deps.hostLimiter.run(found.url, () => fetchUrl(found.url, options));
      if (!isPdfResponse(fetched.contentType, fetched.bytes)) {
        continue;
      }
      files.push({
        bytes: fetched.bytes,
        filename: fetched.url.pathname.split("/").pop() ?? "circular.pdf",
        sourceUrl: found.url.toString(),
        issuer: source.issuer,
      });
    }
    return files;
  }

  const fetched = await fetchUrl(payload.url, options);
  if (!isPdfResponse(fetched.contentType, fetched.bytes)) {
    throw new IngestionError("UNSUPPORTED_CONTENT", "The source did not return a PDF.");
  }
  return [
    {
      bytes: fetched.bytes,
      filename: fetched.url.pathname.split("/").pop() ?? "circular.pdf",
      sourceUrl: fetched.url.toString(),
      issuer: source.issuer,
    },
  ];
}

function isPdfResponse(contentType: string | null, bytes: Uint8Array): boolean {
  return contentType === "application/pdf" || hasPdfMagic(bytes);
}

async function extract(
  pages: readonly PdfPage[],
  job: JobRecord,
  settings: { llmEnabled: boolean; llmModel: string | null },
  generate: typeof generateExtraction,
  repository: IngestionRepository,
  documentNeedsReview: boolean,
): Promise<{
  extraction: VerifiedExtraction;
  aiStatus: "VERIFIED" | "FALLBACK" | "NEEDS_REVIEW";
  llm: {
    model?: string;
    promptVersion?: string;
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    status: "VERIFIED" | "FALLBACK" | "FAILED";
  };
}> {
  const model = settings.llmModel ?? "";
  if (settings.llmEnabled && isAllowedModel(model)) {
    try {
      const result = await generate({ prompt: buildPrompt(pages), model });
      const verified = verifyExtraction(result.candidate, pages, { documentNeedsReview });
      await repository.recordLlmCall({
        workspaceId: job.workspaceId,
        jobId: job.id,
        model: result.model,
        promptVersion: result.promptVersion,
        status: "VERIFIED",
        latencyMs: result.latencyMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      });
      return {
        extraction: verified.extraction,
        aiStatus: verified.needsReview ? "NEEDS_REVIEW" : "VERIFIED",
        llm: {
          model: result.model,
          promptVersion: result.promptVersion,
          latencyMs: result.latencyMs,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          status: "VERIFIED",
        },
      };
    } catch {
      await repository.recordLlmCall({
        workspaceId: job.workspaceId,
        jobId: job.id,
        model,
        promptVersion: "extract-v1",
        status: "FAILED",
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        code: "EXTRACTION_FAILED",
      });
    }
  }

  const fallback = deterministicExtraction(pages);
  return {
    extraction: fallback.extraction,
    aiStatus: "FALLBACK",
    llm: {
      promptVersion: "deterministic-v1",
      latencyMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      status: "FALLBACK",
    },
  };
}

/** One job, one run: fetch → store → extract → verify → persist, all truthful. */
export async function runPipeline(
  job: JobRecord,
  deps: PipelineDeps = {},
): Promise<PipelineOutcome> {
  const repository = deps.repository ?? getRuntime().repository;
  const persist = deps.persist ?? getRuntime().persist;
  const now = deps.now ?? (() => new Date());
  const hostLimiter = deps.hostLimiter ?? createHostLimiter({ now: () => now().getTime() });
  const generate = deps.generate ?? generateExtraction;

  const settings = await repository.getSettings(job.workspaceId);
  if (!settings?.supportEmail) {
    throw new IngestionError(
      "INTEGRATION_NOT_CONFIGURED",
      "A support email is required for ingestion.",
    );
  }
  const maxBytes = deps.maxUploadBytes ?? settings.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;

  let steps = initialSteps();
  await repository.updateRun(job.runId, { status: "RUNNING", steps });
  steps = beginStep(steps, "fetch", now);

  const fetchOptions: FetchOptions = {
    allowedDomains: [],
    userAgent: userAgentFor(settings.supportEmail),
    ...deps.fetchOptions,
  };
  const files = await collectFiles(
    job,
    { repository, now, hostLimiter },
    fetchOptions,
    maxBytes,
    deps.provider,
  );
  if (files.length === 0) {
    steps = finishStep(steps, "fetch", "failed", { code: "NO_DOCUMENTS_FOUND", now });
    throw new IngestionError("NO_DOCUMENTS_FOUND", "No reachable PDF documents were found.");
  }
  steps = finishStep(steps, "fetch", "done", { now });
  await repository.updateRun(job.runId, { steps });

  const documentIds: string[] = [];
  let skipped = 0;
  let findingCount = 0;
  let needsReview = false;
  let aiStatus: "VERIFIED" | "FALLBACK" | "NEEDS_REVIEW" = "VERIFIED";

  for (const file of files) {
    steps = beginStep(steps, "store", now);
    const parsed = await parsePdf(file.bytes, deps.pdfOptions);
    const connection = requireConnection(
      await repository.getConnection(job.workspaceId, job.payload.storageConnectionId),
    );
    const fallback = repository.getFallbackConnection
      ? await repository.getFallbackConnection(job.workspaceId, connection.id)
      : null;
    const stored = await storePdf(
      {
        workspaceId: job.workspaceId,
        bytes: file.bytes,
        filename: file.filename,
        issuer: file.issuer,
        reference: null,
        publishedAt: null,
        connection,
        ...(fallback ? { fallback } : {}),
        ...(deps.provider ? { provider: deps.provider } : {}),
      },
      repository,
    );
    steps = finishStep(steps, "store", "done", { now });
    if (stored.duplicate) {
      skipped += 1;
      if (stored.documentId) {
        documentIds.push(stored.documentId);
      }
      continue;
    }
    if (!stored.stored || !stored.path) {
      throw new IngestionError("STORAGE_UNAVAILABLE", "The PDF could not be stored.");
    }

    steps = beginStep(steps, "extract", now);
    const extracted = await extract(
      parsed.pages,
      job,
      settings,
      generate,
      repository,
      parsed.needsReview,
    );
    steps = finishStep(steps, "extract", "done", { now });

    steps = beginStep(steps, "verify", now);
    const result = extracted.extraction;
    needsReview = needsReview || result.needsReview;
    aiStatus =
      extracted.aiStatus === "FALLBACK"
        ? "FALLBACK"
        : result.needsReview
          ? "NEEDS_REVIEW"
          : "VERIFIED";
    steps = finishStep(steps, "verify", result.citationVerified ? "done" : "skipped", { now });

    steps = beginStep(steps, "publish", now);
    const persistInput: PersistInput = {
      workspaceId: job.workspaceId,
      userId: job.payload.userId,
      runId: job.runId,
      ...(job.payload.sourceId ? { sourceId: job.payload.sourceId } : {}),
      sourceUrl: file.sourceUrl,
      issuer: result.issuer,
      reference: result.reference,
      title: result.title,
      ...(result.publishedAt ? { publishedAt: result.publishedAt } : {}),
      ...(result.effectiveAt ? { effectiveAt: result.effectiveAt } : {}),
      pages: parsed.pages,
      extraction: result,
      file: {
        itemId: stored.stored.itemId,
        webUrl: stored.stored.webUrl,
        path: stored.path,
        checksum: stored.stored.checksum,
        filename: stored.filename,
        bytes: stored.size,
        pages: parsed.pageCount,
      },
      storageConnectionId: stored.storageConnectionId,
      ai: {
        status: aiStatus,
        ...(extracted.llm.model ? { model: extracted.llm.model } : {}),
        ...(extracted.llm.promptVersion ? { promptVersion: extracted.llm.promptVersion } : {}),
      },
    };
    const persisted = await persist(persistInput);
    documentIds.push(persisted.documentId);
    needsReview = needsReview || persisted.needsReview;
    findingCount += persisted.findingCount;
    steps = finishStep(steps, "publish", "done", { now });
  }

  await repository.updateRun(job.runId, {
    status: "SUCCEEDED",
    steps,
    counts: { documents: documentIds.length, findings: findingCount, failed: 0, skipped },
  });
  return { status: "SUCCEEDED", documentIds, needsReview, findingCount, aiStatus, steps, skipped };
}
