import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClockCounterClockwise, LockKey } from "@phosphor-icons/react/dist/ssr";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime, humanize } from "@/lib/format";
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
        <Badge tone="brand" dot>
          Append-only
        </Badge>
      </header>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-4 py-3 text-xs leading-relaxed text-muted">
        <LockKey
          size={15}
          weight="bold"
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand"
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
            className="mx-auto text-brand"
          />
          <h2 className="mt-4 text-lg font-medium">No audit events yet.</h2>
          <p className="mt-2 text-sm text-muted">
            Sign-in, ingestion, review decisions, and data scans will appear here.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[11rem_1fr_9rem_1fr] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted lg:grid">
            <span>When</span>
            <span>Action</span>
            <span>Actor</span>
            <span>Context</span>
          </div>
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="grid gap-2 px-5 py-3.5 lg:grid-cols-[11rem_1fr_9rem_1fr] lg:items-baseline lg:gap-4"
              >
                <span className="font-mono text-[10px] text-muted">
                  {formatDateTime(entry.createdAt)}
                </span>
                <div>
                  <p className="font-mono text-[11px] text-fg">{entry.action}</p>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    {entry.entity}
                    {entry.entityId ? ` · ${entry.entityId.slice(0, 10)}…` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">{entry.actorName ?? "System"}</span>
                <span
                  className="truncate font-mono text-[10px] text-muted"
                  title={summarizeMetadata(entry.metadata)}
                >
                  {summarizeMetadata(entry.metadata)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Showing the latest {entries.length} events · {humanize(actor.role)} view
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
