"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChatsCircle,
  ClockCounterClockwise,
  Database,
  EnvelopeSimple,
  FileText,
  List,
  Crosshair,
  Scroll,
  SealCheck,
  ShieldWarning,
  SquaresFour,
} from "@phosphor-icons/react";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { ThemeMode } from "@/components/theme/theme";
import { UserMenu } from "@/components/shell/user-menu";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";

export type WorkbenchIconKey =
  | "overview"
  | "circulars"
  | "findings"
  | "assistant"
  | "data"
  | "audit"
  | "email"
  | "watch"
  | "policy";

export interface WorkbenchNavItem {
  href: string;
  label: string;
  group: "Workbench" | "Governance";
  icon: WorkbenchIconKey;
  exact?: boolean;
}

const ICONS: Record<WorkbenchIconKey, typeof SquaresFour> = {
  overview: SquaresFour,
  circulars: FileText,
  findings: ShieldWarning,
  assistant: ChatsCircle,
  data: Database,
  audit: ClockCounterClockwise,
  email: EnvelopeSimple,
  watch: Crosshair,
  policy: Scroll,
};

export interface WorkbenchActor {
  name: string;
  email: string;
  role: string;
  workspaceName: string;
  workspaceSlug: string;
  isDemo: boolean;
}

function SidebarNav({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly WorkbenchNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const groups = (["Workbench", "Governance"] as const)
    .map((group) => ({
      group,
      items: items.filter((item) => item.group === group),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <nav aria-label="Workspace navigation" className="space-y-6">
      {groups.map((section) => (
        <div key={section.group}>
          <p className="px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {section.group}
          </p>
          <ul className="mt-2 space-y-1">
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150",
                      active
                        ? "bg-brand text-brand-ink"
                        : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon
                      size={16}
                      weight={active ? "fill" : "bold"}
                      aria-hidden="true"
                      className={active ? "text-brand-ink" : "text-muted"}
                    />
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

export function WorkbenchShell({
  actor,
  navItems,
  initialTheme,
  children,
}: {
  actor: WorkbenchActor;
  navItems: readonly WorkbenchNavItem[];
  initialTheme: ThemeMode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      router.push("/signin");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <header className="sticky top-0 z-40 h-16 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <IconButton
              label="Open navigation menu"
              variant="ghost"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <List size={20} weight="bold" aria-hidden="true" />
            </IconButton>

            <Link href="/app" className="shrink-0">
              <BrandLockup appName="PolicyPulse" />
            </Link>

            <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />

            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <span className="truncate rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-fg">
                {actor.workspaceName}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {actor.isDemo ? (
              <Badge tone="brand" dot className="hidden sm:inline-flex">
                Demo
              </Badge>
            ) : null}
            <ThemeToggle initialMode={initialTheme} />
            <UserMenu
              name={actor.name}
              email={actor.email}
              role={actor.role}
              signingOut={signingOut}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] gap-8 px-4 py-6 sm:px-6 lg:py-8">
        <aside className="hidden w-[228px] shrink-0 flex-col justify-between gap-6 lg:flex">
          <SidebarNav items={navItems} pathname={pathname} />

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <SealCheck
                size={15}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-accent"
              />
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Review gate
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Approvals record an immutable decision and queue an email. Policies never
              self-publish.
            </p>
          </div>
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
          <SidebarNav
            items={navItems}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
          <div className="rounded-2xl border border-line bg-surface-2/60 p-4 text-xs leading-relaxed text-muted">
            Approvals record an immutable decision and queue an owner email. Policies never
            self-publish.
          </div>
        </div>
      </Sheet>
    </div>
  );
}
