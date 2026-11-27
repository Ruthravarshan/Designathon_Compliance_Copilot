import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClockCounterClockwise, DownloadSimple, LockKey } from "@phosphor-icons/react/dist/ssr";
import { AuditExplorer } from "@/components/audit/audit-explorer";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { actorCan, getActor } from "@/server/auth/actor";
import { listAuditLog } from "@/server/compliance/service";

export const metadata: Metadata = { title: "Audit trail" };

function summarizeMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined) {
    return "—";
  }
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    const parts = Object.entries(metadata as Record<string, unknown>)
      .slice(0, 4)
      .map(([key, value]) => {
        if (value === null || value === undefined) {
          return `${key}=null`;
        }
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          return `${key}=${String(value)}`;
        }
        if (Array.isArray(value)) {
          return `${key}=[${value.length}]`;
        }
        return `${key}=…`;
      });
    return parts.join(" · ") || "—";
  }
  return String(metadata);
}

export default async function AuditPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "audit:read")) {
    return (
      <UnauthorizedState
        title="The audit trail is restricted."
        body="Only owners and admins can read workspace audit logs. Review history for a specific finding remains visible on its detail page."
        signedInAs={`${actor.name} · ${actor.role}`}
      />
    );
  }

  const entries = await listAuditLog(actor, 80);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Governance / Audit trail
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">Audit trail</h1>
          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">
            Writes that change access, status, money, or data ownership leave an audit row with the
            actor, entity, and metadata. Review events carry their own immutable history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" dot>
            Append-only
          </Badge>
          <a
            href="/api/export/findings"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-fg transition-colors hover:border-muted/60 hover:bg-surface-2"
          >
            <DownloadSimple size={14} weight="bold" aria-hidden="true" />
            Export evidence CSV
          </a>
        </div>
      </header>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-4 py-3 text-xs leading-relaxed text-muted">
        <LockKey
          size={15}
          weight="bold"
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand dark:text-support"
        />
        <p>
          The workbench never offers an edit or delete affordance for an audit row. Redaction
          happens before logging; requester email addresses and reset links are not stored here.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <ClockCounterClockwise
            size={30}
            weight="bold"
            aria-hidden="true"
            className="mx-auto text-brand dark:text-support"
          />
          <h2 className="mt-4 text-lg font-medium">No audit events yet.</h2>
          <p className="mt-2 text-sm text-muted">
            Sign-in, ingestion, review decisions, and data scans will appear here.
          </p>
        </Card>
      ) : (
        <AuditExplorer
          actorRole={actor.role}
          entries={entries.map((entry) => ({
            id: entry.id,
            action: entry.action,
            entity: entry.entity,
            entityId: entry.entityId,
            actorName: entry.actorName,
            createdAt: entry.createdAt.toISOString(),
            metadataSummary: summarizeMetadata(entry.metadata),
            metadataPretty:
              entry.metadata !== null && entry.metadata !== undefined
                ? JSON.stringify(entry.metadata, null, 2)
                : null,
          }))}
        />
      )}
    </div>
  );
}
