import { beforeEach, describe, expect, it } from "vitest";
import { checksumOf } from "@/server/storage";
import { makeTestPdf } from "./__fixtures__/pdf";
import { createMemoryRuntime, type MemoryRuntime } from "./__fixtures__/runtime";
import { IngestionError } from "./errors";
import { runPipeline } from "./pipeline";
import type { JobRecord } from "./runtime";

const PDF_TEXT = "The bank shall complete a vulnerability assessment every six months.";

let memory: MemoryRuntime;
let runId: string;

async function setup(options: Parameters<typeof createMemoryRuntime>[0] = {}): Promise<void> {
  memory = createMemoryRuntime(options);
  const run = await memory.repository.createRun({
    workspaceId: "ws-1",
    userId: "user-1",
    mode: "url",
  });
  runId = run.id;
  memory.objects.set("item-1", makeTestPdf([PDF_TEXT]));
}

function job(overrides: Partial<JobRecord["payload"]> = {}): JobRecord {
  return {
    id: "job-1",
    workspaceId: "ws-1",
    runId,
    mode: "url",
    status: "RUNNING",
    attempts: 0,
    maxAttempts: 3,
    lockedAt: new Date(),
    nextAttemptAt: new Date(0),
    lastErrorCode: null,
    documentId: null,
    payload: {
      workspaceId: "ws-1",
      userId: "user-1",
      runId,
      mode: "url",
      storageItemId: "item-1",
      storageConnectionId: "conn-1",
      filename: "circular.pdf",
      ...overrides,
    },
  };
}

function deps() {
  return { repository: memory.repository, persist: memory.persist, provider: memory.provider };
}

