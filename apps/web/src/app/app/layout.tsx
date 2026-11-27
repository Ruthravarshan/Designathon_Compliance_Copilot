import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Fingerprint, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { AppNav, type NavItem } from "@/components/app-nav";
import { HexMark } from "@/components/brand/hex-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { actorCan, getActor } from "@/server/auth/actor";

export const dynamic = "force-dynamic";

const roleCopy: Record<string, string> = {
  OWNER: "Full workspace control, including approval and audit.",
  ADMIN: "Ingest circulars, review findings, and run data scans.",
  MEMBER: "Read the register, review context, and ask grounded questions.",
  VIEWER: "Read-only oversight. No writes, reviews, or uploads.",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }

  const navItems: NavItem[] = [
    { href: "/app", label: "Overview", index: "00", exact: true },
    ...(actorCan(actor, "document:read")
      ? [{ href: "/app/circulars", label: "Circulars", index: "01" }]
      : []),
    ...(actorCan(actor, "finding:read")
      ? [{ href: "/app/findings", label: "Findings", index: "02" }]
      : []),
    ...(actorCan(actor, "assistant:ask")
      ? [{ href: "/app/assistant", label: "Policy Q&A", index: "03" }]
      : []),
    ...(actorCan(actor, "document:read")
      ? [{ href: "/app/data", label: "Data discovery", index: "04" }]
      : []),
    ...(actorCan(actor, "audit:read")
      ? [{ href: "/app/audit", label: "Audit trail", index: "05" }]
      : []),
  ];

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden="true" className="grid-field" />

      <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/app" className="flex shrink-0 items-center gap-2.5">
              <HexMark className="size-7 text-brand" />
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-muted sm:block">
                Hexa / Compliance Copilot
              </span>
            </Link>
            <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{actor.workspaceName}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {actor.workspaceSlug}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Badge tone="outline" className="hidden sm:inline-flex">
              {actor.role}
            </Badge>
            <span className="hidden text-right lg:block">
              <span className="block text-sm font-medium">{actor.name}</span>
              <span className="block text-[11px] text-muted">{roleCopy[actor.role]}</span>
            </span>
            <SignOutButton />
          </div>
        </div>
        <div className="border-t border-line/60 px-4 py-1.5 sm:px-6 lg:hidden">
          <AppNav items={navItems} orientation="horizontal" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] gap-8 px-4 py-6 sm:px-6 lg:py-8">
        <aside className="hidden w-56 shrink-0 flex-col gap-5 lg:flex">
          <Card className="p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Signed in
            </p>
            <p className="mt-2 text-sm font-medium">{actor.name}</p>
            <p className="mt-0.5 text-xs text-muted">{actor.email}</p>
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Fingerprint size={13} weight="bold" aria-hidden="true" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {actor.role} · server scoped
              </span>
            </div>
          </Card>

          <AppNav items={navItems} />

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <SealCheck size={15} weight="bold" aria-hidden="true" className="text-brand" />
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Review gate
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Approving records a decision and queues an owner email. It never publishes a policy.
            </p>
          </Card>

          <div className="mt-auto space-y-2 text-xs text-muted">
            <Link href="/platform" className="inline-flex items-center gap-1 hover:text-fg">
              Build OS
              <ArrowUpRight size={12} weight="bold" aria-hidden="true" />
            </Link>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em]">
              Demo workspace · seeded data
            </p>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
