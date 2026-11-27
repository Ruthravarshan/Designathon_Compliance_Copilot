import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { WatchConsole } from "@/components/watch/watch-console";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { actorCan, getActor } from "@/server/auth/actor";
import { listWatchOverview } from "@/server/watch/service";

export const metadata: Metadata = { title: "Regulatory watchdog" };
export const dynamic = "force-dynamic";

export default async function WatchPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "watch:read")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const overview = await listWatchOverview(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        meta={
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Workbench / Regulatory Watchdog
          </span>
        }
        title="Regulatory watchdog"
        subtitle="Track allowlisted regulator circular feeds, detect document revisions by checksum, and monitor workspace compliance posture."
        action={<Badge tone="brand">Band · {overview.posture.band.replace(/_/g, " ")}</Badge>}
      />

      <WatchConsole
        overview={overview}
        canRun={actorCan(actor, "watch:run")}
        canManage={actorCan(actor, "watch:manage")}
      />
    </div>
  );
}
