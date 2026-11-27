import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileText, Info } from "@phosphor-icons/react/dist/ssr";
import { CircularClausesExplorer } from "@/components/circulars/circular-clauses-explorer";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/navigation-controls";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { formatDate, humanize } from "@/lib/format";
import { actorCan, getActor } from "@/server/auth/actor";
import { getDocument } from "@/server/compliance/service";

export default async function CircularDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "document:read")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const { id } = await params;
  const document = await getDocument(actor, id).catch((error: unknown) => {
    if (error instanceof AppError && error.code === ERROR_CODES.NOT_FOUND) {
      notFound();
    }
    throw error;
  });

  let host = document.sourceUrl;
  try {
    host = new URL(document.sourceUrl).host;
  } catch {
    // Keep the raw URL if it cannot be parsed.
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/circulars"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
        >
          <ArrowLeft size={13} weight="bold" aria-hidden="true" />
          All circulars
        </Link>
      </div>

      <header className="flex flex-col justify-between gap-5 border-b border-line pb-6 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{document.regulator}</Badge>
            <Badge tone="outline">{humanize(document.status)}</Badge>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {document.reference}
            </span>
            <CopyButton value={document.reference} label="Copy ref" />
          </div>
          <h1 className="mt-3 max-w-[30ch] text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            {document.title}
          </h1>
          <p className="mt-3 max-w-[76ch] text-sm leading-relaxed text-muted">{document.summary}</p>
        </div>
        <a
          href={document.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-muted/50 hover:text-fg"
        >
          <span className="max-w-[24ch] truncate">{host}</span>
          <ArrowUpRight size={13} weight="bold" aria-hidden="true" />
        </a>
      </header>

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Published", value: formatDate(document.publishedAt) },
          { label: "Effective", value: formatDate(document.effectiveAt) },
          { label: "Pages", value: String(document.pageCount) },
          {
            label: "Clauses / obligations",
            value: `${document.clauses.length} / ${document.clauses.reduce(
              (sum, clause) => sum + clause.obligations.length,
              0,
            )}`,
          },
        ].map((item) => (
          <div key={item.label} className="bg-surface px-5 py-4">
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              {item.label}
            </dt>
            <dd className="mt-1.5 font-mono text-xs text-fg">{item.value}</dd>
          </div>
        ))}
        <div className="bg-surface px-5 py-4">
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Checksum</dt>
          <dd className="mt-1.5 flex items-center justify-between gap-2 font-mono text-xs text-fg">
            <span>{document.checksum.slice(0, 12)}</span>
            <CopyButton value={document.checksum} label="Copy" />
          </dd>
        </div>
      </dl>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-4 py-3 text-xs leading-relaxed text-muted">
        <Info
          size={15}
          weight="bold"
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand dark:text-support"
        />
        <p>
          Quotations below are the source clauses exactly as stored. Review links open the finding
          workbench with the redline, confidence breakdown, and audit history.
        </p>
      </div>

      <CircularClausesExplorer
        clauses={document.clauses.map((clause) => ({
          id: clause.id,
          sectionLabel: clause.sectionLabel,
          heading: clause.heading,
          pageNumber: clause.pageNumber,
          text: clause.text,
          obligations: clause.obligations.map((ob) => ({
            id: ob.id,
            obligationType: ob.obligationType,
            citationVerified: ob.citationVerified,
            plainLanguage: ob.plainLanguage,
            reference: ob.reference,
            sla: ob.sla,
            extractionConfidence: ob.extractionConfidence,
            finding: ob.finding
              ? {
                  id: ob.finding.id,
                  severity: ob.finding.severity,
                  reviewStatus: ob.finding.reviewStatus,
                  status: ob.finding.status,
                  confidence: ob.finding.confidence,
                }
              : null,
          })),
        }))}
      />

      <div className="flex flex-col items-start justify-between gap-3 border-t border-line pt-5 text-xs text-muted sm:flex-row sm:items-center">
        <span className="inline-flex items-center gap-1.5">
          <FileText size={13} weight="bold" aria-hidden="true" />
          {document.clauses.length} clauses stored · checksum{" "}
          <span className="font-mono">{document.checksum.slice(0, 10)}…</span>
        </span>
        <Link href="/app/findings" className="font-medium hover:text-brand dark:hover:text-support">
          Review the finding queue →
        </Link>
      </div>
    </div>
  );
}
