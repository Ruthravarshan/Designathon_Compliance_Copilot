import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  FileText,
  Info,
} from "@phosphor-icons/react/dist/ssr";
import { RevisionHistory } from "@/components/circulars/revision-history";
import { GapStatusLabel, ReviewStatusBadge, SeverityBadge } from "@/components/severity-badge";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { formatDate, formatPercent, humanize } from "@/lib/format";
import { actorCan, getActor } from "@/server/auth/actor";
import { getDocument } from "@/server/compliance/service";
import { listDocumentRevisions } from "@/server/watch/service";

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

  const revisionHistory = await listDocumentRevisions(actor, id);

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
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-muted/50 hover:text-fg"
        >
          {host}
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
          { label: "Checksum", value: document.checksum.slice(0, 12) },
        ].map((item) => (
          <div key={item.label} className="bg-surface px-5 py-4">
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              {item.label}
            </dt>
            <dd className="mt-1.5 font-mono text-xs text-fg">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-4 py-3 text-xs leading-relaxed text-muted">
        <Info size={15} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
        <p>
          Quotations below are the source clauses exactly as stored. Review links open the finding
          workbench with the redline, confidence breakdown, and audit history.
        </p>
      </div>

      <RevisionHistory revisions={revisionHistory.revisions} />

      <section aria-label="Clauses" className="space-y-3">
        {document.clauses.map((clause) => (
          <Card key={clause.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand">
                  {clause.sectionLabel}
                </span>
                {clause.heading ? (
                  <span className="text-xs text-muted">· {clause.heading}</span>
                ) : null}
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                Page {clause.pageNumber}
              </span>
            </div>

            <div className="p-5">
              <blockquote className="border-l-2 border-brand/40 pl-4 text-sm leading-relaxed text-fg">
                {clause.text}
              </blockquote>

              {clause.obligations.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-3 text-xs text-muted">
                  No atomic obligation was extracted from this clause. The clause remains citable in
                  policy Q&amp;A.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {clause.obligations.map((obligation) => {
                    const finding = obligation.finding;
                    return (
                      <li
                        key={obligation.id}
                        className="rounded-xl border border-line bg-surface px-4 py-3.5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                            {humanize(obligation.obligationType)}
                          </span>
                          {finding ? <SeverityBadge severity={finding.severity} /> : null}
                          {finding ? <ReviewStatusBadge status={finding.reviewStatus} /> : null}
                          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                            <CheckCircle
                              size={11}
                              weight="bold"
                              aria-hidden="true"
                              className={obligation.citationVerified ? "text-brand" : "text-danger"}
                            />
                            {obligation.citationVerified ? "Citation verified" : "Citation flagged"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed">{obligation.plainLanguage}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                          <span className="font-mono">{obligation.reference}</span>
                          {obligation.sla ? <span>SLA · {obligation.sla}</span> : null}
                          <span>Extraction {formatPercent(obligation.extractionConfidence)}</span>
                          {finding ? (
                            <span className="inline-flex items-center gap-2">
                              <GapStatusLabel status={finding.status} />
                              <span>Overall {formatPercent(finding.confidence)}</span>
                            </span>
                          ) : null}
                        </div>
                        {finding ? (
                          <div className="mt-3 border-t border-line pt-3">
                            <Link
                              href={`/app/findings/${finding.id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                            >
                              Open finding and redline
                              <ArrowRight size={12} weight="bold" aria-hidden="true" />
                            </Link>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        ))}
      </section>

      <div className="flex flex-col items-start justify-between gap-3 border-t border-line pt-5 text-xs text-muted sm:flex-row sm:items-center">
        <span className="inline-flex items-center gap-1.5">
          <FileText size={13} weight="bold" aria-hidden="true" />
          {document.clauses.length} clauses stored · checksum{" "}
          <span className="font-mono">{document.checksum.slice(0, 10)}…</span>
        </span>
        <Link href="/app/findings" className="font-medium hover:text-brand">
          Review the finding queue →
        </Link>
      </div>
    </div>
  );
}
