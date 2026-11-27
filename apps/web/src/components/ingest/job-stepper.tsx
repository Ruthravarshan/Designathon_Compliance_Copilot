"use client";

import {
  ArrowClockwise,
  CheckCircle,
  CircleDashed,
  Pulse,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/navigation-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { SourceLink } from "@/components/policy/pdf-panel";

export type StepState = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";

export interface IngestionRunStep {
  key: "fetch" | "store" | "extract" | "verify" | "publish";
  label: string;
  status: StepState;
  durationMs?: number | null;
  errorCode?: string | null;
}

export interface IngestionRunView {
  id: string;
  status: string;
  steps: readonly IngestionRunStep[];
  documentId?: string | null;
  fileUrl?: string | null;
  sourceUrl?: string | null;
  checksum?: string | null;
  duplicate?: boolean;
  needsReviewReason?: string | null;
  emailQueued?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export function JobStepper({
  run,
  canRetry = false,
  retrying = false,
  onRetry,
}: {
  run: IngestionRunView;
  canRetry?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
}) {
  return (
    <Card aria-live="polite">
      <CardHeader>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            Ingestion run · {run.id}
          </p>
          <h2 className="mt-1 text-base font-semibold text-fg">
            {run.duplicate
              ? "Already ingested"
              : run.status === "DONE" || run.status === "READY"
                ? "Ingestion complete"
                : run.status === "FAILED"
                  ? "Ingestion failed"
                  : "Processing circular"}
          </h2>
        </div>
        <StatusBadge status={run.status} />
      </CardHeader>

      <CardBody className="space-y-5">
        <ol className="grid gap-3 sm:grid-cols-5">
          {run.steps.map((step) => {
            const Icon =
              step.status === "DONE"
                ? CheckCircle
                : step.status === "FAILED"
                  ? WarningCircle
                  : step.status === "RUNNING"
                    ? Pulse
                    : CircleDashed;

            return (
              <li
                key={step.key}
                className={cn(
                  "rounded-xl border p-3.5",
                  step.status === "RUNNING"
                    ? "border-brand/45 bg-brand/5"
                    : step.status === "FAILED"
                      ? "border-danger/35 bg-danger/5"
                      : "border-line bg-surface-2/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    {step.label}
                  </span>
                  <Icon
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                    className={cn(
                      step.status === "DONE"
                        ? "text-brand"
                        : step.status === "FAILED"
                          ? "text-danger"
                          : step.status === "RUNNING"
                            ? "text-accent"
                            : "text-muted",
                    )}
                  />
                </div>
                <p className="mt-2 font-mono text-xs text-fg">{step.status}</p>
                {typeof step.durationMs === "number" ? (
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted">
                    {step.durationMs} ms
                  </p>
                ) : null}
                {step.errorCode ? (
                  <p className="mt-1 font-mono text-[11px] text-fg">{step.errorCode}</p>
                ) : null}
              </li>
            );
          })}
        </ol>

        {run.needsReviewReason ? (
          <div className="rounded-xl border border-danger/35 bg-danger/10 p-3.5 text-sm text-fg">
            <span className="font-semibold">Needs review:</span> {run.needsReviewReason}
          </div>
        ) : null}

        {run.errorMessage || run.errorCode ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/35 bg-danger/10 p-3.5 text-sm text-fg"
          >
            <span className="font-semibold">Error:</span> {run.errorMessage ?? run.errorCode}
          </div>
        ) : null}

        {run.checksum ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 p-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              Checksum
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
              {run.checksum}
            </code>
            <CopyButton value={run.checksum} label="Copy checksum" />
          </div>
        ) : null}

        {run.emailQueued ? (
          <p className="font-mono text-xs text-muted">Circular received email queued</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          {run.documentId ? (
            <LinkButton href={`/app/circulars/${run.documentId}`}>Open circular record</LinkButton>
          ) : null}
          {run.fileUrl ? (
            <LinkButton
              href={run.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
            >
              View PDF
            </LinkButton>
          ) : null}
          {run.sourceUrl ? <SourceLink sourceUrl={run.sourceUrl} label="View source" /> : null}
          {run.status === "FAILED" && canRetry && onRetry ? (
            <Button
              variant="secondary"
              pending={retrying}
              pendingLabel="Retrying..."
              onClick={onRetry}
            >
              <ArrowClockwise size={14} weight="bold" aria-hidden="true" />
              Retry ingestion
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

export interface RunTableItem {
  id: string;
  sourceName: string;
  mode: string;
  status: string;
  errorCode?: string | null;
  startedAt: string;
  durationMs?: number | null;
}

export function RunTable({ runs }: { runs: readonly RunTableItem[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full border-collapse text-left text-[13px]">
        <caption className="sr-only">Recent ingestion runs</caption>
        <thead className="border-b border-line bg-surface-2">
          <tr>
            <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              Source
            </th>
            <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              Mode
            </th>
            <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              Status
            </th>
            <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              Started
            </th>
            <th className="px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              Duration
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {runs.map((run) => (
            <tr key={run.id} className="h-11">
              <td className="px-4 py-2.5 font-medium text-fg">{run.sourceName}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted">{run.mode}</td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={run.status} />
                  {run.errorCode ? (
                    <span className="font-mono text-xs text-muted">{run.errorCode}</span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted">
                {formatDateTime(run.startedAt)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-muted">
                {typeof run.durationMs === "number" ? `${run.durationMs} ms` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
