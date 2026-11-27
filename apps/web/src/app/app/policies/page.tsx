import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Books } from "@phosphor-icons/react/dist/ssr";
import { PolicyCheckButton } from "@/components/policy/policy-check-button";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";
import { actorCan, getActor } from "@/server/auth/actor";
import { listPolicies } from "@/server/policy/service";

export const metadata: Metadata = { title: "Policies" };
export const dynamic = "force-dynamic";

function outcomeTone(result: string): "brand" | "danger" | "outline" {
  if (result === "GAPS") {
    return "danger";
  }
  if (result === "AT_RISK") {
    return "brand";
  }
  return "outline";
}

export default async function PoliciesPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "policy:read")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const policies = await listPolicies(actor);
  const canCheck = actorCan(actor, "policy:check");

  return (
    <div className="space-y-6">
      <PageHeader
        meta={
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Workbench / Internal Policies
          </span>
        }
        title="Policy register"
        subtitle="Internal corporate policies mapped against ingested regulatory obligations. Run compliance checks to compute posture and notify policy owners."
        action={<Badge tone="outline">{policies.length} policies</Badge>}
      />

      {policies.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <Books
            size={28}
            weight="bold"
            aria-hidden="true"
            className="mx-auto text-brand dark:text-support"
          />
          <h2 className="mt-4 text-lg font-medium text-fg">No internal policies registered.</h2>
          <p className="mx-auto mt-2 max-w-[48ch] text-sm text-muted">
            This workspace has no policies in its register yet.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {policies.map((policy) => (
            <Card key={policy.id} className="p-5 transition-colors hover:border-brand/40">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-brand dark:text-support">
                      {policy.code}
                    </span>
                    <Badge tone={outcomeTone(policy.assessment.result)}>
                      {policy.assessment.result.replace(/_/g, " ")}
                    </Badge>
                    <Badge tone="outline">{policy.version}</Badge>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      Score {policy.assessment.score}/100
                    </span>
                  </div>

                  <Link
                    href={`/app/policies/${policy.id}`}
                    className="group inline-flex items-center gap-2 text-base font-semibold text-fg hover:text-brand dark:hover:text-support"
                  >
                    <span>{policy.title}</span>
                    <ArrowRight
                      size={14}
                      weight="bold"
                      aria-hidden="true"
                      className="text-muted transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>

                  <p className="text-xs leading-relaxed text-muted">{policy.assessment.summary}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted">
                    <span>Section: {policy.section}</span>
                    <span>Owner: {policy.ownerName}</span>
                    <span>Open findings: {policy.assessment.open}</span>
                    {policy.lastCheck ? (
                      <span>
                        Last checked: {formatDate(policy.lastCheck.createdAt)} (
                        {policy.lastCheck.score}/100)
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {canCheck ? <PolicyCheckButton policyId={policy.id} compact /> : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
