import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { IngestForm } from "@/components/ingest-form";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { actorCan, getActor } from "@/server/auth/actor";

export const metadata: Metadata = { title: "Ingest circular" };

export default async function NewCircularPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "document:ingest")) {
    return (
      <UnauthorizedState
        title="Ingesting is limited to owners and admins."
        body="Your role can read circulars and findings but cannot add new regulatory text to the workspace."
        signedInAs={`${actor.name} · ${actor.role}`}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/circulars"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
        >
          <ArrowLeft size={13} weight="bold" aria-hidden="true" />
          Back to circulars
        </Link>
        <h1 className="mt-4 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
          Ingest a circular
        </h1>
        <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-muted">
          The parser treats each blank-line-separated block as a clause. Start blocks with{" "}
          <span className="font-mono text-xs">Section 4.2</span> or{" "}
          <span className="font-mono text-xs">4.2</span> to keep the citation label. Content is
          checksummed and analyzed immediately; findings enter the review queue.
        </p>
      </div>

      <IngestForm />
    </div>
  );
}
