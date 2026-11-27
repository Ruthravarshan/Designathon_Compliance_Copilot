import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AssistantPanel } from "@/components/assistant-panel";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { actorCan, getActor } from "@/server/auth/actor";

export const metadata: Metadata = { title: "Policy Q&A" };

export default async function AssistantPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "assistant:ask")) {
    return (
      <UnauthorizedState
        title="Policy Q&amp;A is not enabled for this role."
        body="The board auditor has read-only access to circulars and findings but cannot query the register or run data scans."
        signedInAs={`${actor.name} · ${actor.role}`}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Workbench / Policy Q&amp;A
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Ask the register
          </h1>
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted">
            A grounded retrieval assistant over this workspace&apos;s policies, controls, and stored
            clauses. It quotes what it finds and escalates when it finds nothing.
          </p>
        </div>
        <Badge tone="brand">No generative model</Badge>
      </header>

      <AssistantPanel />
    </div>
  );
}
