import type { IngestionErrorCode } from "./errors";
import type { RunStep, StepKey, StepStatus } from "./types";

export const STEP_ORDER: readonly StepKey[] = ["fetch", "store", "extract", "verify", "publish"];

export function initialSteps(): RunStep[] {
  return STEP_ORDER.map((key) => ({ key, status: "pending" }));
}

function replace(steps: readonly RunStep[], key: StepKey, next: RunStep): RunStep[] {
  return steps.map((step) => (step.key === key ? next : step));
}

/** Truthful timings: a step is only marked running when its work actually starts. */
export function beginStep(
  steps: readonly RunStep[],
  key: StepKey,
  now: () => Date = () => new Date(),
): RunStep[] {
  const startedAt = now().toISOString();
  return replace(steps, key, { key, status: "running", startedAt });
}

export function finishStep(
  steps: readonly RunStep[],
  key: StepKey,
  status: Extract<StepStatus, "done" | "failed" | "skipped">,
  options: { code?: IngestionErrorCode; now?: () => Date } = {},
): RunStep[] {
  const started = steps.find((step) => step.key === key)?.startedAt;
  const endedAt = (options.now ?? (() => new Date()))().toISOString();
  const durationMs = started ? Math.max(0, Date.parse(endedAt) - Date.parse(started)) : undefined;
  return replace(steps, key, {
    key,
    status,
    startedAt: started,
    endedAt,
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(options.code ? { code: options.code } : {}),
  });
}

export function skipRemaining(steps: readonly RunStep[], from: StepKey): RunStep[] {
  const start = STEP_ORDER.indexOf(from);
  return steps.map((step, index) =>
    index >= start && step.status === "pending" ? { ...step, status: "skipped" } : step,
  );
}
