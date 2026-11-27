import { cookies } from "next/headers";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  FileText,
  LockKey,
  Scales,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { ComplianceGraphs } from "@/components/landing/compliance-graphs";
import { HeroTelemetry } from "@/components/landing/hero-telemetry";
import { SeverityBadge } from "@/components/severity-badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { parseThemeCookie, THEME_COOKIE_NAME } from "@/components/theme/theme";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const gaps = [
  {
    severity: "CRITICAL" as const,
    regulator: "IRDAI + CERT-In",
    source: "Section 4.2 / Section 6",
    obligation: "Report critical cyber incidents within six hours of detection.",
    policy: "POL-SEC-02 · Incident Response and Reporting Policy",
    conflict: "Escalates and reports within 72 hours — twelve times the permitted window.",
  },
  {
    severity: "CRITICAL" as const,
    regulator: "RBI",
    source: "Section 4.1, Page 21",
    obligation: "Store payment system data only on servers located within India.",
    policy: "POL-CLOUD-05 · Cloud Services and Data Residency Policy",
    conflict: "Production and backups run in AWS ap-southeast-1, outside India.",
  },
  {
    severity: "HIGH" as const,
    regulator: "DPDP Act 2023",
    source: "Section 6(4) / Section 8(7)",
    obligation: "Honour consent withdrawal with comparable ease and erase data on withdrawal.",
    policy: "POL-PRIV-01 · Customer Privacy and Consent Policy",
    conflict: "Withdrawal only by email within 14 days, with an 18-month retention tail.",
  },
];

const steps = [
  {
    index: "01",
    title: "Ingest",
    body: "Upload a PDF or register a regulator circular. Content is checksummed, split into citable clauses, and stored with its source URL and effective date.",
  },
  {
    index: "02",
    title: "Extract",
    body: "A deterministic parser turns each clause into atomic obligations: type, action, audience, threshold, and the exact quote that proves it.",
  },
  {
    index: "03",
    title: "Map and assess",
    body: "Tag, term, and attribute scoring maps each obligation to a policy or control, then a gap rule sets severity, deadline, and confidence.",
  },
  {
    index: "04",
    title: "Review",
    body: "The compliance officer approves, edits, or rejects the drafted redline. Every decision writes an immutable review event and audit row.",
  },
  {
    index: "05",
    title: "Remediate",
    body: "Approval queues a durable remediation email to the control owner. Nothing is published to a policy register by the system.",
  },
];

const guardrails = [
  {
    title: "Exact citations",
    body: "Every obligation must be a verified substring of the source clause. Unverified quotes are flagged, not smoothed over.",
    icon: FileText,
  },
  {
    title: "Calibrated confidence",
    body: "Confidence is a published formula: citation verification, mapping score, and rule certainty. No hidden model scores.",
    icon: Scales,
  },
  {
    title: "Human sign-off",
    body: "Approval, edits, and rejection are explicit officer actions. The system never publishes policy on its own.",
    icon: CheckCircle,
  },
  {
    title: "Tenant isolation",
    body: "Every read and write is scoped to the signed-in workspace. A second seeded tenant proves the boundary.",
    icon: LockKey,
  },
  {
    title: "Deterministic core",
    body: "Extraction, gap assessment, and citation verification run deterministically without hallucination risk.",
    icon: Warning,
  },
];

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-4 shrink-0" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.82"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.68"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.9"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function MicrosoftGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-4 shrink-0" aria-hidden="true">
      <rect x="1" y="1" width="7.2" height="7.2" fill="currentColor" />
      <rect x="9.8" y="1" width="7.2" height="7.2" fill="currentColor" fillOpacity="0.8" />
      <rect x="1" y="9.8" width="7.2" height="7.2" fill="currentColor" fillOpacity="0.65" />
      <rect x="9.8" y="9.8" width="7.2" height="7.2" fill="currentColor" fillOpacity="0.9" />
    </svg>
  );
}

