import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Books } from "@phosphor-icons/react/dist/ssr";
import { PoliciesExplorer } from "@/components/policy/policies-explorer";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { actorCan, getActor } from "@/server/auth/actor";
import { listPolicies } from "@/server/policy/service";

export const metadata: Metadata = { title: "Policies" };
export const dynamic = "force-dynamic";

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
        <PoliciesExplorer
          canCheck={canCheck}
          policies={policies.map((policy) => ({
            id: policy.id,
            code: policy.code,
            title: policy.title,
            version: policy.version,
            section: policy.section,
            ownerName: policy.ownerName,
            assessment: {
              result: policy.assessment.result,
              score: policy.assessment.score,
              open: policy.assessment.open,
              summary: policy.assessment.summary,
            },
            lastCheck: policy.lastCheck
              ? {
                  score: policy.lastCheck.score,
                  createdAt: policy.lastCheck.createdAt.toISOString(),
                }
              : null,
          }))}
        />
      )}
    </div>
  );
}
