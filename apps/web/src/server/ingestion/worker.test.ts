import { describe, expect, it } from "vitest";
import { makeTestPdf } from "./__fixtures__/pdf";
import { createMemoryRuntime, type MemoryRuntime } from "./__fixtures__/runtime";
import { IngestionError } from "./errors";
import { queueUploadedPdf } from "./index";
import { runPipeline, type PipelineOutcome } from "./pipeline";
import type { JobRecord } from "./runtime";
import { backoffMs, isStaleLock, runIngestionJobs } from "./worker";

const PDF_TEXT = "The bank shall complete a vulnerability assessment every six months.";
const AT = new Date("2026-01-02T00:00:00.000Z");

function outcome(overrides: Partial<PipelineOutcome> = {}): PipelineOutcome {
  return {
    status: "SUCCEEDED",
    documentIds: ["doc-1"],
    needsReview: false,
    findingCount: 1,
    aiStatus: "FALLBACK",
    steps: [],
    skipped: 0,
    ...overrides,
  };
}

async function seededUpload(): Promise<MemoryRuntime> {
  const memory = createMemoryRuntime();
  await queueUploadedPdf(
    {
      workspaceId: "ws-1",
      userId: "user-1",
      bytes: makeTestPdf([PDF_TEXT]),
      filename: "circular.pdf",
    },
    { repository: memory.repository, provider: memory.provider },
  );
  return memory;
}

describe("worker policies", () => {
  it("computes capped exponential backoff with jitter", () => {
    expect(backoffMs(1, () => 0)).toBe(1_000);
    expect(backoffMs(2, () => 0)).toBe(2_000);
    expect(backoffMs(20, () => 0)).toBe(60_000);
    expect(backoffMs(1, () => 0.9)).toBe(1_450);
  });

  it("treats a lock as stale only after the timeout", () => {
    const locked = new Date(AT.getTime() - 10 * 60_000);
    expect(isStaleLock(locked, AT)).toBe(true);
    expect(isStaleLock(new Date(locked.getTime() + 1), AT)).toBe(false);
    expect(isStaleLock(null, AT)).toBe(false);
  });
});

describe("worker batch", () => {
  it("rejects an out-of-range limit without touching the repository", async () => {
    const memory = createMemoryRuntime();
    for (const limit of [-1, 11, 1.5]) {
      await expect(
        runIngestionJobs({ limit }, { repository: memory.repository }),
      ).rejects.toMatchObject({
        ingestionCode: "BAD_REQUEST",
      });
    }
    expect(memory.state.jobs.size).toBe(0);
  });

  it("processes a queued upload end to end with the real pipeline", async () => {
    const memory = await seededUpload();
    const result = await runIngestionJobs(
      { limit: 5, now: AT },
      {
        repository: memory.repository,
        persist: memory.persist,
        now: () => AT,
        execute: (job, deps) => runPipeline(job, { ...deps, provider: memory.provider }),
      },
    );

    expect(result).toEqual({ processed: 1, failed: 0, skipped: 0 });
    expect(memory.state.persistCalls).toHaveLength(1);
    const job = [...memory.state.jobs.values()][0];
    expect(job?.status).toBe("SUCCEEDED");
    expect(job?.documentId).toBeTruthy();
    expect(job?.lockedAt).toBeNull();
    const run = [...memory.state.runs.values()][0];
    expect(run?.status).toBe("SUCCEEDED");
  });

  it("requeues a retryable failure with bounded backoff and marks the running step failed", async () => {
    const memory = await seededUpload();
    const result = await runIngestionJobs(
      { limit: 5, now: AT },
      {
        repository: memory.repository,
        persist: memory.persist,
        now: () => AT,
        random: () => 0,
        execute: async () => {
          throw new IngestionError("FETCH_FAILED", "network unavailable");
        },
      },
    );

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 1 });
    const job = [...memory.state.jobs.values()][0];
    expect(job?.status).toBe("QUEUED");
    expect(job?.attempts).toBe(1);
    expect(job?.lastErrorCode).toBe("FETCH_FAILED");
    expect(job?.nextAttemptAt.getTime()).toBe(AT.getTime() + 1_000);
    expect(job?.lockedAt).toBeNull();
  });

  it("fails terminally at max attempts and records the failure on the run", async () => {
    const memory = await seededUpload();
    const job = [...memory.state.jobs.values()][0];
    if (!job) {
      throw new Error("seed did not create a job");
    }
    memory.state.jobs.set(job.id, { ...job, maxAttempts: 1 });

    const result = await runIngestionJobs(
      { limit: 5, now: AT },
      {
        repository: memory.repository,
        persist: memory.persist,
        now: () => AT,
        execute: async () => {
          throw new IngestionError("NO_TEXT_LAYER", "no text layer");
        },
      },
    );

    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 });
    const failed = memory.state.jobs.get(job.id);
    expect(failed?.status).toBe("FAILED");
    expect(failed?.attempts).toBe(1);
    const run = memory.state.runs.get(job.runId);
    expect(run?.status).toBe("FAILED");
    expect(run?.counts.failed).toBe(1);
    expect(run?.steps).toHaveLength(0);
  });

  it("does not claim a job whose next attempt is in the future", async () => {
    const memory = await seededUpload();
    const job = [...memory.state.jobs.values()][0];
    if (!job) {
      throw new Error("seed did not create a job");
    }
    memory.state.jobs.set(job.id, {
      ...job,
      nextAttemptAt: new Date(AT.getTime() + 60_000),
    });

    let executed = 0;
    const result = await runIngestionJobs(
      { limit: 5, now: AT },
      {
        repository: memory.repository,
        persist: memory.persist,
        now: () => AT,
        execute: async () => {
          executed += 1;
          return outcome();
        },
      },
    );

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 0 });
    expect(executed).toBe(0);
    expect(memory.state.jobs.get(job.id)?.status).toBe("QUEUED");
  });

  it("honours the batch limit", async () => {
    const memory = await seededUpload();
    const job = [...memory.state.jobs.values()][0];
    if (!job) {
      throw new Error("seed did not create a job");
    }
    const second: JobRecord = { ...job, id: "job-extra" };
    memory.state.jobs.set(second.id, second);

    let executed = 0;
    const result = await runIngestionJobs(
      { limit: 1, now: AT },
      {
        repository: memory.repository,
        persist: memory.persist,
        now: () => AT,
        execute: async () => {
          executed += 1;
          return outcome();
        },
      },
    );

    expect(result.processed).toBe(1);
    expect(executed).toBe(1);
    expect(memory.state.jobs.get(second.id)?.status).toBe("QUEUED");
  });
});
