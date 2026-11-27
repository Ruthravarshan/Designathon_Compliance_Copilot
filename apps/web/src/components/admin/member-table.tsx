"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { formatDate } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { RoleBadge, StatusBadge } from "@/components/ui/status-badge";

export interface MemberRow {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl?: string | null;
  role: string;
  departmentName?: string | null;
  status: string;
  isGuest?: boolean;
  expiresAt?: string | null;
  lastSeenAt?: string | null;
}

export function MemberTable({ members }: { members: readonly MemberRow[] }) {
  const columns: readonly DataColumn<MemberRow>[] = [
    {
      key: "member",
      header: "Member",
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/app/admin/team/${row.userId}`}
                className="truncate font-semibold text-fg hover:text-brand hover:underline"
              >
                {row.name}
              </Link>
              {row.isGuest ? <Badge tone="outline">Guest</Badge> : null}
            </div>
            <p className="truncate font-mono text-xs text-muted">
              {row.email ?? "No email (guest session)"}
            </p>
          </div>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "role",
      header: "Role",
      render: (row) => <RoleBadge role={row.role} isGuest={row.isGuest} />,
    },
    {
      key: "department",
      header: "Department",
      render: (row) => (
        <span className="text-sm text-fg">{row.departmentName ?? "Unassigned"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "lastSeen",
      header: "Last seen",
      align: "right",
      render: (row) => (
        <span className="font-mono text-xs text-muted">
          {row.isGuest && row.expiresAt
            ? `Expires ${formatDate(row.expiresAt)}`
            : formatDate(row.lastSeenAt)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      caption="Workspace members and guests"
      rows={members}
      columns={columns}
      getRowKey={(row) => row.userId}
      renderMobileHeader={(row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-fg">{row.name}</span>
              {row.isGuest ? <Badge tone="outline">Guest</Badge> : null}
            </div>
            <p className="truncate font-mono text-xs text-muted">
              {row.email ?? "No email (guest session)"}
            </p>
          </div>
        </div>
      )}
      renderRowActions={(row) => (
        <Link
          href={`/app/admin/team/${row.userId}`}
          className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
        >
          <span>Manage</span>
          <ArrowRight size={13} weight="bold" aria-hidden="true" />
        </Link>
      )}
    />
  );
}
