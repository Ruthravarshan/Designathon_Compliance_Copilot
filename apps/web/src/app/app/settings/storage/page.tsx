import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HardDrives, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { StorageSettingsClient } from "@/components/settings/storage-settings-client";
import { StorageBrowser } from "@/components/settings/storage-browser";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AppError } from "@/lib/errors";
import { actorCan, getActor } from "@/server/auth/actor";
import type { StorageConnection } from "@/server/storage/types";
import { listStorageConnections, storageEnvironmentStatus } from "@/server/storage/connections";

export const metadata: Metadata = { title: "Storage settings" };
export const dynamic = "force-dynamic";

export default async function StorageSettingsPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "storage:manage")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  let connections: StorageConnection[] = [];
  let migrationPending = false;
  try {
    connections = await listStorageConnections(actor.workspaceId);
  } catch (error) {
    if (error instanceof AppError && error.status === 503) {
      migrationPending = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Workbench / Settings / Storage
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Document storage
          </h1>
          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">
            Circular PDFs are written to the primary store and fall back to the standby only when
            the primary is unavailable. Owners and admins choose the location; secrets stay in the
            server environment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">Microsoft Graph</Badge>
          <Badge tone="outline">Google Drive</Badge>
          <Badge tone="outline">Supabase Storage</Badge>
        </div>
      </header>

      {migrationPending ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-fg"
        >
          <ShieldCheck
            size={18}
            weight="bold"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-danger"
          />
          <span>
            The storage settings table is not in this database yet. Apply{" "}
            <code className="font-mono text-xs">
              apps/web/prisma/sql/003-storage-connections.sql
            </code>{" "}
            (or run <code className="font-mono text-xs">npm run db:init</code>) and reload this
            page.
          </span>
        </div>
      ) : null}

      <StorageSettingsClient connections={connections} env={storageEnvironmentStatus()} />

      {connections.length > 0 ? (
        <StorageBrowser
          connections={connections.map((connection) => ({
            id: connection.id,
            provider: connection.provider,
            status: connection.status ?? null,
            isDefault: connection.isDefault,
            isFallback: connection.isFallback ?? false,
          }))}
          canManage
        />
      ) : null}

      <Card className="flex items-start gap-3 p-5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand dark:text-accent">
          <HardDrives size={18} weight="bold" aria-hidden="true" />
        </span>
        <p className="text-xs leading-relaxed text-muted">
          Uploads are path-scoped per workspace and never overwrite an existing file. A failed
          provider call surfaces a safe error code here; it is never reported as a successful
          upload.
        </p>
      </Card>
    </div>
  );
}
