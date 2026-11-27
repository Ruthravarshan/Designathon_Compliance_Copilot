"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, FilePdf, Warning } from "@phosphor-icons/react";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton, Tabs } from "@/components/ui/navigation-controls";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { PdfPanel, SourceLink } from "@/components/policy/pdf-panel";
import { PolicyChangeRow, type PolicyChangeRowItem } from "@/components/policy/policy-diff";
import { RejectionDialog } from "@/components/policy/rejection-dialog";

export interface CircularClauseItem {
  id: string;
  sectionLabel: string;
  heading?: string | null;
  pageNumber: number;
  text: string;
  citationVerified: boolean;
}

export interface CircularObligationItem {
  id: string;
  reference: string;
  plainLanguage: string;
  actionRequired: string;
  applicableTo: string;
  citationVerified: boolean;
  pageNumber?: number | null;
}

export interface CircularFindingItem {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  gapDescription: string;
  reviewStatus: string;
  dueDate: string;
}

export interface CircularActivityItem {
  id: string;
  actorName: string;
  action: string;
  createdAt: string;
  note?: string | null;
}

export interface CircularDetailData {
  id: string;
  title: string;
  issuer: string;
  reference: string;
  status: string;
  publishedAt: string;
  effectiveAt?: string | null;
  aiStatus: string;
  aiModel?: string | null;
  checksum?: string | null;
  fileUrl?: string | null;
  filename?: string | null;
  sourceUrl?: string | null;
  needsReviewReason?: string | null;
  clauses: readonly CircularClauseItem[];
  obligations: readonly CircularObligationItem[];
  findings: readonly CircularFindingItem[];
  policyChanges: readonly PolicyChangeRowItem[];
  activity: readonly CircularActivityItem[];
  assignmentCount: number;
}

