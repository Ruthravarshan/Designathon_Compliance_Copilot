import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, FilePlus, FileText } from "@phosphor-icons/react/dist/ssr";
import { CircularsExplorer } from "@/components/circulars/circulars-explorer";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { actorCan, getActor } from "@/server/auth/actor";
import { listDocuments } from "@/server/compliance/service";

export const metadata: Metadata = { title: "Circulars" };

export default async function CircularsPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "document:read")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const documents = await listDocuments(actor);
  const canIngest = actorCan(actor, "document:ingest");

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Register / Circulars
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Regulatory circulars
          </h1>
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted">
            Every circular is stored with its source URL, effective date, and a checksum. Clauses
            are split on blank lines; each obligation keeps a verified citation back to its clause.
          </p>
        </div>
        {canIngest ? (
          <LinkButton href="/app/circulars/new" className="h-10 px-4">
            <FilePlus size={16} weight="bold" aria-hidden="true" />
            Ingest circular
          </LinkButton>
        ) : (
          <Badge tone="outline">Read-only role</Badge>
        )}
      </header>

      {documents.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <FileText
            size={30}
            weight="bold"
            aria-hidden="true"
            className="mx-auto text-brand dark:text-support"
          />
          <h2 className="mt-4 text-lg font-medium">No circulars ingested yet.</h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted">
            Paste a regulation excerpt. The parser needs blank-line separated clauses of at least 24
            characters to produce citations.
          </p>
          {canIngest ? (
            <div className="mt-6">
              <LinkButton href="/app/circulars/new">Ingest the first circular</LinkButton>
            </div>
          ) : null}
        </Card>
      ) : (
        <CircularsExplorer
          items={documents.map((doc) => ({
            id: doc.id,
            title: doc.title,
            reference: doc.reference,
            regulator: doc.regulator,
            summary: doc.summary,
            publishedAt: doc.publishedAt.toISOString(),
            status: doc.status,
            clauseCount: doc.clauseCount,
            findingCount: doc.findingCount,
            criticalCount: doc.criticalCount,
          }))}
        />
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface/60 px-5 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Source URLs are stored, not scraped. The demo ships with five circular excerpts from RBI,
          SEBI, IRDAI, CERT-In, and the DPDP Act.
        </p>
        <Link
          href="/app/findings"
          className="inline-flex shrink-0 items-center gap-1.5 font-medium hover:text-brand"
        >
          See extracted findings
          <ArrowUpRight size={13} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
