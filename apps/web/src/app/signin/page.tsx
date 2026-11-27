import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LockKey, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { HexMark } from "@/components/brand/hex-mark";
import { PersonaPicker } from "@/components/persona-picker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { env } from "@/lib/env";
import { getActor } from "@/server/auth/actor";
import { DEMO_PERSONAS } from "@/server/compliance/corpus";

export const metadata: Metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const actor = await getActor();
  if (actor) {
    redirect("/app");
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div aria-hidden="true" className="grid-field" />

      <header className="border-b border-line/70">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <HexMark className="size-7 text-brand" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              Hexa / Compliance Copilot
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
          >
            <ArrowLeft size={13} weight="bold" aria-hidden="true" />
            Back to product
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1100px] px-5 py-12 sm:px-8 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="rise">
            <Badge tone="brand" dot>
              Demo authentication
            </Badge>
            <h1 className="mt-6 text-[clamp(2.4rem,4.6vw,3.8rem)] font-medium leading-[0.98] tracking-[-0.04em]">
              Sign in as a <span className="italic text-brand">seeded persona.</span>
            </h1>
            <p className="mt-5 max-w-[44ch] text-muted">
              There are no passwords in the demo. Pick a role to inspect the workbench. Sessions are
              HMAC-signed and every read is scoped to the persona&apos;s workspace.
            </p>

            <Card className="mt-8 p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <ShieldCheck size={18} weight="bold" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium">Role permissions are enforced server-side</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Owners and admins review findings. Members ask policy questions. The board
                    auditor is read-only. The Northwind persona lives in a second tenant to prove
                    isolation.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                <LockKey size={13} aria-hidden="true" />
                Cookie · httpOnly · sameSite=lax · 8h
              </div>
            </Card>

            <p className="mt-5 text-xs leading-relaxed text-muted">
              No production credentials are used. Seeded emails are reserved demo addresses and are
              never delivered outside the local SMTP mailbox.
            </p>
          </div>

          <div className="rise rise-2">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium tracking-[-0.01em]">Choose a persona</h2>
                <p className="mt-1 text-xs text-muted">
                  {DEMO_PERSONAS.length} seeded identities · 2 workspaces
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Demo mode
              </span>
            </div>

            {env.DEMO_MODE_ENABLED ? (
              <PersonaPicker personas={DEMO_PERSONAS} />
            ) : (
              <Card className="p-6">
                <p className="text-sm font-medium">Demo sign-in is disabled.</p>
                <p className="mt-2 text-sm text-muted">
                  Set <span className="font-mono text-xs">DEMO_MODE=true</span> in{" "}
                  <span className="font-mono text-xs">apps/web/.env</span> to enable seeded
                  personas. Production sign-in is out of scope for this build.
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-2 px-5 py-6 text-xs text-muted sm:flex-row sm:justify-between sm:px-8">
          <p className="font-mono uppercase tracking-[0.16em]">Hexa Compliance Copilot</p>
          <p>Demo data only · no autonomous publishing</p>
        </div>
      </footer>
    </div>
  );
}
