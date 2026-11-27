"use client";

import { useState } from "react";
import { ArrowCounterClockwise, FloppyDisk, LockSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { humanize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/overlays";
import { ErrorState } from "@/components/ui/states";

export type CapabilityGroup = "Read" | "Review" | "Manage" | "Admin";
export type ComplianceScopeOption = "none" | "team" | "all";

export interface RoleMatrixCapability {
  key: string;
  label: string;
  group: CapabilityGroup;
  ownerOnly?: boolean;
}

export interface RoleMatrixColumn {
  role: string;
  label: string;
  locked?: boolean;
}

export interface RoleMatrixState {
  permissions: Record<string, Record<string, boolean>>;
  scopes: Record<string, ComplianceScopeOption>;
}

const GROUPS: readonly CapabilityGroup[] = ["Read", "Review", "Manage", "Admin"];

export function RoleMatrix({
  roles,
  capabilities,
  initialState,
  defaultState,
  saving = false,
  resetting = false,
  error,
  requestId,
  onSave,
  onResetDefaults,
}: {
  roles: readonly RoleMatrixColumn[];
  capabilities: readonly RoleMatrixCapability[];
  initialState: RoleMatrixState;
  defaultState?: RoleMatrixState;
  saving?: boolean;
  resetting?: boolean;
  error?: string | null;
  requestId?: string | null;
  onSave: (state: RoleMatrixState) => void | Promise<void>;
  onResetDefaults?: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<RoleMatrixState>(initialState);
  const [dirty, setDirty] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const toggleCapability = (role: string, capability: string) => {
    setDraft((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [role]: {
          ...prev.permissions[role],
          [capability]: !(prev.permissions[role]?.[capability] ?? false),
        },
      },
    }));
    setDirty(true);
  };

  const updateScope = (role: string, scope: ComplianceScopeOption) => {
    setDraft((prev) => ({
      ...prev,
      scopes: {
        ...prev.scopes,
        [role]: scope,
      },
    }));
    setDirty(true);
  };

  const handleDiscard = () => {
    setDraft(initialState);
    setDirty(false);
  };

  return (
    <div className="space-y-4">
      {error ? (
        <ErrorState title="Could not save role matrix." message={error} requestId={requestId} />
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="text-base font-semibold text-fg">Role capability matrix</h2>
            <p className="mt-0.5 text-xs text-muted">
              Changes take effect on the next request and write an audit entry. Owner always retains
              full access.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onResetDefaults ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={saving || resetting}
                onClick={() => setConfirmResetOpen(true)}
              >
                <ArrowCounterClockwise size={14} weight="bold" aria-hidden="true" />
                Reset to defaults
              </Button>
            ) : null}
            {dirty ? (
              <Button variant="ghost" size="sm" disabled={saving} onClick={handleDiscard}>
                Discard
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={!dirty || resetting}
              pending={saving}
              pendingLabel="Saving..."
              onClick={() => void onSave(draft)}
            >
              <FloppyDisk size={14} weight="bold" aria-hidden="true" />
              Save changes
            </Button>
          </div>
        </CardHeader>

        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <caption className="sr-only">Role capability and compliance scope matrix</caption>
              <thead className="sticky top-0 z-20 border-b border-line bg-surface-2">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-30 min-w-[220px] border-r border-line bg-surface-2 px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted"
                  >
                    Capability
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.role}
                      scope="col"
                      className="min-w-[128px] px-3 py-3 text-center font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted"
                    >
                      <span className="inline-flex items-center gap-1">
                        {role.locked ? (
                          <LockSimple
                            size={12}
                            weight="bold"
                            aria-hidden="true"
                            className="text-brand"
                          />
                        ) : null}
                        <span>{role.label}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {/* Compliance scope row */}
                <tr className="bg-surface">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-r border-line bg-surface px-4 py-3 font-medium text-fg"
                  >
                    <span>Compliance scope</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted">
                      Department visibility ceiling
                    </span>
                  </th>
                  {roles.map((role) => {
                    const currentScope = draft.scopes[role.role] ?? "none";
                    const defaultScope = defaultState?.scopes[role.role];
                    return (
                      <td key={role.role} className="px-3 py-2.5 text-center">
                        <Select
                          aria-label={`${role.label} compliance scope`}
                          value={currentScope}
                          disabled={role.locked || saving}
                          onChange={(event) =>
                            updateScope(role.role, event.target.value as ComplianceScopeOption)
                          }
                          className="min-h-9 py-1 text-xs"
                        >
                          <option value="none">None</option>
                          <option value="team">Team</option>
                          <option value="all">All</option>
                        </Select>
                        {defaultScope ? (
                          <span className="mt-1 block font-mono text-[10px] text-muted">
                            Default: {humanize(defaultScope)}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>

                {GROUPS.map((group) => {
                  const groupCaps = capabilities.filter((cap) => cap.group === group);
                  if (groupCaps.length === 0) {
                    return null;
                  }
                  return (
                    <FragmentGroup
                      key={group}
                      group={group}
                      capabilities={groupCaps}
                      roles={roles}
                      draft={draft}
                      defaultState={defaultState}
                      saving={saving}
                      onToggle={toggleCapability}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {onResetDefaults ? (
        <ConfirmDialog
          open={confirmResetOpen}
          title="Reset role matrix to workspace defaults?"
          description="All custom role capability changes will revert to the seeded default matrix. Per-user overrides remain unchanged."
          confirmLabel="Reset to defaults"
          variant="danger"
          pending={resetting}
          onConfirm={() => {
            void Promise.resolve(onResetDefaults()).then(() => setConfirmResetOpen(false));
          }}
          onClose={() => setConfirmResetOpen(false)}
        />
      ) : null}
    </div>
  );
}

function FragmentGroup({
  group,
  capabilities,
  roles,
  draft,
  defaultState,
  saving,
  onToggle,
}: {
  group: CapabilityGroup;
  capabilities: readonly RoleMatrixCapability[];
  roles: readonly RoleMatrixColumn[];
  draft: RoleMatrixState;
  defaultState?: RoleMatrixState;
  saving: boolean;
  onToggle: (role: string, capability: string) => void;
}) {
  return (
    <>
      <tr className="bg-surface-2/70">
        <th
          colSpan={roles.length + 1}
          scope="colgroup"
          className="px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
        >
          {group}
        </th>
      </tr>
      {capabilities.map((cap) => (
        <tr key={cap.key} className="h-11 hover:bg-surface-2/40">
          <th
            scope="row"
            className="sticky left-0 z-10 border-r border-line bg-surface px-4 py-2.5 text-left font-normal text-fg"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{cap.label}</span>
              {cap.ownerOnly ? (
                <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  Owner only
                </span>
              ) : null}
            </div>
            <span className="block font-mono text-[11px] text-muted">{cap.key}</span>
          </th>
          {roles.map((role) => {
            const checked = Boolean(draft.permissions[role.role]?.[cap.key]);
            const defaultChecked = defaultState?.permissions[role.role]?.[cap.key];
            const disabled = Boolean(
              role.locked || (cap.ownerOnly && role.role !== "OWNER") || saving,
            );
            const differsFromDefault =
              typeof defaultChecked === "boolean" && defaultChecked !== checked;

            return (
              <td key={role.role} className="px-3 py-2 text-center align-middle">
                <label className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    aria-label={`${cap.label} for ${role.label}`}
                    onChange={() => onToggle(role.role, cap.key)}
                    className={cn(
                      "size-4 rounded border-line accent-brand",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  />
                </label>
                {differsFromDefault ? (
                  <span
                    title={`Default: ${defaultChecked ? "Allowed" : "Denied"}`}
                    className="block font-mono text-[10px] text-brand"
                  >
                    Modified
                  </span>
                ) : null}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