export default async function LandingPage() {
  const cookieStore = await cookies();
  const initialTheme = parseThemeCookie(cookieStore.get(THEME_COOKIE_NAME)?.value, "light");

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-canvas text-fg">
      <div aria-hidden="true" className="pp-backdrop-grid" />

      <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="shrink-0">
            <BrandLockup appName="PolicyPulse" />
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 text-sm font-medium text-muted md:flex"
          >
            <a href="#telemetry" className="transition-colors hover:text-fg">
              Telemetry
            </a>
            <a href="#proof" className="transition-colors hover:text-fg">
              Live gaps
            </a>
            <a href="#how" className="transition-colors hover:text-fg">
              Workflow
            </a>
            <a href="#guardrails" className="transition-colors hover:text-fg">
              Guardrails
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
        <section className="mx-auto grid w-full max-w-[1200px] gap-12 px-5 pb-16 pt-12 sm:px-8 md:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="rise">
            <Badge tone="brand" dot>
              PolicyPulse · Regulatory Intelligence
            </Badge>

            <h1 className="mt-5 max-w-[15ch] text-[clamp(2.75rem,6vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-fg">
              Regulatory change, <span className="text-brand dark:text-accent">with receipts.</span>
            </h1>

            <p className="mt-5 max-w-[54ch] text-base leading-relaxed text-muted sm:text-lg">
              PolicyPulse reads RBI, SEBI, IRDAI, CERT-In, and DPDP circulars, extracts clause-cited
              obligations, maps them to your internal register, and hands an officer a redline with
              a verified due date.
            </p>

            {/* Primary CTA + Enterprise SSO Entry */}
            <div className="mt-7 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <LinkButton href="/signin" size="lg">
                  Continue with Google
                  <GoogleGlyph />
                </LinkButton>
                <LinkButton href="/signin?provider=microsoft" variant="secondary" size="lg">
                  <MicrosoftGlyph />
                  Enterprise SSO
                </LinkButton>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted">
                <Link
                  href="/signin#demo-access"
                  className="inline-flex items-center gap-1.5 font-medium text-fg underline decoration-line underline-offset-4 transition-colors hover:text-brand dark:hover:text-accent"
                >
                  Inspect seeded demo workspace
                  <ArrowRight size={13} weight="bold" aria-hidden="true" />
                </Link>
                <span aria-hidden="true" className="text-line">
                  |
                </span>
                <a
                  href="#proof"
                  className="inline-flex items-center gap-1 font-medium text-muted transition-colors hover:text-fg"
                >
                  View live gaps
                </a>
              </div>
            </div>

            <dl className="mt-9 grid max-w-[520px] grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
              {[
                { value: "5", label: "Seeded circulars" },
                { value: "4", label: "Regulators" },
                { value: "0", label: "Auto-publishes" },
              ].map((fact) => (
                <div key={fact.label} className="bg-surface px-4 py-3.5">
                  <dt className="font-mono text-2xl font-medium tracking-tight text-brand dark:text-accent tabular-nums">
                    {fact.value}
                  </dt>
                  <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {fact.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rise rise-2" id="sample">
            <HeroTelemetry />
          </div>
        </section>

        {/* Interactive Graphs & Telemetry */}
        <div className="border-t border-line bg-surface/40">
          <ComplianceGraphs />
        </div>

        {/* Seeded Gaps Proof */}
        <section id="proof" className="scroll-mt-20 border-y border-line bg-canvas">
          <div className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 md:py-24">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-[58ch]">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand dark:text-accent">
                  Verified Findings
                </p>
                <h2 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
                  Three real conflicts in the seed corpus.
                </h2>
                <p className="mt-3 text-muted">
                  Generated deterministically from bundled circular text and the internal policy
                  register. Each card links directly to a clause-level review.
                </p>
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                5 circulars · 4 policies · 4 controls
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {gaps.map((gap) => (
                <Card
                  key={gap.obligation}
                  className="flex flex-col p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {gap.regulator}
                    </span>
                    <SeverityBadge severity={gap.severity} />
                  </div>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-fg">
                    {gap.obligation}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {gap.source}
                  </p>
                  <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                    <p className="font-mono text-[11px] text-brand dark:text-accent">
                      {gap.policy}
                    </p>
                    <p className="text-muted">{gap.conflict}</p>
                  </div>
                  <div className="mt-auto pt-5">
                    <Link
                      href="/signin"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-fg underline-offset-4 hover:text-brand hover:underline dark:hover:text-accent"
                    >
                      Review in the workbench
                      <ArrowUpRight size={14} weight="bold" aria-hidden="true" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section
          id="how"
          className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-5 py-20 sm:px-8 md:py-24"
        >
          <div className="max-w-[58ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand dark:text-accent">
              The Route
            </p>
            <h2 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
              Five steps, one audit spine.
            </h2>
            <p className="mt-3 text-muted">
              Every step leaves an immutable artifact: a clause, an obligation, a mapping, a review
              event, or a queued email.
            </p>
          </div>

          <ol className="mt-10 divide-y divide-line border-y border-line">
            {steps.map((step) => (
              <li
                key={step.index}
                className="grid gap-3 py-6 transition-colors hover:bg-surface/60 sm:grid-cols-[3.5rem_12rem_1fr] sm:items-baseline sm:gap-6 sm:px-3"
              >
                <span className="font-mono text-xs font-medium text-brand dark:text-accent">
                  {step.index}
                </span>
                <span className="text-lg font-semibold tracking-[-0.01em] text-fg">
                  {step.title}
                </span>
                <p className="max-w-[68ch] text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Guardrails */}
        <section id="guardrails" className="scroll-mt-20 border-t border-line bg-surface/40">
          <div className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 md:py-24">
            <div className="max-w-[58ch]">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand dark:text-accent">
                Guardrails
              </p>
              <h2 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
                Built for a regulated reader.
              </h2>
              <p className="mt-3 text-muted">
                A compliance officer has to defend every line. These constraints are engineered into
                PolicyPulse from the schema up.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              {guardrails.map((guardrail, index) => {
                const Icon = guardrail.icon;
                return (
                  <Card
                    key={guardrail.title}
                    className={
                      index < 2
                        ? "p-6 transition-colors hover:border-brand/40 lg:col-span-3"
                        : "p-6 transition-colors hover:border-brand/40 lg:col-span-2"
                    }
                  >
                    <Icon
                      size={20}
                      weight="bold"
                      aria-hidden="true"
                      className="text-brand dark:text-accent"
                    />
                    <h3 className="mt-4 text-lg font-semibold tracking-[-0.01em] text-fg">
                      {guardrail.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{guardrail.body}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom Sign-In & Enterprise Access Band */}
        <section className="border-t border-line bg-canvas">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col justify-between gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-brand dark:text-accent">
                <ShieldCheck size={14} weight="bold" aria-hidden="true" />
                Enterprise Ready · Google &amp; SAML SSO
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">
                Enter the PolicyPulse workbench.
              </h2>
              <p className="max-w-[56ch] text-sm text-muted">
                Sign in with Google Workspace, Microsoft Entra SSO, or inspect the five-persona
                seeded workspace to walk a critical finding to sign-off.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LinkButton href="/signin" size="lg">
                Sign in with SSO
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </LinkButton>
              <LinkButton href="/signin#demo-access" variant="secondary" size="lg">
                Demo personas
              </LinkButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <BrandLockup appName="PolicyPulse" compact />
          <p>
            PolicyPulse by Hexaware · enterprise regulatory compliance · human sign-off required
          </p>
        </div>
      </footer>
    </div>
  );
}
