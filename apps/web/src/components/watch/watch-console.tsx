"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, Globe, Play, Pulse, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { formatDateTime } from "@/lib/format";
import type { WatchOverview } from "@/server/watch/service";

interface ApiError {
  error?: { message?: string };
}

export function WatchConsole({
  overview,
  canRun,
  canManage,
}: {
  overview: WatchOverview;
  canRun: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [runningTarget, setRunningTarget] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [ingestPending, setIngestPending] = useState(false);
  const [url, setUrl] = useState("");
  const [regulator, setRegulator] = useState<"RBI" | "SEBI" | "IRDAI" | "MEITY">("RBI");
  const [title, setTitle] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const running = runningTarget !== null;

  async function handleRunWatch(sourceId?: string) {
    setRunningTarget(sourceId ?? "all");
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/watch/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: { message?: string };
      } & ApiError;
      if (!response.ok) {
        setError(body.error?.message ?? "Watchdog run failed.");
        return;
      }
      setStatusMessage(body.data?.message ?? "Watchdog run completed.");
      router.refresh();
    } catch {
      setError("The server did not respond. Retry.");
    } finally {
      setRunningTarget(null);
    }
  }

  async function handleToggle(sourceId: string, nextEnabled: boolean) {
    setTogglingId(sourceId);
    setError(null);
    try {
      const response = await fetch("/api/watch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId, enabled: nextEnabled }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiError;
        setError(body.error?.message ?? "Could not update source.");
        return;
      }
      router.refresh();
    } catch {
      setError("The server did not respond. Retry.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDirectIngest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIngestPending(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/watch/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          regulator,
          ...(title.trim().length >= 4 ? { title: title.trim() } : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: { id: string; reference: string; findings: number; clauses: number };
      } & ApiError;
      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "Direct URL ingestion failed.");
        return;
      }
      setStatusMessage(
        `Ingested ${body.data.reference}: ${body.data.clauses} clauses, ${body.data.findings} findings.`,
      );
      setUrl("");
      setTitle("");
      router.refresh();
    } catch {
      setError("The server did not respond. Retry.");
    } finally {
      setIngestPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Posture summary strip */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Posture score
          </p>
          <p className="mt-2 font-mono text-3xl font-medium text-brand dark:text-support tabular-nums">
            {overview.posture.score}/100
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            Band · {overview.posture.band.replace(/_/g, " ")}
          </p>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Open obligations
          </p>
          <p className="mt-2 font-mono text-3xl font-medium text-fg tabular-nums">
            {overview.posture.open}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview.posture.counts.critical} critical · {overview.posture.counts.high} high
          </p>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Overdue items
          </p>
          <p className="mt-2 font-mono text-3xl font-medium text-fg tabular-nums">
            {overview.posture.overdue}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview.posture.criticalOverdue} critical overdue
          </p>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Tracked feeds
          </p>
          <p className="mt-2 font-mono text-3xl font-medium text-fg tabular-nums">
            {overview.sources.filter((s) => s.enabled).length}/{overview.sources.length}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview.weeklyDigestEnabled ? "Weekly digest active" : "Manual trigger"}
          </p>
        </Card>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-danger/35 bg-danger/10 p-4 text-xs text-fg"
        >
          <WarningCircle
            size={16}
            weight="fill"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-danger"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-brand/30 bg-brand/10 p-4 text-xs text-fg dark:border-support/35 dark:bg-support/10"
        >
          <CheckCircle
            size={16}
            weight="bold"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-brand dark:text-support"
          />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Sources */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Pulse
                size={16}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-support"
              />
              <h2 className="text-sm font-semibold text-fg">Monitored regulatory sources</h2>
            </div>
            {canRun && overview.sources.length > 0 ? (
              <Button
                size="sm"
                pending={runningTarget === "all"}
                disabled={running}
                pendingLabel="Running..."
                onClick={() => void handleRunWatch()}
              >
                <Play size={12} weight="fill" aria-hidden="true" />
                Run all sources
              </Button>
            ) : null}
          </div>

          {overview.sources.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Globe
                size={26}
                weight="bold"
                aria-hidden="true"
                className="mx-auto text-brand dark:text-support"
              />
              <p className="mt-3 text-sm font-medium text-fg">No regulatory feeds registered.</p>
              <p className="mx-auto mt-1 max-w-[44ch] text-xs text-muted">
                Use direct circular URL ingestion on the right to fetch and extract a specific
                regulator notice.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {overview.sources.map((source) => (
                <li
                  key={source.id}
                  className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{source.regulator}</Badge>
                      <span className="text-sm font-semibold text-fg">{source.name}</span>
                      <Badge tone="outline">{source.schedule}</Badge>
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted">{source.listingUrl}</p>
                    <p className="text-[11px] text-muted">
                      {source.lastCheckedAt
                        ? `Last checked ${formatDateTime(source.lastCheckedAt)} · ${source.lastStatus ?? "OK"}`
                        : "Never checked"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {canManage ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={running}
                        pending={togglingId === source.id}
                        pendingLabel="Saving..."
                        onClick={() => void handleToggle(source.id, !source.enabled)}
                      >
                        {source.enabled ? "Disable" : "Enable"}
                      </Button>
                    ) : null}
                    {canRun && source.enabled ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        pending={runningTarget === source.id}
                        pendingLabel="Checking..."
                        disabled={running}
                        onClick={() => void handleRunWatch(source.id)}
                      >
                        Check now
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Direct URL Ingestion */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-fg">Direct circular URL ingestion</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Fetch a public HTML or PDF regulatory page, split clauses, verify citations, and create
            review findings.
          </p>

          {canManage ? (
            <form onSubmit={(event) => void handleDirectIngest(event)} className="mt-4 space-y-3.5">
              <Field label="Circular URL" htmlFor="watch-url" required>
                <Input
                  id="watch-url"
                  type="url"
                  required
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.rbi.org.in/..."
                />
              </Field>
              <Field label="Regulator" htmlFor="watch-regulator">
                <Select
                  id="watch-regulator"
                  value={regulator}
                  onChange={(event) =>
                    setRegulator(event.target.value as "RBI" | "SEBI" | "IRDAI" | "MEITY")
                  }
                >
                  <option value="RBI">RBI</option>
                  <option value="SEBI">SEBI</option>
                  <option value="IRDAI">IRDAI</option>
                  <option value="MEITY">MeitY / DPDP / CERT-In</option>
                </Select>
              </Field>
              <Field label="Title override (optional)" htmlFor="watch-title">
                <Input
                  id="watch-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Optional circular title"
                  maxLength={160}
                />
              </Field>
              <Button
                type="submit"
                pending={ingestPending}
                pendingLabel="Fetching & extracting..."
                className="w-full"
              >
                Ingest URL
                <ArrowRight size={14} weight="bold" aria-hidden="true" />
              </Button>
            </form>
          ) : (
            <p className="mt-4 rounded-xl border border-line bg-surface-2 p-3 text-xs text-muted">
              Only workspace owners and admins can configure or ingest regulatory URLs.
            </p>
          )}
        </Card>
      </div>

      {/* Recent watch runs */}
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-surface-2/60 px-5 py-3">
          <h2 className="text-sm font-semibold text-fg">Recent watchdog runs</h2>
        </div>
        {overview.runs.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-muted">
            No watchdog runs have been recorded in this workspace yet.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {overview.runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="outline">{run.trigger}</Badge>
                    <span className="font-mono font-semibold text-fg">{run.status}</span>
                    {run.sourceName ? <span className="text-muted">· {run.sourceName}</span> : null}
                  </div>
                  <p className="text-muted">
                    Discovered {run.discovered} · Ingested {run.ingested} · Revisions{" "}
                    {run.revisions} · Findings {run.newFindings}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-muted">
                  {formatDateTime(run.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