describe("ingestion pipeline (golden path)", () => {
  beforeEach(async () => {
    await setup();
  });

  it("parses, stores, extracts, verifies and persists truthfully with the deterministic fallback", async () => {
    const outcome = await runPipeline(job(), deps());

    expect(outcome.status).toBe("SUCCEEDED");
    expect(outcome.documentIds).toHaveLength(1);
    expect(outcome.aiStatus).toBe("FALLBACK");
    expect(outcome.findingCount).toBeGreaterThan(0);
    expect(outcome.skipped).toBe(0);
    expect(memory.state.persistCalls).toHaveLength(1);

    const persisted = memory.state.persistCalls[0];
    expect(persisted?.ai.status).toBe("FALLBACK");
    expect(persisted?.extraction.needsReview).toBe(true);
    expect(persisted?.extraction.obligations.length).toBeGreaterThan(0);
    expect(persisted?.pages[0]?.text).toContain("vulnerability assessment");
    expect(persisted?.file.filename).toBe("circular.pdf");
    expect(persisted?.file.pages).toBe(1);

    const run = memory.state.runs.get(runId);
    expect(run?.status).toBe("SUCCEEDED");
    expect(run?.counts.documents).toBe(1);
    expect(outcome.steps.every((step) => step.status === "done")).toBe(true);
  });

  it("records a verified Gemini call and labels the extraction VERIFIED when quotes check out", async () => {
    await setup({ llmEnabled: true, llmModel: "gemini-2.5-flash" });
    const generate = async () => ({
      candidate: {
        title: "Circular",
        issuer: "Test Regulator",
        reference: "REF/1",
        summary: null,
        publishedAt: "2026-01-02",
        effectiveAt: null,
        obligations: [
          {
            type: "SECURITY_TESTING" as const,
            plainLanguage: "Run an assessment",
            actionRequired: "Run it",
            applicableTo: null,
            quotes: [{ quote: "bank shall complete a vulnerability assessment", pageNumber: 1 }],
          },
        ],
        policyAreas: [],
        riskSuggestion: null,
      },
      model: "gemini-2.5-flash",
      promptVersion: "extract-v1",
      latencyMs: 5,
      promptTokens: 10,
      completionTokens: 20,
    });

    const outcome = await runPipeline(job(), { ...deps(), generate });

    expect(outcome.aiStatus).toBe("VERIFIED");
    expect(memory.state.llmCalls).toHaveLength(1);
    expect(memory.state.llmCalls[0]).toMatchObject({
      status: "VERIFIED",
      model: "gemini-2.5-flash",
    });
    const persisted = memory.state.persistCalls[0];
    expect(persisted?.ai.status).toBe("VERIFIED");
    expect(persisted?.extraction.title).toBe("Circular");
    expect(persisted?.extraction.needsReview).toBe(false);
  });

  it("marks a low-text-layer PDF review-only even when Gemini quotes verify", async () => {
    await setup({ llmEnabled: true, llmModel: "gemini-2.5-flash" });
    const generate = async () => ({
      candidate: {
        title: "Circular",
        issuer: "Test Regulator",
        reference: null,
        summary: null,
        publishedAt: null,
        effectiveAt: null,
        obligations: [
          {
            type: "SECURITY_TESTING" as const,
            plainLanguage: "Run an assessment",
            actionRequired: "Run it",
            applicableTo: null,
            quotes: [{ quote: "bank shall complete a vulnerability assessment", pageNumber: 1 }],
          },
        ],
        policyAreas: [],
        riskSuggestion: null,
      },
      model: "gemini-2.5-flash",
      promptVersion: "extract-v1",
      latencyMs: 5,
      promptTokens: 10,
      completionTokens: 20,
    });

    const outcome = await runPipeline(job(), {
      ...deps(),
      generate,
      pdfOptions: { minCharsPerPage: 200 },
    });

    expect(outcome.aiStatus).toBe("NEEDS_REVIEW");
    expect(memory.state.persistCalls[0]?.extraction.needsReview).toBe(true);
    expect(memory.state.persistCalls[0]?.ai.status).toBe("NEEDS_REVIEW");
  });

  it("falls back to deterministic extraction when Gemini fails, recording the failed call", async () => {
    await setup({ llmEnabled: true, llmModel: "gemini-2.5-flash" });
    const generate = async () => {
      throw new IngestionError("EXTRACTION_FAILED", "provider unavailable");
    };

    const outcome = await runPipeline(job(), { ...deps(), generate });

    expect(outcome.aiStatus).toBe("FALLBACK");
    expect(memory.state.llmCalls[0]).toMatchObject({ status: "FAILED", code: "EXTRACTION_FAILED" });
    expect(memory.state.persistCalls[0]?.ai.status).toBe("FALLBACK");
  });

  it("skips a known checksum without re-persisting or uploading a new document", async () => {
    const bytes = makeTestPdf([PDF_TEXT]);
    memory.state.files.set(`ws-1:${checksumOf(bytes)}`, { documentId: "doc-existing" });
    memory.objects.set("item-1", bytes);

    const outcome = await runPipeline(job(), deps());

    expect(outcome.skipped).toBe(1);
    expect(outcome.documentIds).toEqual(["doc-existing"]);
    expect(memory.state.persistCalls).toHaveLength(0);
  });
});

describe("ingestion pipeline (fail closed)", () => {
  beforeEach(async () => {
    await setup();
  });

  it("requires a support email before doing any work", async () => {
    await setup({ supportEmail: "" });
    await expect(runPipeline(job(), deps())).rejects.toMatchObject({
      ingestionCode: "INTEGRATION_NOT_CONFIGURED",
    });
    expect(memory.state.persistCalls).toHaveLength(0);
  });

  it("rejects a stored object that is not a PDF", async () => {
    memory.objects.set("item-1", new TextEncoder().encode("not a pdf"));
    await expect(runPipeline(job(), deps())).rejects.toMatchObject({
      ingestionCode: "INVALID_PDF",
    });
    expect(memory.state.persistCalls).toHaveLength(0);
  });

  it("fails when no storage connection belongs to the workspace", async () => {
    memory.state.connections.clear();
    await expect(runPipeline(job(), deps())).rejects.toMatchObject({
      ingestionCode: "INTEGRATION_NOT_CONFIGURED",
    });
    expect(memory.state.persistCalls).toHaveLength(0);
  });

  it("fails when the job has neither a URL nor a stored item", async () => {
    await expect(
      runPipeline(job({ storageItemId: undefined, url: undefined }), deps()),
    ).rejects.toMatchObject({
      ingestionCode: "BAD_REQUEST",
    });
    expect(memory.state.persistCalls).toHaveLength(0);
  });
});
