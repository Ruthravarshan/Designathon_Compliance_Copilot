"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { ThemeMode } from "@/components/theme/theme";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/overlays";
import { RoleBadge } from "@/components/ui/status-badge";
import { buildNavGroups, type NavGroupSpec } from "./nav-config";
import { NotificationBell, type NotificationItem } from "./notification-bell";
import { UserMenu } from "./user-menu";

export interface ShellWorkspaceOption {
  id: string;
  name: string;
  slug: string;
}

export interface ShellActorProps {
  name: string;
  email: string | null;
  avatarUrl?: string | null;
  role: string;
  departmentName?: string | null;
  isDemo: boolean;
  isGuest: boolean;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  appName: string;
  logoUrl?: string | null;
  supportEmail?: string | null;
  permissions: readonly string[];
  workspaces?: readonly ShellWorkspaceOption[];
}

export function WorkspaceLabel({
  workspaceName,
  workspaceSlug,
  workspaceId,
  workspaces,
  onSwitchWorkspace,
}: {
  workspaceName: string;
  workspaceSlug: string;
  workspaceId: string;
  workspaces?: readonly ShellWorkspaceOption[];
  onSwitchWorkspace?: (workspaceId: string) => void;
}) {
  if (workspaces && workspaces.length > 1 && onSwitchWorkspace) {
    return (
      <div className="min-w-0">
        <label htmlFor="workspace-switcher" className="sr-only">
          Active workspace
        </label>
        <Select
          id="workspace-switcher"
          value={workspaceId}
          onChange={(event) => onSwitchWorkspace(event.target.value)}
          className="min-h-9 py-1 text-sm font-semibold"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name} ({ws.slug})
            </option>
          ))}
        </Select>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-fg">{workspaceName}</p>
      <p className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        {workspaceSlug}
      </p>
    </div>
  );
}

function NavGroupList({
  groups,
  pathname,
  onNavigate,
}: {
  groups: readonly NavGroupSpec[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Workspace navigation" className="space-y-5">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            {group.label}
          </p>
          <ul className="mt-1.5 space-y-1">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150",
                      active
                        ? "bg-brand text-brand-ink"
                        : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarIdentityFooter({
  actor,
  onNavigate,
}: {
  actor: ShellActorProps;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex items-center gap-3">
        <Avatar name={actor.name} avatarUrl={actor.avatarUrl} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{actor.name}</p>
          <div className="mt-1">
            <RoleBadge role={actor.role} isGuest={actor.isGuest} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          href="/app/settings"
          onClick={onNavigate}
          className="font-medium text-muted hover:text-fg hover:underline"
        >
          Personal settings
        </Link>
        {actor.isGuest && actor.supportEmail ? (
          <a
            href={`mailto:${actor.supportEmail}?subject=${encodeURIComponent("PolicyPulse access request")}`}
            className="font-medium text-brand hover:underline"
          >
            Request access
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function AppShell({
  actor,
  initialTheme = "light",
  unreadNotifications = 0,
  notifications = [],
  onMarkAllNotificationsRead,
  onSwitchWorkspace,
  onSignOut,
  children,
}: {
  actor: ShellActorProps;
  initialTheme?: ThemeMode;
  unreadNotifications?: number;
  notifications?: readonly NotificationItem[];
  onMarkAllNotificationsRead?: () => void | Promise<void>;
  onSwitchWorkspace?: (workspaceId: string) => void;
  onSignOut: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navGroups = buildNavGroups(new Set(actor.permissions));

  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <header className="sticky top-0 z-40 h-16 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <IconButton
              label="Open navigation menu"
              variant="ghost"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <List size={20} weight="bold" aria-hidden="true" />
            </IconButton>

            <Link href="/app" className="shrink-0">
              <BrandLockup appName={actor.appName} logoUrl={actor.logoUrl} />
            </Link>

            <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />

            <div className="hidden min-w-0 sm:block">
              <WorkspaceLabel
                workspaceName={actor.workspaceName}
                workspaceSlug={actor.workspaceSlug}
                workspaceId={actor.workspaceId}
                workspaces={actor.workspaces}
                onSwitchWorkspace={onSwitchWorkspace}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {actor.isDemo ? (
              <Badge tone="brand" dot>
                Demo
              </Badge>
            ) : null}
            {actor.isGuest ? (
              <Badge tone="outline" className="hidden sm:inline-flex">
                Guest · sample access
              </Badge>
            ) : null}
            <NotificationBell
              unreadCount={unreadNotifications}
              items={notifications}
              onMarkAllRead={onMarkAllNotificationsRead}
            />
            <ThemeToggle initialMode={initialTheme} />
            <UserMenu
              name={actor.name}
              email={actor.email}
              avatarUrl={actor.avatarUrl}
              role={actor.role}
              departmentName={actor.departmentName}
              onSignOut={onSignOut}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] gap-8 px-4 py-6 sm:px-6 lg:py-8">
        <aside className="hidden w-[232px] shrink-0 flex-col justify-between gap-6 lg:flex">
          <NavGroupList groups={navGroups} pathname={pathname} />
          <SidebarIdentityFooter actor={actor} />
        </aside>

        <main id="main" className="min-w-0 flex-1 pb-16">
          {children}
        </main>
      </div>

      <Sheet
        open={mobileOpen}
        side="left"
        title={actor.workspaceName}
        onClose={() => setMobileOpen(false)}
      >
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="space-y-5">
            <WorkspaceLabel
              workspaceName={actor.workspaceName}
              workspaceSlug={actor.workspaceSlug}
              workspaceId={actor.workspaceId}
              workspaces={actor.workspaces}
              onSwitchWorkspace={onSwitchWorkspace}
            />
            <NavGroupList
              groups={navGroups}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
          <SidebarIdentityFooter actor={actor} onNavigate={() => setMobileOpen(false)} />
        </div>
      </Sheet>
    </div>
  );
}
