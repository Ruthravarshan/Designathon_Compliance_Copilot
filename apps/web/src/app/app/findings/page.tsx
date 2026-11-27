import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FunnelSimple, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { ReviewStatusBadge, SeverityBadge } from "@/components/severity-badge";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatPercent } from "@/lib/format";
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
          <Badge tone="brand" dot>
            Server paginated
          </Badge>
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
                  ? "rounded-full bg-fg px-3 py-1.5 text-xs font-medium text-brand-ink"
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
                    ? "rounded-full bg-fg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-brand-ink"
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
            className="mx-auto text-brand"
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
          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[7rem_1fr_8rem_7.5rem_8rem_2rem] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted xl:grid">
              <span>Severity</span>
              <span>Finding</span>
              <span>Mapped to</span>
              <span>Deadline</span>
              <span>Review</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {items.map((finding) => (
                <li key={finding.id}>
                  <Link
                    href={`/app/findings/${finding.id}`}
                    className="group grid gap-3 px-5 py-4 transition-colors hover:bg-surface-2/60 xl:grid-cols-[7rem_1fr_8rem_7.5rem_8rem_2rem] xl:items-center xl:gap-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={finding.severity} />
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted xl:hidden">
                        {finding.reviewStatus.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium">{finding.plainLanguage}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                        {finding.reference} · {finding.documentReference}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Overall confidence {formatPercent(finding.confidence)}
                      </p>
                    </div>
                    <div className="font-mono text-[10px] leading-relaxed text-muted">
                      {finding.policyCode ? <p>{finding.policyCode}</p> : <p>No policy match</p>}
                      {finding.controlCode ? <p>{finding.controlCode}</p> : null}
                    </div>
                    <p className="text-xs text-muted">{formatDate(finding.dueDate)}</p>
                    <div className="hidden xl:block">
                      <ReviewStatusBadge status={finding.reviewStatus} />
                    </div>
                    <ArrowRight
                      size={15}
                      weight="bold"
                      aria-hidden="true"
                      className="hidden text-muted transition-colors group-hover:text-brand xl:block"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {items.length} findings on this page
            </p>
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
        </>
      )}
    </div>
  );
}
