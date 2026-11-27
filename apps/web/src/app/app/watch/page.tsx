import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock, Crosshair, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, UnauthorizedState } from "@/components/ui/states";
import { DirectIngestForm, RunWatchButton, SourceToggle } from "@/components/watch/watch-controls";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { actorCan, getActor } from "@/server/auth/actor";
import { listWatchOverview } from "@/server/watch/service";

export const metadata: Metadata = { title: "Regulatory watch" };

const RUN_TONE: Record<string, "brand" | "danger" | "outline" | "neutral" | "accent"> = {
  SUCCEEDED: "brand",
  PARTIAL: "outline",
  FAILED: "danger",
  SKIPPED: "neutral",
  RUNNING: "accent",
};

export default async function WatchPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "watch:read")) {
    return (
      <UnauthorizedState
        title="Regulatory watch is restricted."
        body="Ask your workspace owner for watch access. Documents already ingested remain readable in Circulars."
        signedInAs={`${actor.name} · ${actor.role}`}
      />
    );
  }

  const overview = await listWatchOverview(actor);
  const canRun = actorCan(actor, "watch:run");
  const canManage = actorCan(actor, "watch:manage");
  const lastRun = overview.runs[0] ?? null;
  const enabledCount = overview.sources.filter((source) => source.enabled).length;
  const overdueTotal = overview.posture.criticalOverdue + overview.posture.highOverdue;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-5 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Workbench / Regulatory watch
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Regulatory watch
          </h1>
          <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-muted">
            A scheduled watchdog fetches the regulator listing pages, detects republished circulars
            by checksum, extracts clauses, and re-scores findings. Owners can also trigger a check on
            demand.
          </p>
        </div>
        {canRun ? <RunWatchButton /> : null}
      </header>

      {overdueTotal > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/35 bg-danger/10 px-5 py-4">
          <WarningOctagon size={18} weight="bold" aria-hidden="true" className="mt-0.5 text-danger" />
          <div className="text-sm">
            <p className="font-medium text-fg">
              {overview.posture.criticalOverdue} critical and {overview.posture.highOverdue} high
              findings are past their due date.
            </p>
            <p className="mt-1 text-xs text-muted">
              Posture score {overview.posture.score}/100 ({humanize(overview.posture.band)}). Open
              findings stay in the queue until an officer approves or rejects them.
            </p>
          </div>
        </div>
      ) : null}

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Posture", value: `${overview.posture.score}/100`, hint: humanize(overview.posture.band) },
          { label: "Open findings", value: String(overview.posture.open), hint: `${overview.posture.overdue} overdue` },
          {
            label: "Sources",
            value: `${enabledCount}/${overview.sources.length}`,
            hint: "enabled / tracked",
          },
          {
            label: "Last run",
            value: lastRun ? humanize(lastRun.status) : "Never",
            hint: lastRun ? formatDateTime(lastRun.startedAt) : "Trigger one to begin",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface px-5 py-4">
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              {stat.label}
            </dt>
            <dd className="mt-1.5 text-lg font-medium text-fg">{stat.value}</dd>
            <p className="mt-0.5 text-[11px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </dl>

      {canManage ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-medium text-fg">Fetch a document directly</h2>
              <p className="mt-1 text-xs text-muted">
                Paste a public RBI, SEBI, IRDAI, or MeitY URL. The server fetches it with SSRF,
                size, and timeout guards before ingesting.
              </p>
            </div>
            <Badge tone="outline">paste &amp; fetch</Badge>
          </CardHeader>
          <CardBody>
            <DirectIngestForm />
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="text-sm font-medium text-fg">Tracked sources</h2>
            <p className="mt-1 text-xs text-muted">
              The weekly cron calls <span className="font-mono">/api/cron/watch</span> every Monday
              04:00 UTC with the cron secret. Each source is also due at its own interval.
            </p>
          </div>
          <Badge tone="brand" dot>
            {enabledCount} active
          </Badge>
        </CardHeader>
        {overview.sources.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Crosshair}
              title="No sources tracked yet."
              description="Seed the demo workspace to add RBI, SEBI, and MeitY listing pages, or paste a document URL above."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {overview.sources.map((source) => (
              <li key={source.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{source.regulator}</Badge>
                      <Badge tone="outline">{source.kind}</Badge>
                      <span className="text-sm font-medium text-fg">{source.name}</span>
                      {!source.enabled ? <Badge tone="neutral">paused</Badge> : null}
                    </div>
                    <p className="mt-1.5 break-all font-mono text-[11px] text-muted">
                      {source.listingUrl}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {source.schedule} · checked {formatDateTime(source.lastCheckedAt)} · next{" "}
                      {formatDate(source.nextRunAt)} · {source.lastItemCount} links seen
                      {source.lastErrorCode ? ` · last error ${source.lastErrorCode}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        source.lastStatus
                          ? (RUN_TONE[source.lastStatus] ?? "neutral")
                          : "neutral"
                      }
                      dot={Boolean(source.lastStatus)}
                    >
                      {source.lastStatus ? humanize(source.lastStatus) : "not run"}
                    </Badge>
                    {canManage ? (
                      <SourceToggle sourceId={source.id} enabled={source.enabled} />
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-sm font-medium text-fg">Run history</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            manual + scheduled
          </span>
        </CardHeader>
        {overview.runs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Clock size={26} weight="bold" aria-hidden="true" className="mx-auto text-brand" />
            <p className="mt-3 text-sm text-muted">
              No runs recorded yet. Use Run check now to exercise discovery and ingestion.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-surface-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                  <th className="px-5 py-2.5 font-medium">Started</th>
                  <th className="px-3 py-2.5 font-medium">Trigger</th>
                  <th className="px-3 py-2.5 font-medium">Scope</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Found</th>
                  <th className="px-3 py-2.5 text-right font-medium">New</th>
                  <th className="px-3 py-2.5 text-right font-medium">Revisions</th>
                  <th className="px-3 py-2.5 text-right font-medium">Findings</th>
                  <th className="px-5 py-2.5 text-right font-medium">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-5 py-3 font-mono text-[10px] text-muted">
                      {formatDateTime(run.startedAt)}
                    </td>
                    <td className="px-3 py-3 text-fg">{humanize(run.trigger)}</td>
                    <td className="px-3 py-3 text-muted">
                      {run.sourceName ?? "All due sources"}
                      <span className="block text-[10px]">{run.triggeredByName ?? "—"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={RUN_TONE[run.status] ?? "neutral"} dot>
                        {humanize(run.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{run.discovered}</td>
                    <td className="px-3 py-3 text-right font-mono">{run.ingested}</td>
                    <td className="px-3 py-3 text-right font-mono">{run.revisions}</td>
                    <td className="px-3 py-3 text-right font-mono">{run.newFindings}</td>
                    <td className="px-5 py-3 text-right font-mono">{run.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
