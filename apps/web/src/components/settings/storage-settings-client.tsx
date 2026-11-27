"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CircleNotch,
  Database,
  GoogleLogo,
  HardDrives,
  Plug,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import type {
  StorageConnection,
  StorageConnectionConfig,
  StorageKind,
} from "@/server/storage/types";

export interface StorageEnvStatus {
  graph: boolean;
  drive: boolean;
  supabase: boolean;
}

interface ProviderSpec {
  provider: StorageKind;
  title: string;
  subtitle: string;
  envKey: keyof StorageEnvStatus;
  envNames: readonly string[];
  hint: string;
  fields: readonly {
    key: keyof StorageConnectionConfig;
    label: string;
    placeholder: string;
  }[];
}

const PROVIDERS: readonly ProviderSpec[] = [
  {
    provider: "SHAREPOINT",
    title: "SharePoint / OneDrive",
    subtitle: "Primary store for circular PDFs, through Microsoft Graph.",
    envKey: "graph",
    envNames: ["MSFT_GRAPH_TENANT_ID", "MSFT_GRAPH_CLIENT_ID", "MSFT_GRAPH_CLIENT_SECRET"],
    hint: "Paste the shared folder link first. The link is resolved with app-only Graph permissions; a drive id, site id, or drive owner is an alternative.",
    fields: [
      { key: "folderUrl", label: "Shared folder link", placeholder: "https://…sharepoint.com/…" },
      { key: "folderItemId", label: "Folder item id (optional)", placeholder: "01ABCDEF…" },
      { key: "driveId", label: "Drive id (optional)", placeholder: "b!abc123…" },
      {
        key: "siteId",
        label: "Site id (optional)",
        placeholder: "contoso.sharepoint.com,site,web",
      },
      { key: "driveOwner", label: "Drive owner UPN (optional)", placeholder: "owner@contoso.com" },
      { key: "folder", label: "Folder path (optional)", placeholder: "PolicyPulse/Circulars" },
    ],
  },
  {
    provider: "GOOGLE_DRIVE",
    title: "Google Drive",
    subtitle: "Standby store used when the primary is unavailable.",
    envKey: "drive",
    envNames: ["GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"],
    hint: "Share the folder with the service account email (Editor). Paste the folder link; the folder id is read from it.",
    fields: [
      {
        key: "folderUrl",
        label: "Folder link",
        placeholder: "https://drive.google.com/drive/folders/…",
      },
      { key: "folderId", label: "Folder id", placeholder: "1AbCdEfGh…" },
    ],
  },
  {
    provider: "SUPABASE_STORAGE",
    title: "Supabase Storage",
    subtitle: "Private bucket standby for local and demo runs.",
    envKey: "supabase",
    envNames: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    hint: "Use a private bucket. Files are served only through the authorized app proxy.",
    fields: [{ key: "bucket", label: "Bucket", placeholder: "circulars" }],
  },
];

type Role = "primary" | "fallback" | "none";
type Pending = "save" | "test" | "delete" | null;

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string; requestId?: string };
}

const ICONS: Record<StorageKind, typeof HardDrives> = {
  SHAREPOINT: HardDrives,
  GOOGLE_DRIVE: GoogleLogo,
  SUPABASE_STORAGE: Database,
};

const ERROR_COPY: Record<string, string> = {
  INTEGRATION_NOT_CONFIGURED: "Credentials for this provider are not configured on the server.",
  STORAGE_UNAVAILABLE: "The provider rejected the probe. Check permissions and the folder id.",
  BAD_REQUEST: "The provider settings are not valid.",
};

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
}

function roleOf(connection: StorageConnection | undefined): Role {
  return connection?.isDefault ? "primary" : connection?.isFallback ? "fallback" : "none";
}

