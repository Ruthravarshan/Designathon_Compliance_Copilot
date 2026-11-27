import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";
import { HexMark } from "@/components/brand/hex-mark";
import { ProgressBar } from "@/components/progress-bar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const phases = [
  ["00", "Intake", "0:00–0:15", "Problem statement captured"],
  ["01", "Explore", "0:15–0:55", "Users, jobs, alternatives"],
  ["02", "Edge cases", "0:55–1:20", "Failure matrix, abuse cases"],
  ["03", "Research", "1:20–1:45", "Prior art, APIs, sources"],
  ["04", "Enhance PS", "1:45–2:15", "Metrics, scope, acceptance"],
  ["05", "Solution design", "2:15–3:00", "Architecture, data, API, RBAC"],
  ["06", "Visual direction", "3:00–3:30", "Design read, tokens, reference"],
  ["07", "Build", "3:30–6:45", "Golden path works end to end"],
  ["08", "Harden", "6:45–7:45", "Security, a11y, perf, scale"],
  ["09", "Final test", "7:45–8:45", "Suite green, deployed smoke"],
  ["10", "Demo + pitch", "8:45–10:00", "Rehearsed twice, fallback ready"],
];

const standards = [
  "Strict TypeScript, zero any",
  "Zod validation at every trust boundary",
  "Server-side RBAC on every workspace read and write",
  "Empty, loading, error, and unauthorized states",
  "Cursor pagination, indexes, no N+1 queries",
  "Rate limits, idempotency, audit logs on mutations",
  "Durable email outbox with escaped templates",
  "Seeded demo data and a one-command reset",
];

const quickstart = `npm install
npm run db:up
npm run db:init
npm run db:seed
npm run dev`;

export default function PlatformPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div aria-hidden="true" className="grid-field" />

      <div className="border-b border-line/60 bg-canvas/90 px-5 pt-2 pb-3 backdrop-blur sm:px-8">
        <div className="mx-auto w-full max-w-[1200px]">
          <ProgressBar value={60} label="Discovery → Build" compact />
        </div>
      </div>

      <header className="border-b border-line/80">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <HexMark className="size-7 text-brand" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted transition-colors group-hover:text-fg">
              Hexa / Designathon OS
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <nav
              aria-label="Primary"
              className="hidden items-center gap-6 text-sm text-muted md:flex"
            >
              <a href="#workflow" className="transition-colors hover:text-fg">
                Workflow
              </a>
              <a href="#standards" className="transition-colors hover:text-fg">
                Standards
              </a>
            </nav>
            <LinkButton href="/signin" variant="secondary" className="h-10 px-4">
              Open PolicyPulse
              <ArrowRight size={15} weight="bold" aria-hidden="true" />
            </LinkButton>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="mx-auto w-full max-w-[1200px] px-5 pt-16 pb-14 sm:px-8 md:pt-24">
          <div className="max-w-[860px] rise">
            <Badge tone="outline">Operating system v1.0</Badge>
            <h1 className="mt-6 max-w-[16ch] text-[clamp(2.8rem,6.4vw,5.2rem)] font-medium leading-[0.96] tracking-[-0.045em]">
              Ten hours. <span className="italic text-brand">No excuses.</span>
            </h1>
            <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-muted sm:text-lg">
              The phase-gated operating system used to build PolicyPulse. Eleven gates, one artifact
              per phase, and a mechanical release check before the demo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="#workflow">
                Open the workflow
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </LinkButton>
              <LinkButton href="/" variant="secondary">
                <ArrowLeft size={16} weight="bold" aria-hidden="true" />
                Back to the product
              </LinkButton>
            </div>
          </div>
        </section>

        <section
          id="workflow"
          className="mx-auto w-full max-w-[1200px] scroll-mt-8 border-t border-line px-5 py-16 sm:px-8"
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-[52ch]">
              <h2 className="text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
                The 10-hour route
              </h2>
              <p className="mt-3 text-muted">
                Every phase ends with an artifact, so the next hour never starts from a blank page.
              </p>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              Discovery → Design → Build → Prove
            </p>
          </div>

          <ol className="mt-10 divide-y divide-line border-y border-line">
            {phases.map(([id, name, time, gate]) => (
              <li
                key={id}
                className="grid gap-2 py-4 sm:grid-cols-[2.5rem_8rem_10rem_1fr] sm:items-baseline sm:gap-4 sm:px-2"
              >
                <span className="font-mono text-xs text-muted">{id}</span>
                <span className="font-mono text-xs text-brand">{time}</span>
                <span className="font-medium">{name}</span>
                <span className="text-sm text-muted">{gate}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="standards" className="border-t border-line bg-surface/40">
          <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-7">
              <h2 className="text-2xl font-medium tracking-[-0.02em]">The quality bar</h2>
              <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {standards.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted">
                    <Check
                      size={16}
                      weight="bold"
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-brand"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  Fresh machine
                </span>
                <Badge tone="outline">5 steps</Badge>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7 text-fg">
                <code>{quickstart}</code>
              </pre>
              <div className="border-t border-line px-5 py-4">
                <p className="text-xs text-muted">
                  Full setup and the release gate live in <span className="font-mono">docs/</span>.
                  The demo workspace is seeded by <span className="font-mono">npm run db:seed</span>
                  .
                </p>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-mono uppercase tracking-[0.16em]">Hexa Designathon OS</p>
          <p>Discovery first. Ship last. Test before you demo.</p>
        </div>
      </footer>
    </div>
  );
}
