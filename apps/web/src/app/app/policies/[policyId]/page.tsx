import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import { PolicyCheckButton } from "@/components/policy/policy-check-button";
import { ReviewStatusBadge, SeverityBadge } from "@/components/severity-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { UnauthorizedState } from "@/components/ui/states";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { actorCan, getActor } from "@/server/auth/actor";
import { getPolicyDetail } from "@/server/policy/service";

export const metadata: Metadata = { title: "Policy detail" };

const OUTCOME_TONE: Record<string, "brand" | "danger" | "outline"> = {
  COMPLIANT: "brand",
  AT_RISK: "outline",
  GAPS: "danger",
};

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "policy:read")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const { policyId } = await params;
  const detail = await getPolicyDetail(actor, policyId).catch((error: unknown) => {
    if (error instanceof AppError && error.code === ERROR_CODES.NOT_FOUND) {
      notFound();
    }
    throw error;
  });

  const { policy, findings, checks, assessment } = detail;
  const canCheck = actorCan(actor, "policy:check");
  const openFindings = findings.filter((finding) => finding.reviewStatus === "PENDING_REVIEW");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/policies"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
        >
          <ArrowLeft size={13} weight="bold" aria-hidden="true" />
          All policies
        </Link>
      </div>

      <header className="flex flex-col justify-between gap-5 border-b border-line pb-6 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{policy.code}</Badge>
            <Badge tone="outline">v{policy.version}</Badge>
            <Badge tone={OUTCOME_TONE[assessment.result] ?? "outline"} dot>
              {assessment.result.replace("_", " ")} · {assessment.score}/100
            </Badge>
          </div>
          <h1 className="mt-3 max-w-[32ch] text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            {policy.title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {policy.section} · owner {policy.ownerName} ({policy.ownerEmail}) · reviewed{" "}
            {formatDate(policy.reviewedAt)}
          </p>
        </div>
        {canCheck ? <PolicyCheckButton policyId={policy.id} /> : null}
      </header>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-4 py-3 text-xs leading-relaxed text-muted">
        <WarningOctagon
          size={15}
          weight="bold"
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand"
        />
        <p>
          A check reads the findings currently mapped to this policy, scores posture, writes an
          immutable check row, and queues an alert to the policy and workspace owners when the
          result is not compliant. It never edits the policy text.
        </p>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Open", value: String(assessment.open) },
          { label: "Critical", value: String(assessment.critical) },
          { label: "High", value: String(assessment.high) },
          { label: "Medium / low", value: `${assessment.medium} / ${assessment.low}` },
          { label: "Overdue", value: String(assessment.overdue) },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface px-5 py-4">
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              {stat.label}
            </dt>
            <dd className="mt-1.5 text-lg font-medium text-fg">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-sm font-medium text-fg">Check history</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {checks.length} recorded
          </span>
        </CardHeader>
        {checks.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            No check has run yet. Use Check compliance to record the first one.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {checks.map((check) => (
              <li
                key={check.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={OUTCOME_TONE[check.result] ?? "outline"} dot>
                      {check.result.replace("_", " ")}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted">
                      {formatDateTime(check.createdAt)}
                    </span>
                    <span className="text-xs text-muted">
                      {check.actorName ?? "system"} · {humanize(check.trigger)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{check.summary}</p>
                </div>
                <div className="text-right font-mono text-[11px] text-fg">
                  {check.score}/100
                  <span className="block text-[10px] text-muted">
                    {check.critical}C · {check.high}H · {check.overdue} overdue
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-sm font-medium text-fg">Findings mapped to this policy</h2>
          <Badge tone="neutral">{openFindings.length} open</Badge>
        </CardHeader>
        {findings.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            No regulatory finding has mapped to this policy yet. Ingest a circular to generate
            obligations and mappings.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-surface-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                  <th className="px-5 py-2.5 font-medium">Severity</th>
                  <th className="px-3 py-2.5 font-medium">Review</th>
                  <th className="px-3 py-2.5 font-medium">Due</th>
                  <th className="px-3 py-2.5 font-medium">Document</th>
                  <th className="px-5 py-2.5 text-right font-medium">Finding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {findings.map((finding) => (
                  <tr key={finding.id}>
                    <td className="px-5 py-3">
                      <SeverityBadge severity={finding.severity} />
                    </td>
                    <td className="px-3 py-3">
                      <ReviewStatusBadge status={finding.reviewStatus} />
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px] text-muted">
                      {formatDate(finding.dueDate)}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/app/circulars/${finding.document.id}`}
                        className="text-brand hover:underline"
                      >
                        {finding.document.reference}
                      </Link>
                      <span className="block text-[10px] text-muted">
                        {finding.obligation.reference}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/app/findings/${finding.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <details className="rounded-2xl border border-line bg-surface">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-fg">
          Policy text ({policy.text.length.toLocaleString("en-IN")} characters)
        </summary>
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap border-t border-line px-5 py-4 font-sans text-xs leading-relaxed text-muted">
          {policy.text}
        </pre>
      </details>
    </div>
  );
}
