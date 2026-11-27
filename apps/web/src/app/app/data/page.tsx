import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Database, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { ScanForm } from "@/components/scan-form";
import { SeverityBadge } from "@/components/severity-badge";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { humanize } from "@/lib/format";
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
            <p className="mt-3 font-mono text-3xl tracking-tight text-brand">{metric.value}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{metric.detail}</p>
          </Card>
        ))}
      </section>

      {canScan ? <ScanForm /> : null}

      {items.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <Database size={30} weight="bold" aria-hidden="true" className="mx-auto text-brand" />
          <h2 className="mt-4 text-lg font-medium">No fields have been scanned.</h2>
          <p className="mx-auto mt-2 max-w-[48ch] text-sm text-muted">
            {canScan
              ? "Add a catalog field above to run the deterministic DPDP checks."
              : "An owner or admin can add a masked catalog field for scanning."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[5.5rem_1.2fr_7rem_7rem_1fr] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted lg:grid">
            <span>Risk</span>
            <span>Field</span>
            <span>Category</span>
            <span>Safeguards</span>
            <span>Finding</span>
          </div>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li
                key={item.id}
                className="grid gap-3 px-5 py-4 lg:grid-cols-[5.5rem_1.2fr_7rem_7rem_1fr] lg:items-start lg:gap-4"
              >
                <SeverityBadge severity={item.riskLevel} />
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-fg">
                    {item.datasetName}.{item.fieldName}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    {item.sampleMasked ?? "no sample"}
                    {item.sensitiveType ? ` · ${item.sensitiveType}` : ""}
                  </p>
                </div>
                <p className="text-xs text-muted">{humanize(item.dataCategory)}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={
                      item.encrypted
                        ? "rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted"
                        : "rounded-full border border-danger/35 bg-danger/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-fg"
                    }
                  >
                    {item.encrypted ? "Encrypted" : "Not encrypted"}
                  </span>
                  <span
                    className={
                      item.consented
                        ? "rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted"
                        : "rounded-full border border-danger/35 bg-danger/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-fg"
                    }
                  >
                    {item.consented ? "Consent" : "No consent"}
                  </span>
                </div>
                <div>
                  <p className="text-xs leading-relaxed text-muted">{item.finding}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    {item.citation}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 border-t border-line px-5 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={13} weight="bold" aria-hidden="true" className="text-brand" />
              Samples are masked before they reach the API.
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
              Citations · DPDP Act 2023
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
