import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Database,
  FileText,
  HourglassHigh,
  ShieldWarning,
  Sparkle,
  WarningOctagon,
} from "@phosphor-icons/react/dist/ssr";
import { ComplianceCharts } from "@/components/dashboard/compliance-charts";
import { SeverityBadge } from "@/components/severity-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, firstName, formatPercent, humanize } from "@/lib/format";
import { getActor } from "@/server/auth/actor";
import { getDashboard } from "@/server/compliance/service";
import { getWorkspacePosture } from "@/server/watch/service";

export const metadata = {
  title: "Overview",
};

export default async function DashboardPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }

  const [dashboard, posture] = await Promise.all([
    getDashboard(actor),
    getWorkspacePosture(actor.workspaceId),
  ]);
  const { findings } = dashboard;

  const metrics = [
    {
      label: "Pending review",
      value: findings.pending,
      detail: `${findings.critical} critical · ${findings.high} high overall`,
      href: "/app/findings?review=pending",
      icon: HourglassHigh,
    },
    {
      label: "Reviewed",
      value: findings.approved,
      detail: `${findings.rejected} rejected · officer sign-off`,
      href: "/app/findings?review=approved",
      icon: CheckCircle,
    },
    {
      label: "Circulars analyzed",
      value: dashboard.documentCount,
      detail: `${dashboard.clauseCount} citable clauses`,
      href: "/app/circulars",
      icon: FileText,
    },
    {
      label: "DPDP risk fields",
      value: dashboard.scans.critical + dashboard.scans.high,
      detail: `${dashboard.scans.unconsented} without consent basis`,
      href: "/app/data",
      icon: Database,
    },
  ];

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-5 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            PolicyPulse / Overview
          </p>
          <h1 className="mt-1.5 text-[28px] leading-[34px] font-semibold tracking-[-0.03em] text-fg sm:text-[32px] sm:leading-[38px]">
            Welcome back, {firstName(actor.name)}.
          </h1>
          <p className="mt-1.5 max-w-[64ch] text-sm leading-relaxed text-muted">
            Scoped to <span className="font-medium text-fg">{actor.workspaceName}</span>. Review
            items are ordered by severity and deadline; no finding can publish itself.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="brand" dot>
            {findings.pending} awaiting sign-off
          </Badge>
          <Link
            href="/app/findings"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-medium text-fg transition-colors hover:border-muted/60 hover:bg-surface-2"
          >
            Open findings
            <ArrowRight size={14} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section aria-label="Workspace metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link key={metric.label} href={metric.href} className="group">
              <Card className="h-full p-5 transition-[border-color,transform] duration-150 group-hover:-translate-y-0.5 group-hover:border-brand/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon
                      size={15}
                      weight="bold"
                      aria-hidden="true"
                      className="text-brand dark:text-accent"
                    />
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {metric.label}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={14}
                    weight="bold"
                    aria-hidden="true"
                    className="text-muted transition-colors group-hover:text-brand dark:group-hover:text-accent"
                  />
                </div>
                <p className="mt-3 font-mono text-4xl font-medium tracking-tight text-brand dark:text-accent tabular-nums">
                  {metric.value}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{metric.detail}</p>
              </Card>
            </Link>
          );
        })}
      </section>

      <section aria-label="Compliance posture" className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Compliance posture
            </p>
            <Badge
              tone={
                posture.band === "STRONG" ? "brand" : posture.band === "FAIR" ? "outline" : "danger"
              }
              dot
            >
              {humanize(posture.band)}
            </Badge>
          </div>
          <p className="mt-3 font-mono text-5xl font-medium tracking-tight text-brand tabular-nums dark:text-accent">
            {posture.score}
            <span className="ml-1 text-lg text-muted">/100</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {posture.open} open findings · {posture.overdue} overdue. Only items awaiting officer
            sign-off lower the score; approved or rejected work is excluded.
          </p>
          <Link
            href="/app/watch"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline dark:text-accent"
          >
            Open regulatory watch
            <ArrowRight size={12} weight="bold" aria-hidden="true" />
          </Link>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2.5">
            <WarningOctagon
              size={16}
              weight="bold"
              aria-hidden="true"
              className={posture.overdue > 0 ? "text-danger" : "text-muted"}
            />
            <h2 className="text-sm font-semibold text-fg">Overdue alerts</h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {posture.criticalOverdue + posture.highOverdue > 0
              ? `${posture.criticalOverdue} critical and ${posture.highOverdue} high findings are past their due date. The weekly digest escalates them to the workspace owner.`
              : "No critical or high findings are overdue. The weekly digest still reports posture and new circulars."}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Critical",
                value: posture.counts.critical,
                overdue: posture.criticalOverdue,
              },
              { label: "High", value: posture.counts.high, overdue: posture.highOverdue },
              { label: "Medium", value: posture.counts.medium, overdue: posture.overdue },
              { label: "Low", value: posture.counts.low, overdue: 0 },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-line bg-surface-2 px-3 py-2.5"
              >
                <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                  {item.label}
                </dt>
                <dd className="mt-1 text-lg font-medium text-fg">{item.value}</dd>
                {item.overdue > 0 ? (
                  <p className="text-[10px] text-danger">{item.overdue} overdue</p>
                ) : null}
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <ComplianceCharts
        findings={findings}
        documents={dashboard.documents.map((doc) => ({
          id: doc.id,
          regulator: doc.regulator,
          reference: doc.reference,
          clauseCount: doc.clauseCount,
          findingCount: doc.findingCount,
        }))}
        scans={dashboard.scans}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <ShieldWarning
                size={17}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-accent"
              />
              <h2 className="text-sm font-semibold text-fg">Urgent review queue</h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Critical + high · pending
            </span>
          </div>

          {dashboard.urgent.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <CheckCircle
                size={26}
                weight="bold"
                aria-hidden="true"
                className="mx-auto text-brand dark:text-accent"
              />
              <p className="mt-3 text-sm font-medium text-fg">The urgent queue is clear.</p>
              <p className="mt-1 text-xs text-muted">
                Nothing critical or high is waiting on a reviewer in this workspace.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {dashboard.urgent.map((finding) => (
                <li key={finding.id}>
                  <Link
                    href={`/app/findings/${finding.id}`}
                    className="group grid gap-3 px-5 py-4 transition-colors hover:bg-surface-2/60 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:gap-4"
                  >
                    <SeverityBadge severity={finding.severity} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {finding.plainLanguage}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                        {finding.documentReference}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                        Deadline
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-fg">
                        {formatDate(finding.dueDate)}
                      </p>
                    </div>
                    <ArrowRight
                      size={15}
                      weight="bold"
                      aria-hidden="true"
                      className="hidden text-muted transition-colors group-hover:text-brand dark:group-hover:text-accent sm:block"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-line px-5 py-3">
            <Link
              href="/app/findings?review=pending"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-brand dark:hover:text-accent"
            >
              See the full pending queue
              <ArrowRight size={13} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <FileText
                size={17}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-accent"
              />
              <h2 className="text-sm font-semibold text-fg">Circular coverage</h2>
            </div>
            <Link href="/app/circulars" className="text-xs font-medium text-muted hover:text-fg">
              All
            </Link>
          </div>

          {dashboard.documents.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-fg">No circulars ingested.</p>
              <p className="mt-1 text-xs text-muted">
                Start with a regulator circular excerpt or paste the clause text.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {dashboard.documents.map((document) => (
                <li key={document.id}>
                  <Link
                    href={`/app/circulars/${document.id}`}
                    className="block px-5 py-3.5 transition-colors hover:bg-surface-2/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand dark:text-accent">
                        {document.regulator}
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        {formatDate(document.publishedAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-fg">{document.title}</p>
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      {document.clauseCount} clauses · {document.findingCount} findings
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Sparkle
                size={17}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-accent"
              />
              <h2 className="text-sm font-semibold text-fg">How a finding is produced</h2>
            </div>
          </div>
          <ol className="grid gap-px bg-line sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Extract",
                body: "Deterministic rules read the clause into an obligation with a type, threshold, and exact quote.",
              },
              {
                step: "02",
                title: "Map + assess",
                body: "Tag, term, and attribute scoring selects the closest policy or control; the gap rule sets severity.",
              },
              {
                step: "03",
                title: "Review",
                body: "An officer approves, edits, or rejects the drafted wording. The decision is audited and emailed.",
              },
            ].map((item) => (
              <li key={item.step} className="bg-surface p-5">
                <p className="font-mono text-[10px] tracking-[0.14em] text-brand dark:text-accent">
                  {item.step}
                </p>
                <p className="mt-2 text-sm font-semibold text-fg">{item.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ol>
          <div className="border-t border-line px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Confidence = 40% citation · 35% mapping · 25% rule certainty
            </p>
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            DPDP discovery
          </p>
          <p className="mt-3 font-mono text-3xl font-medium tracking-tight text-brand dark:text-accent tabular-nums">
            {dashboard.scans.critical + dashboard.scans.high}
          </p>
          <p className="mt-1 text-xs text-muted">
            fields at critical or high risk across {dashboard.scans.total} catalogued fields
          </p>
          <div className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-muted">
            <p className="flex items-center justify-between">
              <span>Critical</span>
              <span className="font-mono text-fg tabular-nums">{dashboard.scans.critical}</span>
            </p>
            <p className="flex items-center justify-between">
              <span>Without consent basis</span>
              <span className="font-mono text-fg tabular-nums">{dashboard.scans.unconsented}</span>
            </p>
          </div>
          <div className="mt-auto pt-5">
            <Link
              href="/app/data"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-brand dark:hover:text-accent"
            >
              Open data discovery
              <ArrowRight size={13} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </div>

      <p className="text-xs text-muted">
        Computed confidence · {formatPercent(findings.approved / Math.max(findings.total, 1))} of
        findings have an officer decision on record.
      </p>
    </div>
  );
}
