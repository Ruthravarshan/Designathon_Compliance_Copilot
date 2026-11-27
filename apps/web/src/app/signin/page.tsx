import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle, LockKey, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { EnterpriseSignIn } from "@/components/auth/enterprise-signin";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { parseThemeCookie, THEME_COOKIE_NAME } from "@/components/theme/theme";
import { env } from "@/lib/env";
import { getActor } from "@/server/auth/actor";
import { DEMO_PERSONAS } from "@/server/compliance/corpus";

export const metadata: Metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const actor = await getActor();
  if (actor) {
    redirect("/app");
  }

  const cookieStore = await cookies();
  const initialTheme = parseThemeCookie(cookieStore.get(THEME_COOKIE_NAME)?.value, "light");
  const params = await searchParams;

  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-canvas text-fg lg:grid lg:grid-cols-[46%_54%]">
      <div aria-hidden="true" className="pp-backdrop-grid" />

      {/* Brand & Architecture Pane */}
      <section className="flex flex-col justify-between border-b border-line bg-surface px-6 py-6 sm:px-10 lg:border-b-0 lg:border-r lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <BrandLockup appName="PolicyPulse" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle initialMode={initialTheme} />
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-canvas px-3.5 text-xs font-medium text-muted transition-colors hover:border-muted/60 hover:text-fg"
            >
              <ArrowLeft size={13} weight="bold" aria-hidden="true" />
              Home
            </Link>
          </div>
        </div>

        <div className="my-10 space-y-6 lg:my-0">
          <div className="max-w-[40ch] space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand dark:text-accent">
              Enterprise Compliance Workbench
            </p>
            <h2 className="text-[28px] leading-[34px] font-semibold tracking-[-0.025em] text-fg sm:text-[34px] sm:leading-[40px]">
              Regulatory change, reviewed and on record.
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              Every circular citation, policy redline, and officer sign-off is isolated to your
              signed-in workspace and recorded on an immutable audit spine.
            </p>
          </div>

          {/* Crisp Architectural Security SVG */}
          <div className="rounded-2xl border border-line bg-canvas/80 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              <span>Session &amp; Tenant Boundary</span>
              <span className="text-brand dark:text-accent">Verified</span>
            </div>
            <svg
              viewBox="0 0 400 72"
              className="mt-3 h-auto w-full"
              role="img"
              aria-label="Session verification flow from SSO identity to server-scoped tenant workspace"
            >
              <path d="M 88 36 H 164" className="stroke-line" strokeWidth="1.5" fill="none" />
              <path
                d="M 88 36 H 164"
                className="pp-signal-line stroke-brand dark:stroke-accent"
                strokeWidth="1.5"
                fill="none"
              />
              <path d="M 236 36 H 312" className="stroke-line" strokeWidth="1.5" fill="none" />
              <path
                d="M 236 36 H 312"
                className="pp-signal-line stroke-brand dark:stroke-accent"
                strokeWidth="1.5"
                fill="none"
              />

              <rect
                x="8"
                y="14"
                width="80"
                height="44"
                rx="12"
                className="fill-surface stroke-line"
                strokeWidth="1.5"
              />
              <text x="48" y="34" textAnchor="middle" className="fill-fg text-[11px] font-semibold">
                Identity
              </text>
              <text x="48" y="48" textAnchor="middle" className="fill-muted font-mono text-[9px]">
                SSO / Demo
              </text>

              <rect
                x="164"
                y="14"
                width="72"
                height="44"
                rx="12"
                className="fill-brand stroke-brand"
                strokeWidth="1.5"
              />
              <text
                x="200"
                y="34"
                textAnchor="middle"
                className="fill-brand-ink text-[11px] font-semibold"
              >
                RBAC
              </text>
              <text
                x="200"
                y="48"
                textAnchor="middle"
                className="fill-brand-ink/80 font-mono text-[9px]"
              >
                Server check
              </text>

              <rect
                x="312"
                y="14"
                width="80"
                height="44"
                rx="12"
                className="fill-surface stroke-line"
                strokeWidth="1.5"
              />
              <text
                x="352"
                y="34"
                textAnchor="middle"
                className="fill-fg text-[11px] font-semibold"
              >
                Tenant
              </text>
              <text x="352" y="48" textAnchor="middle" className="fill-muted font-mono text-[9px]">
                Workspace ID
              </text>
            </svg>

            <ul className="mt-3 grid gap-2 border-t border-line pt-3 text-xs text-muted sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <CheckCircle
                  size={14}
                  weight="bold"
                  aria-hidden="true"
                  className="shrink-0 text-brand dark:text-accent"
                />
                <span>HMAC-signed httpOnly cookie</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck
                  size={14}
                  weight="bold"
                  aria-hidden="true"
                  className="shrink-0 text-brand dark:text-accent"
                />
                <span>Zero client-trusted roles</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="hidden items-center justify-between gap-2 text-xs text-muted lg:flex">
          <span className="inline-flex items-center gap-1.5">
            <LockKey size={13} aria-hidden="true" />
            Access is controlled by your workspace owner.
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
            PolicyPulse · Hexaware
          </span>
        </div>
      </section>

      {/* Sign-In Form Pane */}
      <main id="main" className="flex items-center justify-center px-6 py-10 sm:px-10">
        <EnterpriseSignIn
          personas={DEMO_PERSONAS}
          demoEnabled={env.DEMO_MODE_ENABLED}
          googleConfigured={googleConfigured}
          supabaseConfigured={supabaseConfigured}
          initialProvider={params.provider}
        />
      </main>
    </div>
  );
}
