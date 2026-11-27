import { describe, expect, it } from "vitest";
import { checksumOf } from "@/server/storage";
import { makeTestPdf } from "./__fixtures__/pdf";
import { createMemoryRuntime } from "./__fixtures__/runtime";
import { queueUploadedPdf, queueUrlIngest, runIngestionJobs } from "./index";
import type { PipelineOutcome } from "./pipeline";

const PDF_BYTES = makeTestPdf([
  "The bank shall complete a vulnerability assessment every six months.",
]);
const URL = "https://regulator.example/circular.pdf";

function urlInput(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "ws-1",
    userId: "user-1",
    url: URL,
    mode: "url" as const,
    sourceId: "source-1",
    ...overrides,
  };
}

function uploadInput(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "ws-1",
    userId: "user-1",
    bytes: PDF_BYTES,
    filename: "circular.pdf",
    ...overrides,
  };
}

const outcome = (): PipelineOutcome => ({
  status: "SUCCEEDED",
  documentIds: ["doc-1"],
  needsReview: false,
  findingCount: 1,
  aiStatus: "FALLBACK",
  steps: [],
  skipped: 0,
});

describe("queueUrlIngest", () => {
  it("validates input and fails closed without a configured source", async () => {
    const memory = createMemoryRuntime();
    await expect(
      queueUrlIngest(urlInput({ url: "not a url" }), { repository: memory.repository }),
    ).rejects.toMatchObject({ ingestionCode: "BAD_REQUEST" });
    await expect(
      queueUrlIngest(urlInput({ url: "ftp://regulator.example/x" }), {
        repository: memory.repository,
      }),
    ).rejects.toMatchObject({ ingestionCode: "UNSUPPORTED_SCHEME" });
    await expect(
      queueUrlIngest(urlInput({ sourceId: undefined }), { repository: memory.repository }),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });
    await expect(
      queueUrlIngest(urlInput({ sourceId: "missing" }), { repository: memory.repository }),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });
    expect(memory.state.runs.size).toBe(0);
  });

  it("rejects a host outside the configured allowlist", async () => {
    const memory = createMemoryRuntime();
    await expect(
      queueUrlIngest(urlInput({ url: "https://evil.example/circular.pdf" }), {
        repository: memory.repository,
      }),
    ).rejects.toMatchObject({ ingestionCode: "HOST_NOT_ALLOWED" });
    expect(memory.state.runs.size).toBe(0);
  });

  it("creates one run and one job with a validated, absolute URL", async () => {
    const memory = createMemoryRuntime();
    const result = await queueUrlIngest(urlInput({ mode: "listing" }), {
      repository: memory.repository,
    });

    expect(result.runId).toBeTruthy();
    expect(result.jobId).toBeTruthy();
    expect(memory.state.runs.get(result.runId)).toMatchObject({
      workspaceId: "ws-1",
      mode: "listing",
      sourceId: "source-1",
      status: "QUEUED",
    });
    const job = memory.state.jobs.get(result.jobId);
    expect(job).toMatchObject({ status: "QUEUED", attempts: 0, maxAttempts: 3 });
    expect(job?.payload).toMatchObject({
      url: URL,
      mode: "listing",
      sourceId: "source-1",
      userId: "user-1",
    });
  });

  it("refuses a disabled source", async () => {
    const memory = createMemoryRuntime();
    const source = memory.state.sources.get("source-1");
    if (!source) {
      throw new Error("fixture source missing");
    }
    memory.state.sources.set(source.id, { ...source, enabled: false });

    await expect(
      queueUrlIngest(urlInput(), { repository: memory.repository }),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });
  });
});

describe("queueUploadedPdf", () => {
  it("rejects empty, oversized and non-PDF uploads", async () => {
    const memory = createMemoryRuntime();
    await expect(
      queueUploadedPdf(uploadInput({ bytes: new Uint8Array(0) }), {
        repository: memory.repository,
      }),
    ).rejects.toMatchObject({ ingestionCode: "BAD_REQUEST" });
    await expect(
      queueUploadedPdf(uploadInput({ bytes: new Uint8Array(100) }), {
        repository: memory.repository,
      }),
    ).rejects.toMatchObject({ ingestionCode: "INVALID_PDF" });
    await expect(
      queueUploadedPdf(uploadInput({ bytes: new Uint8Array(30) }), {
        repository: createMemoryRuntime({ maxUploadBytes: 20 }).repository,
      }),
    ).rejects.toMatchObject({ ingestionCode: "BAD_REQUEST" });
    expect(memory.state.runs.size).toBe(0);
    expect(memory.state.jobs.size).toBe(0);
  });

  it("returns the existing document for a known checksum without creating a run", async () => {
    const memory = createMemoryRuntime();
    memory.state.files.set(`ws-1:${checksumOf(PDF_BYTES)}`, { documentId: "doc-existing" });

    const result = await queueUploadedPdf(uploadInput(), { repository: memory.repository });

    expect(result).toEqual({ documentId: "doc-existing", duplicate: true });
    expect(memory.state.runs.size).toBe(0);
    expect(memory.state.jobs.size).toBe(0);
  });

  it("fails when a named source or a storage connection is not configured", async () => {
    const noSource = createMemoryRuntime();
    await expect(
      queueUploadedPdf(uploadInput({ sourceId: "missing" }), { repository: noSource.repository }),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });

    const noConnection = createMemoryRuntime();
    noConnection.state.connections.clear();
    await expect(
      queueUploadedPdf(uploadInput(), { repository: noConnection.repository }),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });
  });

  it("stores the upload and queues exactly one downstream job", async () => {
    const memory = createMemoryRuntime();
    const result = await queueUploadedPdf(uploadInput({ sourceId: "source-1" }), {
      repository: memory.repository,
      provider: memory.provider,
    });

    expect(result.duplicate).toBe(false);
    expect(result.runId).toBeTruthy();
    expect(result.jobId).toBeTruthy();
    expect(memory.objects.size).toBe(1);
    const job = memory.state.jobs.get(result.jobId ?? "");
    expect(job?.payload).toMatchObject({
      workspaceId: "ws-1",
      userId: "user-1",
      sourceId: "source-1",
      filename: "circular.pdf",
    });
    expect(job?.payload.storageItemId).toBeTruthy();
    expect(job?.payload.storageConnectionId).toBe("conn-1");
  });
});

describe("runIngestionJobs export", () => {
  it("delegates to the bounded worker with the injected executor", async () => {
    const memory = createMemoryRuntime();
    const result = await runIngestionJobs(
      { limit: 2, now: new Date(0) },
      {
        repository: memory.repository,
        persist: memory.persist,
        execute: async () => outcome(),
      },
    );

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 0 });
    await expect(
      runIngestionJobs({ limit: 99 }, { repository: memory.repository }),
    ).rejects.toMatchObject({
      ingestionCode: "BAD_REQUEST",
    });
  });
});
