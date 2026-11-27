import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Scroll } from "@phosphor-icons/react/dist/ssr";
import { PolicyCheckButton } from "@/components/policy/policy-check-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, UnauthorizedState } from "@/components/ui/states";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { actorCan, getActor } from "@/server/auth/actor";
import { listPolicies } from "@/server/policy/service";

export const metadata: Metadata = { title: "Policies" };

const OUTCOME_TONE: Record<string, "brand" | "danger" | "outline"> = {
  COMPLIANT: "brand",
  AT_RISK: "outline",
  GAPS: "danger",
};

export default async function PoliciesPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "policy:read")) {
    return (
      <UnauthorizedState
        title="Policies are restricted."
        body="Ask your workspace owner for policy access. Findings remain readable if they have been mapped to your role."
        signedInAs={`${actor.name} · ${actor.role}`}
      />
    );
  }

  const policies = await listPolicies(actor);
  const canCheck = actorCan(actor, "policy:check");

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-5 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Workbench / Policies
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Internal policies
          </h1>
          <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-muted">
            Each check re-scores the findings mapped to a policy, records an immutable check row,
            and alerts the policy owner and workspace owner when gaps remain open.
          </p>
        </div>
        <Badge tone="brand" dot>
          {policies.length} tracked
        </Badge>
      </header>

      {policies.length === 0 ? (
        <EmptyState
          icon={Scroll}
          title="No internal policies yet."
          description="Seed the demo workspace to load POL-HR-01 and the compliance policies used by the scoring engine."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {policies.map((policy) => (
            <Card key={policy.id} className="flex flex-col">
              <CardHeader>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{policy.code}</Badge>
                    <Badge tone="outline">v{policy.version}</Badge>
                    <Badge tone={OUTCOME_TONE[policy.assessment.result] ?? "outline"} dot>
                      {policy.assessment.result.replace("_", " ")} · {policy.assessment.score}/100
                    </Badge>
                  </div>
                  <h2 className="mt-2 text-base font-medium text-fg">
                    <Link href={`/app/policies/${policy.id}`} className="hover:underline">
                      {policy.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {policy.section} · owner {policy.ownerName} · reviewed{" "}
                    {formatDate(policy.reviewedAt)}
                  </p>
                </div>
              </CardHeader>
              <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                <dl className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Open", value: policy.assessment.open },
                    { label: "Critical", value: policy.assessment.critical },
                    { label: "High", value: policy.assessment.high },
                    { label: "Overdue", value: policy.assessment.overdue },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-line bg-surface-2 px-2 py-2.5">
                      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                        {stat.label}
                      </dt>
                      <dd className="mt-1 text-lg font-medium text-fg">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-muted">
                    {policy.lastCheck
                      ? `Last check ${formatDateTime(policy.lastCheck.createdAt)} · ${humanize(
                          policy.lastCheck.result,
                        )} by ${policy.lastCheck.actorName ?? "system"}`
                      : "No compliance check has run for this policy yet."}
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/policies/${policy.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                    >
                      Details
                      <ArrowRight size={12} weight="bold" aria-hidden="true" />
                    </Link>
                    {canCheck ? <PolicyCheckButton policyId={policy.id} /> : null}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
