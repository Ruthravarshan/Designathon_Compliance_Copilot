import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { AmbientBackdrop } from "@/components/landing/ambient-backdrop";
import { HeroReceiptSnapshot } from "@/components/landing/hero-receipt-snapshot";
import { HeroWorkbenchPreview } from "@/components/landing/hero-workbench-preview";
import {
  InteractiveWorkflow,
  SecurityArchitectureGrid,
} from "@/components/landing/interactive-workflow";
import { PlatformModules } from "@/components/landing/platform-modules";
import { Reveal, SpotlightCard } from "@/components/landing/reveal";
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

const REGULATORS = ["RBI", "SEBI", "IRDAI", "MeitY · DPDP", "CERT-In"] as const;

const NAV_LINKS = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#workbench", label: "Workbench" },
  { href: "#workflow", label: "Workflow" },
  { href: "#platform", label: "Platform" },
  { href: "#security", label: "Security" },
] as const;

export default async function LandingPage() {
  const cookieStore = await cookies();
  const initialTheme = parseThemeCookie(cookieStore.get(THEME_COOKIE_NAME)?.value, "light");
  const quickAccessEnabled = env.DEMO_MODE_ENABLED;

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-canvas text-fg">
      <AmbientBackdrop />

      <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-8">
          <Link href="/" className="min-w-0 shrink-0">
            <BrandLockup appName="PolicyPulse" />
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 text-sm font-medium text-muted lg:flex"
          >
            {NAV_LINKS.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-fg">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <ThemeToggle initialMode={initialTheme} />
            <LinkButton
              href="/signin"
              variant="secondary"
              className="h-10 px-3.5 text-xs sm:px-4 sm:text-sm active:scale-[0.98]"
            >
              Sign in
            </LinkButton>
          </div>
        </div>
      </header>

      <main id="main" className="relative z-10">
        {/* Hero: Focused value proposition + compact live citation receipt */}
        <section className="mx-auto w-full max-w-[1200px] px-4 pb-14 pt-10 sm:px-8 md:pb-20 md:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.06fr_0.94fr] lg:gap-12">
            <div className="rise min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                <span
                  className="relative flex size-2 shrink-0 items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="pp-pulse-ring absolute inline-flex size-2 rounded-full bg-brand dark:bg-support" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand dark:bg-support" />
                </span>
                <span>Enterprise Regulatory Intelligence</span>
              </div>

              <h1 className="mt-5 max-w-[14ch] text-[clamp(2.2rem,5vw,4.15rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-fg">
                Regulatory change,{" "}
                <span className="text-brand dark:text-support">with receipts.</span>
              </h1>

              <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-muted sm:text-[17px]">
                Ingest circulars across RBI, SEBI, IRDAI, and DPDP. Map cited obligations to your
                internal policy register and route redlines for human sign-off.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <LinkButton
                  href="/signin"
                  size="lg"
                  className="w-full sm:w-auto active:scale-[0.98]"
                >
                  Open workbench
                  <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </LinkButton>
                <LinkButton
                  href="/signin?provider=google"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto active:scale-[0.98]"
                >
                  Enterprise SSO
                </LinkButton>
              </div>

              {quickAccessEnabled ? (
                <div className="mt-4">
                  <Link
                    href="/signin#quick-access"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted underline decoration-line underline-offset-4 transition-colors hover:text-fg"
                  >
                    Quick role sign-in for evaluation
                    <ArrowRight size={12} weight="bold" aria-hidden="true" />
                  </Link>
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-5">
                <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Coverage
                </span>
                {REGULATORS.map((reg) => (
                  <span
                    key={reg}
                    className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-mono text-[10px] text-muted"
                  >
                    {reg}
                  </span>
                ))}
              </div>
            </div>

            <div className="rise rise-2 min-w-0">
              <HeroReceiptSnapshot />
            </div>
          </div>
        </section>

        {/* Capabilities: 3-column architectural ledger */}
        <section id="capabilities" className="scroll-mt-20 border-t border-line bg-surface/40">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-8 md:py-20">
            <Reveal>
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                <div className="max-w-[52ch]">
                  <h2 className="text-2xl font-semibold tracking-[-0.025em] text-fg sm:text-3xl">
                    Verifiable provenance, not black-box summaries.
                  </h2>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Core guarantees
                </span>
              </div>
            </Reveal>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {PILLARS.map((pillar, idx) => (
                <Reveal key={pillar.index} delayMs={idx * 65}>
                  <SpotlightCard className="h-full p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand dark:text-support">
                        {pillar.index}
                      </p>
                      <span className="h-px w-8 bg-line" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold tracking-[-0.015em] text-fg">
                      {pillar.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{pillar.body}</p>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Workbench Preview: Dedicated full-width simulator section */}
        <section id="workbench" className="scroll-mt-20 border-t border-line bg-canvas/55">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-8 md:py-24">
            <Reveal>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div className="max-w-[54ch]">
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
                    Inspect drafted redlines before anything publishes.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                    Switch between bundled regulatory scenarios to trace exact clause citations,
                    policy deltas, and the officer sign-off gate.
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Interactive redline simulator
                </span>
              </div>
            </Reveal>

            <Reveal delayMs={80}>
              <HeroWorkbenchPreview />
            </Reveal>
          </div>
        </section>

        {/* Interactive 4-stage Workflow */}
        <section id="workflow" className="scroll-mt-20 border-t border-line bg-surface/50">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-8 md:py-24">
            <Reveal>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div className="max-w-[52ch]">
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
                    Four stages from circular to audit record.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                    Select any stage to inspect the deterministic artifact generated inside your
                    authenticated tenant boundary.
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Interactive pipeline trace
                </span>
              </div>
            </Reveal>

            <Reveal delayMs={90}>
              <InteractiveWorkflow />
            </Reveal>
          </div>
        </section>

        {/* Workspace Modules: Regulatory Watch, Policy Checks, Grounded Q&A, Storage & Outbox */}
        <section id="platform" className="scroll-mt-20 border-t border-line bg-canvas/55">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-8 md:py-24">
            <Reveal>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div className="max-w-[56ch]">
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
                    Continuous watch, policy checks, and resilient storage.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                    Every backend service runs inside the tenant boundary—from scheduled regulator
                    watchdogs and posture checks to SharePoint failover and Gmail OAuth delivery.
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Workbench modules
                </span>
              </div>
            </Reveal>

            <Reveal delayMs={90}>
              <PlatformModules />
            </Reveal>
          </div>
        </section>

        {/* Enterprise Security & Live RBAC Preview */}
        <section id="security" className="scroll-mt-20 border-t border-line bg-surface/40">
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-16 sm:px-8 md:py-24 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
            <Reveal>
              <div className="max-w-[44ch] lg:sticky lg:top-24">
                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
                  Built for regulated operations.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                  Compliance teams need verifiable provenance, not black-box summaries. PolicyPulse
                  separates public access from workspace telemetry and enforces human approval on
                  every redline.
                </p>
                <div className="mt-7">
                  <LinkButton
                    href="/signin"
                    variant="secondary"
                    className="w-full sm:w-auto active:scale-[0.98]"
                  >
                    Sign in to inspect workspace
                    <ArrowRight size={15} weight="bold" aria-hidden="true" />
                  </LinkButton>
                </div>
              </div>
            </Reveal>

            <Reveal delayMs={100}>
              <SecurityArchitectureGrid />
            </Reveal>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-line bg-surface/75">
          <Reveal>
            <div className="mx-auto flex w-full max-w-[1200px] flex-col justify-between gap-6 px-4 py-14 sm:px-8 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.025em] text-fg">
                  Ready for review.
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Authenticate with SSO or select an evaluation role to enter the workbench.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <LinkButton
                  href="/signin"
                  size="lg"
                  className="w-full sm:w-auto active:scale-[0.98]"
                >
                  Sign in
                  <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </LinkButton>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line bg-canvas/80">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <BrandLockup appName="PolicyPulse" compact />
          <p>Enterprise regulatory compliance · Human sign-off required</p>
        </div>
      </footer>
    </div>
  );
}
