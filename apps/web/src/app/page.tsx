import { cookies } from "next/headers";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  LockKey,
  Scales,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { parseThemeCookie, THEME_COOKIE_NAME } from "@/components/theme/theme";
import { LinkButton } from "@/components/ui/button";
import { env } from "@/lib/env";

const PILLARS = [
  {
    index: "01",
    title: "Clause-grounded",
    body: "Every extracted obligation carries a verified verbatim quote back to its regulatory section.",
  },
  {
    index: "02",
    title: "Tenant-isolated",
    body: "Server-enforced workspace boundaries and role-based permissions protect every record.",
  },
  {
    index: "03",
    title: "Human-gated",
    body: "Drafted policy redlines require explicit officer sign-off before any remediation email queues.",
  },
] as const;

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Ingest",
    body: "Upload regulatory PDFs or monitor allowlisted circular feeds with SHA-256 deduplication.",
  },
  {
    step: "02",
    title: "Extract",
    body: "Structure clauses into atomic obligations with SLA deadlines, applicability, and source quotes.",
  },
  {
    step: "03",
    title: "Assess",
    body: "Map obligations against your internal policy register and surface severity-ranked gaps.",
  },
  {
    step: "04",
    title: "Sign off",
    body: "Approve, edit, or reject drafted redlines. Every decision writes an immutable audit row.",
  },
] as const;

const ENTERPRISE_CONTROLS = [
  {
    title: "OAuth 2.0 & SAML SSO",
    detail: "Google Workspace, Microsoft Entra ID, and domain-bound SAML identity support.",
    icon: ShieldCheck,
  },
  {
    title: "Server-side RBAC",
    detail: "Granular permissions across Owners, Admins, Analysts, and Read-Only Auditors.",
    icon: LockKey,
  },
  {
    title: "Deterministic scoring",
    detail:
      "Published confidence formula combining citation verification, mapping, and rule certainty.",
    icon: Scales,
  },
  {
    title: "Append-only audit spine",
    detail:
      "Every review decision, policy check, and data scan leaves an attributable event record.",
    icon: CheckCircle,
  },
] as const;

export default async function LandingPage() {
  const cookieStore = await cookies();
  const initialTheme = parseThemeCookie(cookieStore.get(THEME_COOKIE_NAME)?.value, "light");
  const quickAccessEnabled = env.DEMO_MODE_ENABLED;

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-canvas text-fg">
      <div aria-hidden="true" className="pp-backdrop-grid" />

      <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1160px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="shrink-0">
            <BrandLockup appName="PolicyPulse" />
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-8 text-sm font-medium text-muted md:flex"
          >
            <a href="#capabilities" className="transition-colors hover:text-fg">
              Capabilities
            </a>
            <a href="#workflow" className="transition-colors hover:text-fg">
              Workflow
            </a>
            <a href="#security" className="transition-colors hover:text-fg">
              Security
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <ThemeToggle initialMode={initialTheme} />
            <LinkButton
              href="/signin"
              variant="secondary"
              className="hidden h-10 px-4 sm:inline-flex"
            >
              Sign in
            </LinkButton>
            <LinkButton href="/signin" className="h-10 px-4">
              Open workbench
              <ArrowRight size={15} weight="bold" aria-hidden="true" />
            </LinkButton>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto w-full max-w-[1160px] px-5 pb-20 pt-16 sm:px-8 md:pb-24 md:pt-24">
          <div className="max-w-[780px] rise">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-brand dark:bg-support" />
              <span>Enterprise Regulatory Intelligence</span>
            </div>

            <h1 className="mt-6 max-w-[15ch] text-[clamp(2.85rem,6.2vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-fg">
              Regulatory change,{" "}
              <span className="text-brand dark:text-support">with receipts.</span>
            </h1>

            <p className="mt-6 max-w-[54ch] text-base leading-relaxed text-muted sm:text-lg">
              Ingest circulars across RBI, SEBI, IRDAI, and DPDP. Map cited obligations to your
              internal policy register and route redlines for human sign-off.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <LinkButton href="/signin" size="lg">
                Open workbench
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </LinkButton>
              <LinkButton href="/signin?provider=google" variant="secondary" size="lg">
                Enterprise SSO
              </LinkButton>
            </div>

            {quickAccessEnabled ? (
              <div className="mt-5">
                <Link
                  href="/signin#quick-access"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted underline decoration-line underline-offset-4 transition-colors hover:text-fg"
                >
                  Quick role sign-in for evaluation
                  <ArrowRight size={12} weight="bold" aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </div>

          {/* Minimalist 3-column architectural ledger */}
          <div
            id="capabilities"
            className="rise rise-2 mt-16 grid overflow-hidden rounded-2xl border border-line bg-surface divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0"
          >
            {PILLARS.map((pillar) => (
              <div key={pillar.index} className="p-6 sm:p-7">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand dark:text-support">
                  {pillar.index}
                </p>
                <h2 className="mt-3 text-base font-semibold tracking-[-0.015em] text-fg">
                  {pillar.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{pillar.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="scroll-mt-20 border-t border-line bg-surface/50">
          <div className="mx-auto w-full max-w-[1160px] px-5 py-20 sm:px-8 md:py-24">
            <div className="max-w-[52ch]">
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
                Four stages from circular to audit record.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                Every workspace action stays inside your authenticated tenant boundary. System
                architecture and live posture live inside the workbench.
              </p>
            </div>

            <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((item) => (
                <li key={item.step} className="flex flex-col bg-surface p-6">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-brand dark:text-support">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-[-0.015em] text-fg">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Enterprise Security */}
        <section id="security" className="scroll-mt-20 border-t border-line bg-canvas">
          <div className="mx-auto grid w-full max-w-[1160px] gap-12 px-5 py-20 sm:px-8 md:py-24 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="max-w-[46ch]">
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
                Built for regulated operations.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                Compliance teams need verifiable provenance, not black-box summaries. PolicyPulse
                separates public access from workspace telemetry and enforces human approval on
                every redline.
              </p>
              <div className="mt-7">
                <LinkButton href="/signin" variant="secondary">
                  Sign in to inspect workspace
                  <ArrowRight size={15} weight="bold" aria-hidden="true" />
                </LinkButton>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {ENTERPRISE_CONTROLS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand/40 dark:hover:border-support/40"
                  >
                    <Icon
                      size={18}
                      weight="bold"
                      aria-hidden="true"
                      className="text-brand dark:text-support"
                    />
                    <h3 className="mt-3.5 text-sm font-semibold text-fg">{item.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto flex w-full max-w-[1160px] flex-col justify-between gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.025em] text-fg">
                Ready for review.
              </h2>
              <p className="mt-1 text-sm text-muted">
                Authenticate with SSO or select an evaluation role to enter the workbench.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LinkButton href="/signin" size="lg">
                Sign in
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </LinkButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-canvas">
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-3 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <BrandLockup appName="PolicyPulse" compact />
          <p>Enterprise regulatory compliance · Human sign-off required</p>
        </div>
      </footer>
    </div>
  );
}