export function CircularDetailView({
  circular,
  canReview = false,
  onRejectWithNote,
}: {
  circular: CircularDetailData;
  canReview?: boolean;
  onRejectWithNote?: (payload: { note: string }) => Promise<{
    ok: boolean;
    error?: string;
    requestId?: string | null;
  }>;
}) {
  const [activeTab, setActiveTab] = useState("evidence");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectPending, setRejectPending] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);

  const handleReject = async (payload: { note: string }) => {
    if (!onRejectWithNote) {
      return;
    }
    setRejectPending(true);
    setRejectError(null);
    const res = await onRejectWithNote(payload);
    setRejectPending(false);
    if (res.ok) {
      setRejectOpen(false);
    } else {
      setRejectError(res.error ?? "That didn't save. Try again.");
      setRejectRequestId(res.requestId ?? null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={circular.title}
        meta={
          <>
            <Link
              href="/app/circulars"
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted hover:text-fg"
            >
              <ArrowLeft size={13} weight="bold" aria-hidden="true" />
              Circulars
            </Link>
            <Badge tone="outline">{circular.issuer}</Badge>
            <Badge tone="neutral">{circular.reference}</Badge>
            <StatusBadge status={circular.status} />
          </>
        }
        action={
          canReview && onRejectWithNote ? (
            <Button variant="secondary" size="sm" onClick={() => setRejectOpen(true)}>
              Reject with a note
            </Button>
          ) : undefined
        }
      />

      {circular.needsReviewReason ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-danger/35 bg-danger/10 p-4 text-sm text-fg"
        >
          <Warning
            size={18}
            weight="bold"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-danger"
          />
          <div>
            <p className="font-semibold">Needs review</p>
            <p className="mt-0.5 text-xs leading-relaxed text-fg">{circular.needsReviewReason}</p>
          </div>
        </div>
      ) : null}

      {/* Two columns >= 1024px: 360px evidence rail left + document panel right */}
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-fg">Evidence rail</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <dl className="grid gap-3.5 text-sm">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                  Published · Effective
                </dt>
                <dd className="mt-1 font-mono text-xs text-fg">
                  {formatDate(circular.publishedAt)} · {formatDate(circular.effectiveAt)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                  AI extraction
                </dt>
                <dd className="mt-1 text-xs text-fg">
                  {circular.aiStatus}
                  {circular.aiModel ? ` · ${circular.aiModel}` : ""}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                  Linked records
                </dt>
                <dd className="mt-1 font-mono text-xs text-fg tabular-nums">
                  {circular.policyChanges.length} policy changes · {circular.assignmentCount}{" "}
                  assignments
                </dd>
              </div>
              {circular.checksum ? (
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    SHA-256 checksum
                  </dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                      {circular.checksum}
                    </code>
                    <CopyButton value={circular.checksum} label="Copy" />
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {circular.fileUrl ? (
                <LinkButton
                  href={circular.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="sm"
                >
                  <FilePdf size={14} weight="bold" aria-hidden="true" className="text-brand" />
                  View PDF
                </LinkButton>
              ) : null}
              <SourceLink sourceUrl={circular.sourceUrl} label="View source" />
            </div>
          </CardBody>
        </Card>

        <PdfPanel
          title={circular.title}
          fileUrl={circular.fileUrl}
          sourceUrl={circular.sourceUrl}
          filename={circular.filename}
        />
      </div>

      {/* Sub-tabs */}
      <Tabs
        label="Circular breakdown"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          {
            id: "evidence",
            label: "Evidence",
            count: circular.clauses.length,
            content:
              circular.clauses.length === 0 ? (
                <EmptyState
                  title="No verified clauses yet."
                  description="Evidence quotes appear once extraction and verification complete."
                />
              ) : (
                <div className="space-y-3">
                  {circular.clauses.map((clause) => (
                    <Card key={clause.id} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                          {clause.sectionLabel} · Page {clause.pageNumber}
                          {clause.heading ? ` · ${clause.heading}` : ""}
                        </span>
                        {clause.citationVerified ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-brand">
                            <CheckCircle size={13} weight="bold" aria-hidden="true" />
                            Exact quote verified
                          </span>
                        ) : (
                          <StatusBadge status="NEEDS_REVIEW" />
                        )}
                      </div>
                      <blockquote className="mt-3 border-l-2 border-brand pl-4 text-sm leading-relaxed text-fg">
                        {clause.text}
                      </blockquote>
                      {circular.fileUrl ? (
                        <div className="mt-3">
                          <LinkButton
                            href={`${circular.fileUrl}#page=${clause.pageNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="ghost"
                            size="sm"
                          >
                            Open PDF (p. {clause.pageNumber})
                          </LinkButton>
                        </div>
                      ) : null}
                    </Card>
                  ))}
                </div>
              ),
          },
          {
            id: "obligations",
            label: "Obligations",
            count: circular.obligations.length,
            content:
              circular.obligations.length === 0 ? (
                <EmptyState title="No extracted obligations yet." />
              ) : (
                <div className="space-y-3">
                  {circular.obligations.map((ob) => (
                    <Card key={ob.id} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                          {ob.reference}
                          {ob.pageNumber ? ` · Page ${ob.pageNumber}` : ""}
                        </span>
                        {!ob.citationVerified ? <StatusBadge status="NEEDS_REVIEW" /> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-fg">{ob.plainLanguage}</p>
                      <p className="mt-1 text-sm text-muted">{ob.actionRequired}</p>
                      <p className="mt-2 font-mono text-xs text-muted">
                        Applies to: {ob.applicableTo}
                      </p>
                    </Card>
                  ))}
                </div>
              ),
          },
          {
            id: "findings",
            label: "Findings",
            count: circular.findings.length,
            content:
              circular.findings.length === 0 ? (
                <EmptyState title="No findings yet." />
              ) : (
                <div className="space-y-3">
                  {circular.findings.map((finding) => (
                    <Card key={finding.id} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <SeverityBadge severity={finding.severity} />
                          <StatusBadge status={finding.reviewStatus} />
                        </div>
                        <span className="font-mono text-xs text-muted">
                          Due {formatDate(finding.dueDate)}
                        </span>
                      </div>
                      <p className="mt-2.5 text-sm text-fg">{finding.gapDescription}</p>
                      <div className="mt-3">
                        <Link
                          href={`/app/compliance/${finding.id}`}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          Open finding review
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ),
          },
          {
            id: "policies",
            label: "Policy changes",
            count: circular.policyChanges.length,
            content:
              circular.policyChanges.length === 0 ? (
                <EmptyState title="No published changes yet." />
              ) : (
                <Card className="overflow-hidden">
                  <div className="divide-y divide-line">
                    {circular.policyChanges.map((item) => (
                      <PolicyChangeRow key={item.id} item={item} />
                    ))}
                  </div>
                </Card>
              ),
          },
          {
            id: "activity",
            label: "Activity",
            count: circular.activity.length,
            content:
              circular.activity.length === 0 ? (
                <EmptyState title="No audit events yet." />
              ) : (
                <Card className="divide-y divide-line">
                  {circular.activity.map((event) => (
                    <div key={event.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-fg">
                          {event.actorName} ·{" "}
                          <span className="font-mono text-xs text-muted">{event.action}</span>
                        </p>
                        <span className="font-mono text-xs text-muted">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      {event.note ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted">{event.note}</p>
                      ) : null}
                    </div>
                  ))}
                </Card>
              ),
          },
        ]}
      />

      {canReview && onRejectWithNote ? (
        <RejectionDialog
          open={rejectOpen}
          title="Reject circular finding"
          pending={rejectPending}
          serverError={rejectError}
          requestId={rejectRequestId}
          onSubmit={handleReject}
          onClose={() => setRejectOpen(false)}
        />
      ) : null}
    </div>
  );
}
