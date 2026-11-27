"use client";

import { useMemo, useState } from "react";
import { LockSimple } from "@phosphor-icons/react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SearchField } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/navigation-controls";

export type OverrideEffect = "INHERIT" | "GRANT" | "DENY";

export interface OverrideCapabilityItem {
  key: string;
  label: string;
  group: string;
  ownerOnly?: boolean;
  roleDefaultAllowed: boolean;
}

export function PermissionOverrideGrid({
  memberRole,
  capabilities,
  overrides,
  saving = false,
  onChange,
}: {
  memberRole: string;
  capabilities: readonly OverrideCapabilityItem[];
  overrides: Record<string, OverrideEffect>;
  saving?: boolean;
  onChange: (capability: string, effect: OverrideEffect) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return capabilities;
    }
    return capabilities.filter(
      (cap) =>
        cap.label.toLowerCase().includes(q) ||
        cap.key.toLowerCase().includes(q) ||
        cap.group.toLowerCase().includes(q),
    );
  }, [capabilities, query]);

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-base font-semibold text-fg">Per-user permission overrides</h2>
          <p className="mt-0.5 text-xs text-muted">
            Explicit Deny overrides Grant; Grant overrides the {memberRole} role default. Owner-only
            capabilities cannot be granted to non-owners.
          </p>
        </div>
        <SearchField
          id="override-search"
          label="Filter capabilities"
          value={query}
          onChange={setQuery}
          placeholder="Filter capabilities..."
          className="w-full sm:w-64"
        />
      </CardHeader>

      <CardBody className="divide-y divide-line p-0">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">No capabilities match your search.</p>
        ) : (
          filtered.map((cap) => {
            const current = overrides[cap.key] ?? "INHERIT";
            const ownerLocked = Boolean(cap.ownerOnly && memberRole !== "OWNER");

            return (
              <div
                key={cap.key}
                className="flex flex-col justify-between gap-3 px-5 py-3.5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-fg">{cap.label}</span>
                    <span className="font-mono text-[11px] text-muted">{cap.key}</span>
                    {ownerLocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                        <LockSimple size={11} weight="bold" aria-hidden="true" />
                        Owner only
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    Role default: {cap.roleDefaultAllowed ? "Allowed" : "Not allowed"}
                  </p>
                </div>

                <SegmentedControl
                  label={`Override for ${cap.label}`}
                  value={current}
                  onChange={(next) => onChange(cap.key, next)}
                  options={[
                    { value: "INHERIT", label: "Inherit", disabled: saving },
                    {
                      value: "GRANT",
                      label: "Allow",
                      disabled: saving || ownerLocked,
                      title: ownerLocked
                        ? "Owner-only capability cannot be granted"
                        : "Grant capability",
                    },
                    { value: "DENY", label: "Deny", disabled: saving },
                  ]}
                />
              </div>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
