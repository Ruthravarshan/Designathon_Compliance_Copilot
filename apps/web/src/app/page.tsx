import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle,
  FileText,
  LockKey,
  Scales,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { HexMark } from "@/components/brand/hex-mark";
import { SeverityBadge } from "@/components/severity-badge";
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
    body: "Paste or register a circular. The content is checksummed, split into citable clauses, and stored with its source URL and effective date.",
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
    title: "No model required",
    body: "The extraction and gap core runs offline and deterministically. The demo path does not depend on an LLM or a prompt.",
    icon: Warning,
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div aria-hidden="true" className="grid-field" />

      <header className="border-b border-line/70">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#main" className="group flex items-center gap-3">
            <HexMark className="size-7 text-brand" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors group-hover:text-fg">
              Hexa / Compliance Copilot
            </span>
          </a>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 text-sm text-muted md:flex"
          >
            <a href="#proof" className="transition-colors hover:text-fg">
              Demo gaps
            </a>
            <a href="#how" className="transition-colors hover:text-fg">
              How it works
            </a>
            <a href="#guardrails" className="transition-colors hover:text-fg">
              Guardrails
            </a>
            <a href="/platform" className="transition-colors hover:text-fg">
              Build OS
            </a>
          </nav>
          <LinkButton href="/signin" className="h-10 px-4">
            Open workbench
            <ArrowRight size={15} weight="bold" aria-hidden="true" />
          </LinkButton>
        </div>
      </header>

      <main id="main">
        <section className="mx-auto grid w-full max-w-[1200px] gap-14 px-5 pb-20 pt-16 sm:px-8 md:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="rise">
            <Badge tone="brand" dot>
              Working demo · seeded workspace
            </Badge>
            <h1 className="mt-6 max-w-[16ch] text-[clamp(2.9rem,6.4vw,5.2rem)] font-medium leading-[0.96] tracking-[-0.045em]">
              Regulatory change, <span className="italic text-brand">with receipts.</span>
            </h1>
            <p className="mt-6 max-w-[54ch] text-base leading-relaxed text-muted sm:text-lg">
              The Compliance Copilot reads RBI, SEBI, IRDAI, CERT-In, and DPDP text, extracts
              clause-cited obligations, maps them to your policy register, and hands an officer a
              redline with a due date. No fabricated citations. No autonomous publishing.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/signin">
                Enter the workbench
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </LinkButton>
              <LinkButton href="#proof" variant="secondary">
                See the seeded gaps
              </LinkButton>
            </div>
            <dl className="mt-10 grid max-w-[520px] grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
              {[
                { value: "5", label: "Seeded circulars" },
                { value: "4", label: "Regulators" },
                { value: "0", label: "Autonomous publishes" },
              ].map((fact) => (
                <div key={fact.label} className="bg-surface px-4 py-4">
                  <dt className="font-mono text-2xl tracking-tight text-brand">{fact.value}</dt>
                  <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {fact.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rise rise-2" id="sample">
            <Card className="overflow-hidden shadow-[0_20px_60px_-30px_rgba(4,13,67,0.25)]">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  Seeded finding render
                </span>
                <SeverityBadge severity="CRITICAL" />
              </div>
              <div className="space-y-5 p-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    Source · IRDAI/IT/CYBER/2023 · Section 4.2
                  </p>
                  <blockquote className="mt-2 border-l-2 border-brand pl-4 text-sm leading-relaxed">
                    “Critical and cyber security incidents shall be reported to the IRDAI within six
                    hours of detection, along with the root cause and containment actions.”
                  </blockquote>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-surface-2 p-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      Mapped policy
                    </p>
                    <p className="mt-1 text-sm font-medium">POL-SEC-02 · Incident response</p>
                    <p className="mt-1 text-xs text-muted">Owner: Arjun Mehta · CISO</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      Deadline
                    </p>
                    <p className="mt-1 font-mono text-xs">7 days from ingest</p>
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    Drafted redline
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">
                    Report cyber security incidents to IRDAI and CERT-In{" "}
                    <del className="rounded bg-danger/10 px-1 text-muted line-through decoration-danger/60">
                      within 72 hours
                    </del>{" "}
                    <ins className="rounded bg-brand/10 px-1 text-fg no-underline">
                      within 6 hours
                    </ins>{" "}
                    of detection.
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-4">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-brand">
                    <Check size={12} weight="bold" aria-hidden="true" />
                    Citation verified
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    Confidence 0.88 · Pending review
                  </span>
                </div>
              </div>
              <div className="border-t border-line bg-surface-2 px-5 py-3">
                <p className="text-xs text-muted">
                  Illustrative rendering of the seeded IRDAI fixture. The live finding is produced
                  by the deterministic engine and reviewed in the workbench.
                </p>
              </div>
            </Card>
          </div>
        </section>

        <section id="proof" className="scroll-mt-8 border-y border-line bg-surface/40">
          <div className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 md:py-24">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-[58ch]">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">
                  The demo actually proves something
                </p>
                <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
                  Three real conflicts in the seed corpus.
                </h2>
                <p className="mt-3 text-muted">
                  These findings are generated from the bundled circular text and internal register
                  — not hand-written screenshots. Each card links to a clause-level review.
                </p>
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                5 circulars · 4 policies · 4 controls
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {gaps.map((gap) => (
                <Card key={gap.obligation} className="flex flex-col p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {gap.regulator}
                    </span>
                    <SeverityBadge severity={gap.severity} />
                  </div>
                  <p className="mt-4 text-sm font-medium leading-relaxed">{gap.obligation}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {gap.source}
                  </p>
                  <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                    <p className="font-mono text-[11px] text-brand">{gap.policy}</p>
                    <p className="text-muted">{gap.conflict}</p>
                  </div>
                  <div className="mt-auto pt-5">
                    <Link
                      href="/signin"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-fg underline-offset-4 hover:text-brand hover:underline"
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

        <section
          id="how"
          className="mx-auto w-full max-w-[1200px] scroll-mt-8 px-5 py-20 sm:px-8 md:py-28"
        >
          <div className="max-w-[58ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">The route</p>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
              Five steps, one audit spine.
            </h2>
            <p className="mt-3 text-muted">
              Every step leaves an artifact: a clause, an obligation, a mapping, a review event, or
              a queued email. Nothing is a chat transcript.
            </p>
          </div>

          <ol className="mt-10 divide-y divide-line border-y border-line">
            {steps.map((step) => (
              <li
                key={step.index}
                className="grid gap-3 py-6 sm:grid-cols-[3rem_12rem_1fr] sm:items-baseline sm:gap-6"
              >
                <span className="font-mono text-xs text-brand">{step.index}</span>
                <span className="text-lg font-medium tracking-[-0.01em]">{step.title}</span>
                <p className="max-w-[68ch] text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="guardrails" className="scroll-mt-8 border-t border-line bg-surface/40">
          <div className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 md:py-28">
            <div className="max-w-[58ch]">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">
                Guardrails
              </p>
              <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
                Built for a regulated reader.
              </h2>
              <p className="mt-3 text-muted">
                A compliance officer has to defend every line. These are the constraints the product
                refuses to trade away for a better demo.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              {guardrails.map((guardrail, index) => {
                const Icon = guardrail.icon;
                return (
                  <Card
                    key={guardrail.title}
                    className={index < 2 ? "p-6 lg:col-span-3" : "p-6 lg:col-span-2"}
                  >
                    <Icon size={20} weight="bold" aria-hidden="true" className="text-brand" />
                    <h3 className="mt-4 text-lg font-medium tracking-[-0.01em]">
                      {guardrail.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{guardrail.body}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col justify-between gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-medium tracking-[-0.02em] sm:text-3xl">
                Open the seeded workspace.
              </h2>
              <p className="mt-2 max-w-[52ch] text-sm text-muted">
                Five personas, one real tenant and one isolation tenant. Start as the Head of
                Compliance and walk a critical finding to sign-off.
              </p>
            </div>
            <LinkButton href="/signin">
              Choose a persona
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </LinkButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-mono uppercase tracking-[0.16em]">Hexa Compliance Copilot</p>
          <p>Built for the Hexa Designathon · demo data only · human sign-off required</p>
        </div>
      </footer>
    </div>
  );
}
