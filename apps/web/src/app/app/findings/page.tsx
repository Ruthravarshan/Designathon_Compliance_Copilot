import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  DownloadSimple,
  FunnelSimple,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { FindingsExplorer } from "@/components/findings/findings-explorer";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isSeverity, type Severity } from "@/lib/compliance/types";
import { actorCan, getActor } from "@/server/auth/actor";
import { listFindings, type FindingFilter } from "@/server/compliance/service";

export const metadata: Metadata = { title: "Findings" };

type ReviewFilter = NonNullable<FindingFilter["review"]>;

const REVIEW_TABS: Array<{ key: ReviewFilter | undefined; label: string }> = [
  { key: undefined, label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "finding:read")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const params = await searchParams;
  const severityParam = typeof params.severity === "string" ? params.severity : undefined;
  const severity = severityParam && isSeverity(severityParam) ? severityParam : undefined;
  const reviewParam = typeof params.review === "string" ? params.review : undefined;
  const review =
    reviewParam === "pending" || reviewParam === "approved" || reviewParam === "rejected"
      ? (reviewParam as ReviewFilter)
      : undefined;
  const cursorParam = typeof params.cursor === "string" ? params.cursor : undefined;
  const cursor = cursorParam && /^[a-z0-9]{10,64}$/i.test(cursorParam) ? cursorParam : undefined;

  const { items, nextCursor } = await listFindings(actor, {
    ...(severity ? { severity } : {}),
    ...(review ? { review } : {}),
    ...(cursor ? { cursor } : {}),
  });

  function filterHref(next: { severity?: Severity; review?: ReviewFilter }): string {
    const query = new URLSearchParams();
    const nextSeverity = next.severity === undefined ? undefined : next.severity;
    const nextReview = next.review === undefined ? undefined : next.review;
    if (nextSeverity) {
      query.set("severity", nextSeverity);
    }
    if (nextReview) {
      query.set("review", nextReview);
    }
    const value = query.toString();
    return value ? `/app/findings?${value}` : "/app/findings";
  }

  const hasFilters = Boolean(severity || review || cursor);
  const canExport = actorCan(actor, "audit:read");

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Workbench / Findings
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">Gap findings</h1>
          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">
            One row per obligation with a gap. Ordered by severity, then deadline. Every finding has
            a clause citation, a mapping, and a human review status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">
            <FunnelSimple size={12} weight="bold" aria-hidden="true" />
            {items.length} shown
          </Badge>
          {canExport ? (
            <a
              href="/api/export/findings"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-fg transition-colors hover:border-muted/60 hover:bg-surface-2"
            >
              <DownloadSimple size={14} weight="bold" aria-hidden="true" />
              Export CSV
            </a>
          ) : null}
        </div>
      </header>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              Review
            </span>
            {REVIEW_TABS.map((tab) => {
              const active = review === tab.key;
              return (
                <Link
                  key={tab.label}
                  href={filterHref({ ...(severity ? { severity } : {}), review: tab.key })}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-ink"
                      : "rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-muted/50 hover:text-fg"
                  }
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              Severity
            </span>
            <Link
              href={filterHref({ ...(review ? { review } : {}) })}
              className={
                !severity
                  ? "rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-ink"
                  : "rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-muted/50 hover:text-fg"
              }
            >
              All
            </Link>
            {SEVERITIES.map((value) => (
              <Link
                key={value}
                href={filterHref({ severity: value, ...(review ? { review } : {}) })}
                aria-current={severity === value ? "page" : undefined}
                className={
                  severity === value
                    ? "rounded-full bg-brand px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-brand-ink"
                    : "rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted transition-colors hover:border-muted/50 hover:text-fg"
                }
              >
                {value}
              </Link>
            ))}
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <MagnifyingGlass
            size={28}
            weight="bold"
            aria-hidden="true"
            className="mx-auto text-brand dark:text-support"
          />
          <h2 className="mt-4 text-lg font-medium">
            {hasFilters ? "No findings match these filters." : "No findings yet."}
          </h2>
          <p className="mx-auto mt-2 max-w-[48ch] text-sm text-muted">
            {hasFilters
              ? "Clear the filters to return to the full queue, or ingest another circular to expand coverage."
              : "Ingest a circular to extract obligations and generate the first review queue."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {hasFilters ? (
              <Link
                href="/app/findings"
                className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-muted hover:text-fg"
              >
                Clear filters
              </Link>
            ) : null}
            <Link
              href="/app/circulars"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand-hover"
            >
              Open circulars
              <ArrowRight size={14} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <FindingsExplorer
            items={items.map((finding) => ({
              id: finding.id,
              severity: finding.severity,
              reviewStatus: finding.reviewStatus,
              plainLanguage: finding.plainLanguage,
              reference: finding.reference,
              documentReference: finding.documentReference,
              confidence: finding.confidence,
              policyCode: finding.policyCode,
              controlCode: finding.controlCode,
              dueDate: finding.dueDate.toISOString(),
            }))}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {items.length} findings on this page
            </p>
            <div className="flex items-center gap-2">
              {cursor ? (
                <Link
                  href={filterHref({
                    ...(severity ? { severity } : {}),
                    ...(review ? { review } : {}),
                  })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-muted/50 hover:text-fg"
                >
                  <ArrowLeft size={13} weight="bold" aria-hidden="true" />
                  First page
                </Link>
              ) : null}
              {nextCursor ? (
                <Link
                  href={`/app/findings?${new URLSearchParams({
                    ...(severity ? { severity } : {}),
                    ...(review ? { review } : {}),
                    cursor: nextCursor,
                  }).toString()}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-muted/50 hover:text-fg"
                >
                  Next page
                  <ArrowRight size={13} weight="bold" aria-hidden="true" />
                </Link>
              ) : (
                <span className="text-xs text-muted">End of queue</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
