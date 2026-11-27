import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PolicyCheckButton } from "@/components/policy/policy-check-button";
import { ReviewStatusBadge, SeverityBadge } from "@/components/severity-badge";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { actorCan, getActor } from "@/server/auth/actor";
import { getPolicyDetail } from "@/server/policy/service";

export const metadata: Metadata = { title: "Policy detail" };
export const dynamic = "force-dynamic";

export default async function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "policy:read")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const { id } = await params;
  const detail = await getPolicyDetail(actor, id).catch((error: unknown) => {
    if (error instanceof AppError && error.code === ERROR_CODES.NOT_FOUND) {
      notFound();
    }
    throw error;
  });

  const { policy, findings, checks, assessment } = detail;
  const canCheck = actorCan(actor, "policy:check");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/policies"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
        >
          <ArrowLeft size={13} weight="bold" aria-hidden="true" />
          Policy register
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {policy.code} · {policy.version}
        </span>
      </div>

      <header className="flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={assessment.result === "GAPS" ? "danger" : "brand"}>
              {assessment.result.replace(/_/g, " ")}
            </Badge>
            <Badge tone="outline">Score {assessment.score}/100</Badge>
            <Badge tone="outline">{policy.section}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-fg sm:text-3xl">
            {policy.title}
          </h1>
          <p className="text-sm text-muted">
            Owner: {policy.ownerName} ({policy.ownerEmail}) · Reviewed{" "}
            {formatDate(policy.reviewedAt)}
          </p>
        </div>

        {canCheck ? <PolicyCheckButton policyId={policy.id} /> : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Current policy wording
            </p>
            <p className="mt-3 text-sm leading-relaxed text-fg">{policy.text}</p>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-5 py-3">
              <h2 className="text-sm font-semibold text-fg">Mapped findings</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {findings.length} linked
              </span>
            </div>
            {findings.length === 0 ? (
              <div className="px-5 py-10 text-center text-xs text-muted">
                No regulatory findings mapped to this policy.
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {findings.map((finding) => (
                  <li key={finding.id}>
                    <Link
                      href={`/app/findings/${finding.id}`}
                      className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2/60"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={finding.severity} />
                          <ReviewStatusBadge status={finding.reviewStatus} />
                          <span className="font-mono text-[10px] text-muted">
                            {finding.document.reference}
                          </span>
                        </div>
                        <p className="truncate text-xs text-fg">{finding.gapDescription}</p>
                      </div>
                      <ArrowRight
                        size={14}
                        weight="bold"
                        aria-hidden="true"
                        className="shrink-0 text-muted group-hover:text-brand dark:group-hover:text-support"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Compliance check history
          </p>
          {checks.length === 0 ? (
            <p className="mt-4 text-xs text-muted">
              No compliance checks recorded yet. Run a check to persist an assessment snapshot.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {checks.map((check) => (
                <li key={check.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-fg">
                      {humanize(check.result)} · {check.score}/100
                    </span>
                    <span className="font-mono text-[10px] text-muted">
                      {formatDateTime(check.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{check.summary}</p>
                  {check.actorName ? (
                    <p className="mt-1 font-mono text-[10px] text-muted">
                      Checked by {check.actorName}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
