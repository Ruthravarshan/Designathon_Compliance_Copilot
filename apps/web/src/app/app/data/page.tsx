import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Database } from "@phosphor-icons/react/dist/ssr";
import { DataCatalogExplorer } from "@/components/data/data-catalog-explorer";
import { ScanForm } from "@/components/scan-form";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { actorCan, getActor } from "@/server/auth/actor";
import { listDataScans } from "@/server/compliance/service";

export const metadata: Metadata = { title: "Data discovery" };

export default async function DataPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "document:read")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const { items, summary } = await listDataScans(actor);
  const canScan = actorCan(actor, "data:scan");

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Workbench / Data discovery
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Personal data surface
          </h1>
          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">
            A deterministic DPDP scan over catalog metadata. It looks at sensitivity, encryption at
            rest, and whether consent is recorded — three observed facts, no guessing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">{summary.total} fields</Badge>
          <Badge tone="brand" dot>
            {summary.critical} critical
          </Badge>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Catalogued fields", value: summary.total, detail: "Masked metadata only" },
          {
            label: "Critical risk",
            value: summary.critical,
            detail: "Sensitive and unencrypted or unconsented",
          },
          { label: "High risk", value: summary.high, detail: "Missing consent basis" },
          {
            label: "Without consent",
            value: summary.unconsented,
            detail: `${summary.unencrypted} also unencrypted`,
          },
        ].map((metric) => (
          <Card key={metric.label} className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {metric.label}
            </p>
            <p className="mt-3 font-mono text-3xl tracking-tight text-brand dark:text-support">
              {metric.value}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{metric.detail}</p>
          </Card>
        ))}
      </section>

      {canScan ? <ScanForm /> : null}

      {items.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <Database
            size={30}
            weight="bold"
            aria-hidden="true"
            className="mx-auto text-brand dark:text-support"
          />
          <h2 className="mt-4 text-lg font-medium">No fields have been scanned.</h2>
          <p className="mx-auto mt-2 max-w-[48ch] text-sm text-muted">
            {canScan
              ? "Add a catalog field above to run the deterministic DPDP checks."
              : "An owner or admin can add a masked catalog field for scanning."}
          </p>
        </Card>
      ) : (
        <DataCatalogExplorer
          items={items.map((item) => ({
            id: item.id,
            datasetName: item.datasetName,
            fieldName: item.fieldName,
            dataCategory: item.dataCategory,
            sensitiveType: item.sensitiveType,
            sampleMasked: item.sampleMasked,
            encrypted: item.encrypted,
            consented: item.consented,
            riskLevel: item.riskLevel,
            finding: item.finding,
            citation: item.citation,
          }))}
        />
      )}
    </div>
  );
}
