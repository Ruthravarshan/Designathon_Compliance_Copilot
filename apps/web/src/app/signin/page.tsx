import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle, LockKey } from "@phosphor-icons/react/dist/ssr";
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

const SECURITY_POINTS = [
  "HMAC-signed httpOnly session cookies with same-origin enforcement",
  "Server-side RBAC checked on every workspace read and mutation",
  "Strict multi-tenant isolation across circulars, policies, and audit logs",
] as const;

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
    <div className="relative min-h-dvh overflow-x-clip bg-canvas text-fg lg:grid lg:grid-cols-[42%_58%]">
      <div aria-hidden="true" className="pp-backdrop-grid" />

      {/* Minimal Enterprise Brand Pane */}
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

        <div className="my-10 max-w-[40ch] space-y-6 lg:my-0">
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand dark:text-support">
              Enterprise Compliance Workbench
            </p>
            <h2 className="text-[28px] leading-[34px] font-semibold tracking-[-0.03em] text-fg sm:text-[34px] sm:leading-[40px]">
              Regulatory change, reviewed and on record.
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              Sign in to access ingested circulars, policy compliance checks, gap redlines,
              architecture controls, and the workspace audit trail.
            </p>
          </div>

          <ul className="space-y-2.5 border-t border-line pt-5 text-xs text-muted">
            {SECURITY_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <CheckCircle
                  size={15}
                  weight="bold"
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-brand dark:text-support"
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
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
