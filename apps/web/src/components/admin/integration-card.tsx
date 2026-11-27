"use client";

import { Key, PlugsConnected, WarningCircle } from "@phosphor-icons/react";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export interface IntegrationFieldRow {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}

export interface IntegrationCardAction {
  label: string;
  variant?: "primary" | "secondary";
  pending?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function IntegrationCard({
  title,
  subtitle,
  status,
  isDefault = false,
  fields,
  envNames,
  lastCheckedAt,
  errorMessage,
  requestId,
  actions,
}: {
  title: string;
  subtitle: string;
  status: "CONNECTED" | "UNCONFIGURED" | "ERROR" | string;
  isDefault?: boolean;
  fields: readonly IntegrationFieldRow[];
  envNames?: readonly string[];
  lastCheckedAt?: string | null;
  errorMessage?: string | null;
  requestId?: string | null;
  actions?: readonly IntegrationCardAction[];
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            {isDefault ? (
              <span className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-brand">
                Default
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        <StatusBadge status={status} />
      </CardHeader>

      <CardBody className="flex-1 space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                {field.label}
              </dt>
              <dd
                className={
                  field.mono
                    ? "mt-1 truncate font-mono text-xs text-fg"
                    : "mt-1 truncate text-sm text-fg"
                }
              >
                {field.value && field.value.length > 0 ? field.value : "Not configured"}
              </dd>
            </div>
          ))}
        </dl>

        {envNames && envNames.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-xs text-muted">
            <Key size={14} weight="bold" aria-hidden="true" className="text-brand" />
            <span>Secrets: Configured in environment</span>
            <span className="font-mono text-[11px] text-fg">({envNames.join(", ")})</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 p-3 text-xs text-fg"
          >
            <WarningCircle
              size={15}
              weight="fill"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-danger"
            />
            <div className="space-y-0.5">
              <p>
                <span className="font-semibold">Error:</span> {errorMessage}
              </p>
              {requestId ? <p className="font-mono text-muted">Request ID: {requestId}</p> : null}
            </div>
          </div>
        ) : null}
      </CardBody>

      <CardFooter>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
          <PlugsConnected size={13} weight="bold" aria-hidden="true" />
          {lastCheckedAt ? `Checked ${formatDateTime(lastCheckedAt)}` : "Never tested"}
        </span>
        {actions && actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant ?? "secondary"}
                size="sm"
                pending={action.pending}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}
