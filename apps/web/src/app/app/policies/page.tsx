import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Scroll } from "@phosphor-icons/react/dist/ssr";
import { PoliciesExplorer } from "@/components/policy/policies-explorer";
import { Badge } from "@/components/ui/badge";
import { EmptyState, UnauthorizedState } from "@/components/ui/states";
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
