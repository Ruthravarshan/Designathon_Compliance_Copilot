import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  FileText,
  SealCheck,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { ReviewForm } from "@/components/review-form";
import { GapStatusLabel, ReviewStatusBadge, SeverityBadge } from "@/components/severity-badge";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/navigation-controls";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { formatDate, formatDateTime, formatPercent, humanize } from "@/lib/format";
import { actorCan, getActor } from "@/server/auth/actor";
import { confidenceBreakdown, getFinding } from "@/server/compliance/service";

export default async function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "finding:read")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const { id } = await params;
  const finding = await getFinding(actor, id).catch((error: unknown) => {
    if (error instanceof AppError && error.code === ERROR_CODES.NOT_FOUND) {
      notFound();
    }
    throw error;
  });

  const canReview = actorCan(actor, "finding:review");
  const pending = finding.reviewStatus === "PENDING_REVIEW";
  const breakdown = confidenceBreakdown(finding);
  const hasRedline = finding.redlineBefore.trim() !== "" || finding.redlineAfter.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/findings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
        >
          <ArrowLeft size={13} weight="bold" aria-hidden="true" />
          Findings
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {finding.obligation.reference}
          </span>
          <CopyButton value={finding.obligation.reference} label="Copy ref" />
        </div>
      </div>

      <header className="border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          <ReviewStatusBadge status={finding.reviewStatus} />
          <GapStatusLabel status={finding.status} />
          {finding.citationVerified ? (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-brand dark:text-support">
              <CheckCircle size={11} weight="bold" aria-hidden="true" />
              Citation verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-fg">
              <WarningCircle size={11} weight="bold" aria-hidden="true" className="text-danger" />
              Citation flagged
            </span>
          )}
        </div>
        <h1 className="mt-3 max-w-[36ch] text-2xl font-medium leading-snug tracking-[-0.025em] sm:text-3xl">
          {finding.obligation.plainLanguage}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
          <Link
            href={`/app/circulars/${finding.document.id}`}
            className="inline-flex items-center gap-1.5 font-medium hover:text-brand dark:hover:text-support"
          >
            <FileText size={13} weight="bold" aria-hidden="true" />
            {finding.document.title}
          </Link>
          <span className="font-mono">{finding.clause.sectionLabel}</span>
          {finding.obligation.sla ? <span>SLA · {finding.obligation.sla}</span> : null}
          <span className="inline-flex items-center gap-1.5">
            <Clock size={12} weight="bold" aria-hidden="true" />
            Deadline {formatDate(finding.dueDate)}
          </span>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-5 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Source clause · {finding.document.regulator}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                Page {finding.clause.pageNumber}
              </span>
            </div>
            <div className="p-5">
              {finding.clause.heading ? (
                <p className="text-xs font-medium text-muted">{finding.clause.heading}</p>
              ) : null}
              <blockquote className="mt-2 border-l-2 border-brand pl-4 text-[15px] leading-relaxed">
                {finding.clause.text}
              </blockquote>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <SealCheck
                    size={14}
                    weight="bold"
                    aria-hidden="true"
                    className="text-brand dark:text-support"
                  />
                  Exact substring match · minimum 12 characters
                </span>
                <a
                  href={finding.document.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-medium hover:text-fg"
                >
                  Source
                  <ArrowUpRight size={12} weight="bold" aria-hidden="true" />
                </a>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Action required
              </p>
              <p className="mt-2 text-sm leading-relaxed">{finding.obligation.actionRequired}</p>
              <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                Applies to {finding.obligation.applicableTo}
              </p>
            </Card>

            <Card className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Why it is a gap
              </p>
              <p className="mt-2 text-sm leading-relaxed">{finding.gapDescription}</p>
              {finding.severityRationale ? (
                <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                  {finding.severityRationale}
                </p>
              ) : null}
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Internal mapping
              </p>
              <Badge tone="outline">{humanize(finding.obligation.obligationType)}</Badge>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {finding.policy ? (
                <Link
                  href={`/app/policies/${finding.policy.id}`}
                  className="block rounded-xl bg-surface-2 p-4 transition-colors hover:bg-surface-2/70"
                >
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-brand dark:text-support">
                    Policy
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-fg">{finding.policy.code}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{finding.policy.title}</p>
                  <p className="mt-3 text-[11px] text-muted">
                    Owner · {finding.policy.ownerName} · {finding.policy.section}
                  </p>
                </Link>
              ) : (
                <div className="rounded-xl border border-dashed border-line p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    Policy
                  </p>
                  <p className="mt-1.5 text-sm">No policy matched.</p>
                  <p className="mt-1 text-xs text-muted">
                    The rule treats this as an uncovered obligation.
                  </p>
                </div>
              )}

              {finding.control ? (
                <div className="rounded-xl bg-surface-2 p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-brand dark:text-support">
                    Control
                  </p>
                  <p className="mt-1.5 text-sm font-medium">{finding.control.code}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{finding.control.title}</p>
                  <p className="mt-3 text-[11px] text-muted">
                    Owner · {finding.control.ownerName}
                    {finding.control.systemName ? ` · ${finding.control.systemName}` : ""}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    Control
                  </p>
                  <p className="mt-1.5 text-sm">No control matched.</p>
                  <p className="mt-1 text-xs text-muted">
                    Add an operational control before approving remediation.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-5 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Drafted redline · not published
              </span>
              <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="size-2 rounded-sm bg-danger/25" />
                  removed
                </span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="size-2 rounded-sm bg-brand/25" />
                  added
                </span>
                {hasRedline ? (
                  <CopyButton
                    value={finding.approvedWording ?? finding.redlineAfter}
                    label="Copy wording"
                  />
                ) : null}
              </div>
            </div>
            <div className="p-5">
              {hasRedline ? (
                <p className="text-sm leading-8">
                  <span className="sr-only">
                    Removed text is struck through. Added text is highlighted.
                  </span>
                  {finding.diff.map((token, index) =>
                    token.type === "equal" ? (
                      <span key={index}>{token.value} </span>
                    ) : token.type === "removed" ? (
                      <span key={index}>
                        <del className="rounded bg-danger/10 px-1 text-muted line-through decoration-danger/60">
                          {token.value}
                        </del>{" "}
                      </span>
                    ) : (
                      <span key={index}>
                        <ins className="rounded bg-brand/10 px-1 text-fg no-underline dark:bg-support/20">
                          {token.value}
                        </ins>{" "}
                      </span>
                    ),
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted">No redline was required for this obligation.</p>
              )}
              {finding.approvedWording ? (
                <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    Officer-approved wording
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{finding.approvedWording}</p>
                </div>
              ) : null}
              <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                Approval records the decision and queues a remediation email. It does not modify{" "}
                {finding.policy ? finding.policy.code : "a policy"} or publish a register update.
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Overall confidence
                </p>
                <p className="mt-2 font-mono text-4xl tracking-tight text-brand dark:text-support">
                  {formatPercent(finding.confidence)}
                </p>
              </div>
              <Badge tone="outline">Computed</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {breakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted">{item.label}</span>
                    <span className="font-mono text-[10px] text-fg">
                      {formatPercent(item.value)} · {item.weight}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(0, Math.min(100, item.value * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
              Weighted formula, not a model score. Extraction confidence{" "}
              {formatPercent(finding.extractionConfidence)} · mapping{" "}
              {formatPercent(finding.mappingConfidence)}.
            </p>
          </Card>

          {finding.taskTitle ? (
            <Card className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Remediation task
              </p>
              <p className="mt-2 text-sm font-medium leading-snug">{finding.taskTitle}</p>
              <dl className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Owner</dt>
                  <dd>{finding.taskAssignee ?? "Unassigned"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Notify</dt>
                  <dd className="truncate font-mono text-[10px]">
                    {finding.taskAssigneeEmail ?? "No address"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Target</dt>
                  <dd>{formatDate(finding.taskDueDate ?? finding.dueDate)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                The email is queued through the outbox only after approval.
              </p>
            </Card>
          ) : null}

          {canReview && pending ? (
            <ReviewForm findingId={finding.id} defaultWording={finding.redlineAfter} />
          ) : pending ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <ShieldWarning
                  size={18}
                  weight="bold"
                  aria-hidden="true"
                  className="mt-0.5 text-brand dark:text-support"
                />
                <div>
                  <p className="text-sm font-medium">Read-only review state</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    You are signed in as {actor.role}. Only owners and admins can record a review
                    decision. The finding stays pending until an authorized reviewer acts.
                  </p>
                </div>
              </div>
            </Card>
          ) : finding.reviewStatus === "NOT_REQUIRED" ? (
            <Card className="p-5">
              <p className="text-sm font-medium">No review is required.</p>
              <p className="mt-1.5 text-xs text-muted">
                The obligation is marked compliant by the gap rule.
              </p>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Decision on record
                </p>
                <ReviewStatusBadge status={finding.reviewStatus} />
              </div>
              <p className="mt-3 text-sm">
                {finding.reviewerName ?? "Reviewer"} · {humanize(finding.reviewStatus)}
              </p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(finding.reviewedAt)}</p>
              {finding.reviewComments ? (
                <blockquote className="mt-3 border-l-2 border-line pl-3 text-xs leading-relaxed text-muted">
                  {finding.reviewComments}
                </blockquote>
              ) : null}
              <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
                This decision is locked. Reopening requires a new finding or an explicit data
                change, so the audit trail stays append-only.
              </p>
            </Card>
          )}

          <Card className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Review history
            </p>
            {finding.reviews.length === 0 ? (
              <p className="mt-3 text-xs text-muted">No review events recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-4 border-l border-line pl-4">
                {finding.reviews.map((review) => (
                  <li key={review.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[21px] top-1 size-2 rounded-full bg-brand"
                    />
                    <p className="text-xs font-medium">
                      {review.actorName}{" "}
                      <span className="font-normal text-muted">· {review.actorRole}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-brand dark:text-support">
                      {humanize(review.action)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatDateTime(review.createdAt)}
                    </p>
                    {review.comments ? (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">{review.comments}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