function ProviderCard({
  spec,
  existing,
  envConfigured,
  onChanged,
}: {
  spec: ProviderSpec;
  existing: StorageConnection | undefined;
  envConfigured: boolean;
  onChanged: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const stored = existing?.config ?? {};
    return Object.fromEntries(
      spec.fields.map((field): [string, string] => [field.key, stored[field.key] ?? ""]),
    );
  });
  const [role, setRole] = useState<Role>(roleOf(existing));
  const [pending, setPending] = useState<Pending>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  useEffect(() => {
    setRole(roleOf(existing));
  }, [existing]);

  const Icon = ICONS[spec.provider];
  const status = existing?.status ?? "UNVERIFIED";

  function payload() {
    const config = Object.fromEntries(
      Object.entries(values)
        .map(([key, value]): [string, string] => [key, value.trim()])
        .filter(([, value]) => value.length > 0),
    );
    const clearing = existing?.isDefault || existing?.isFallback;
    const roles =
      role === "primary"
        ? { isDefault: true, isFallback: false }
        : role === "fallback"
          ? { isDefault: false, isFallback: true }
          : clearing
            ? { isDefault: false, isFallback: false }
            : {};
    return { provider: spec.provider, config, ...roles };
  }

  async function save() {
    setPending("save");
    setFeedback(null);
    try {
      const response = await fetch("/api/integrations/storage", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const result = await readEnvelope<StorageConnection>(response);
      if (!response.ok || !result.data) {
        setFeedback({
          kind: "error",
          message: result.error?.message ?? "The connection was not saved.",
        });
        return;
      }
      setFeedback({ kind: "ok", message: "Saved. Run a test to verify the provider." });
      onChanged();
    } catch {
      setFeedback({ kind: "error", message: "The server did not respond. Try again." });
    } finally {
      setPending(null);
    }
  }

  async function test() {
    if (!existing) {
      return;
    }
    setPending("test");
    setFeedback(null);
    try {
      const response = await fetch("/api/integrations/storage/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: existing.id }),
      });
      const result = await readEnvelope<{ ok: boolean; code?: string }>(response);
      if (!response.ok || !result.data) {
        setFeedback({ kind: "error", message: result.error?.message ?? "The test did not run." });
        return;
      }
      if (result.data.ok) {
        setFeedback({ kind: "ok", message: "Connection verified with a live provider call." });
      } else {
        setFeedback({
          kind: "error",
          message: ERROR_COPY[result.data.code ?? ""] ?? "The provider probe failed.",
        });
      }
      onChanged();
    } catch {
      setFeedback({ kind: "error", message: "The server did not respond. Try again." });
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!existing) {
      return;
    }
    if (!window.confirm(`Remove the ${spec.title} connection? New files will not use it.`)) {
      return;
    }
    setPending("delete");
    setFeedback(null);
    try {
      const response = await fetch("/api/integrations/storage", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: existing.id }),
      });
      const result = await readEnvelope<{ deleted: boolean }>(response);
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: result.error?.message ?? "The connection was not removed.",
        });
        return;
      }
      setFeedback({ kind: "ok", message: "Connection removed." });
      onChanged();
    } catch {
      setFeedback({ kind: "error", message: "The server did not respond. Try again." });
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand dark:text-accent">
            <Icon size={18} weight="bold" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-fg">{spec.title}</h2>
              {role !== "none" ? (
                <Badge tone={role === "primary" ? "brand" : "outline"} dot={role === "primary"}>
                  {role === "primary" ? "Primary" : "Fallback"}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted">{spec.subtitle}</p>
          </div>
        </div>
        <Badge
          tone={status === "CONNECTED" ? "brand" : status === "ERROR" ? "danger" : "outline"}
          dot={status === "CONNECTED"}
        >
          {status === "CONNECTED" ? "Verified" : status === "ERROR" ? "Error" : "Not tested"}
        </Badge>
      </CardHeader>

      <CardBody className="flex-1 space-y-4">
        {!envConfigured ? (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs leading-relaxed text-fg">
            Server secrets missing: <span className="font-mono">{spec.envNames.join(", ")}</span>.
            The saved settings still work once the environment is set.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {spec.fields.map((field) => {
            const id = `${spec.provider}-${field.key}`;
            return (
              <Field key={field.key} label={field.label} htmlFor={id}>
                <Input
                  id={id}
                  value={values[field.key] ?? ""}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-xs"
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
              </Field>
            );
          })}
        </div>

        <p className="text-xs leading-relaxed text-muted">{spec.hint}</p>

        <fieldset className="space-y-2">
          <legend className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            Role
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["primary", "Primary"],
                ["fallback", "Fallback"],
                ["none", "Not assigned"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={
                  role === value
                    ? "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-brand bg-brand/10 px-3 text-xs font-medium text-brand"
                    : "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-medium text-muted"
                }
              >
                <input
                  type="radio"
                  name={`${spec.provider}-role`}
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {existing?.lastErrorCode ? (
          <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-fg">
            <WarningCircle
              size={14}
              weight="fill"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-danger"
            />
            <span className="font-mono">{existing.lastErrorCode}</span>
          </p>
        ) : null}

        {feedback ? (
          <p
            role="status"
            className={
              feedback.kind === "ok"
                ? "rounded-xl border border-brand/25 bg-brand/5 px-3.5 py-2.5 text-xs text-brand"
                : "rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger"
            }
          >
            {feedback.message}
          </p>
        ) : null}
      </CardBody>

      <CardFooter>
        <span className="font-mono text-[11px] text-muted">
          {existing?.lastCheckedAt
            ? `Checked ${formatDateTime(existing.lastCheckedAt)}`
            : "Never tested"}
        </span>
        <div className="flex flex-wrap gap-2">
          {existing ? (
            <Button
              variant="secondary"
              size="sm"
              pending={pending === "test"}
              disabled={pending !== null}
              onClick={test}
            >
              <Plug size={14} weight="bold" aria-hidden="true" />
              Test
            </Button>
          ) : null}
          {existing ? (
            <Button
              variant="secondary"
              size="sm"
              pending={pending === "delete"}
              disabled={pending !== null}
              onClick={remove}
            >
              {pending === "delete" ? (
                <CircleNotch size={14} weight="bold" className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash size={14} weight="bold" aria-hidden="true" />
              )}
              Remove
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            pending={pending === "save"}
            disabled={pending !== null}
            onClick={save}
          >
            Save
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export function StorageSettingsClient({
  connections,
  env,
}: {
  connections: readonly StorageConnection[];
  env: StorageEnvStatus;
}) {
  const [items, setItems] = useState<readonly StorageConnection[]>(connections);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/storage");
      if (!response.ok) {
        return;
      }
      const result = await readEnvelope<{ connections: StorageConnection[] }>(response);
      if (result.data?.connections) {
        setItems(result.data.connections);
      }
    } catch {
      return;
    }
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {PROVIDERS.map((spec) => (
        <ProviderCard
          key={spec.provider}
          spec={spec}
          existing={items.find((connection) => connection.provider === spec.provider)}
          envConfigured={env[spec.envKey]}
          onChanged={() => void refresh()}
        />
      ))}
    </div>
  );
}
