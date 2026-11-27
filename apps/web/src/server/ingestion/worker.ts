import { z } from "zod";
import { IngestionError, safeErrorCode } from "./errors";
import { runPipeline, type PipelineOutcome } from "./pipeline";
import { getRuntime, type CircularPersistence, type IngestionRepository } from "./runtime";
import { finishStep } from "./steps";
import type { RunStep } from "./types";

const limitSchema = z.number().int().min(0).max(10);
const MAX_BACKOFF_MS = 60_000;
const STALE_LOCK_MS = 10 * 60_000;

export interface WorkerDeps {
  repository?: IngestionRepository;
  persist?: CircularPersistence;
  now?: () => Date;
  random?: () => number;
  execute?: typeof runPipeline;
}

export interface WorkerResult {
  processed: number;
  failed: number;
  skipped: number;
}

export function backoffMs(attempts: number, random: () => number): number {
  return (
    Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** Math.max(0, attempts - 1)) + Math.floor(random() * 500)
  );
}

export function isStaleLock(lockedAt: Date | null, now: Date): boolean {
  return lockedAt !== null && now.getTime() - lockedAt.getTime() >= STALE_LOCK_MS;
}

function markRunningStepFailed(
  steps: readonly RunStep[],
  code: string,
  now: () => Date,
): RunStep[] {
  const running = steps.find((step) => step.status === "running");
  if (!running) {
    return [...steps];
  }
  return finishStep(steps, running.key, "failed", {
    code: code as RunStep["code"],
    now,
  });
}

/** Bounded worker tick. It never logs document text, URLs with credentials or provider bodies. */
export async function runIngestionJobs(
  input: { limit: number; now?: Date },
  deps: WorkerDeps = {},
): Promise<WorkerResult> {
  const parsed = limitSchema.safeParse(input.limit);
  if (!parsed.success) {
    throw new IngestionError("BAD_REQUEST", "The worker batch limit must be between 0 and 10.");
  }
  const repository = deps.repository ?? getRuntime().repository;
  const persist = deps.persist ?? getRuntime().persist;
  const now = deps.now ?? (() => new Date());
  const random = deps.random ?? Math.random;
  const execute = deps.execute ?? runPipeline;
  const at = input.now ?? now();
  const result: WorkerResult = { processed: 0, failed: 0, skipped: 0 };

  const claimed = await repository.claimJob({ limit: parsed.data, now: at });
  for (const job of claimed) {
    try {
      const outcome: PipelineOutcome = await execute(job, {
        repository,
        persist,
        now,
      });
      await repository.updateJob(job.id, {
        status: "SUCCEEDED",
        attempts: job.attempts + 1,
        lockedAt: null,
        lastErrorCode: null,
        ...(outcome.documentIds[0] ? { documentId: outcome.documentIds[0] } : {}),
      });
      result.processed += 1;
      result.skipped += outcome.skipped;
    } catch (error) {
      const code = safeErrorCode(error);
      const attempts = job.attempts + 1;
      const terminal = attempts >= job.maxAttempts;
      await repository.updateJob(job.id, {
        status: terminal ? "FAILED" : "QUEUED",
        attempts,
        lockedAt: null,
        lastErrorCode: code,
        nextAttemptAt: terminal ? at : new Date(at.getTime() + backoffMs(attempts, random)),
      });

      const run = await repository.getRun(job.runId);
      if (run) {
        await repository.updateRun(run.id, {
          status: terminal ? "FAILED" : "QUEUED",
          steps: markRunningStepFailed(run.steps, code, now),
          counts: { ...run.counts, failed: run.counts.failed + 1 },
        });
      }
      if (terminal) {
        result.failed += 1;
      } else {
        result.skipped += 1;
      }
    }
  }

  return result;
}
