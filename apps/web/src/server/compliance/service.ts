import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { analyzeClause } from "@/lib/compliance/pipeline";
import { parseDocumentText } from "@/lib/compliance/parse";
import { answerQuestion, type QaAnswer, type QaSource } from "@/lib/compliance/qa";
import { diffWords, type DiffToken } from "@/lib/compliance/redline";
import { scanField, type DataFieldInput, type ScanResult } from "@/lib/compliance/data-scan";
import type { ComplianceRecord, RegulatorKey, Severity, SourceClause } from "@/lib/compliance/types";
import { db } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { enqueueEmail } from "@/server/email/service";
import type { Actor } from "@/server/auth/actor";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function notFound(what: string): never {
  throw new AppError(ERROR_CODES.NOT_FOUND, `${what} not found.`);
}

export interface DashboardData {
  documentCount: number;
  clauseCount: number;
  findings: {
    total: number;
    pending: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    approved: number;
    rejected: number;
  };
  scans: { total: number; critical: number; high: number; unconsented: number };
  documents: Array<{
    id: string;
    title: string;
    reference: string;
    regulator: RegulatorKey;
    publishedAt: Date;
    clauseCount: number;
    findingCount: number;
  }>;
  urgent: Array<{
    id: string;
    severity: Severity;
    dueDate: Date;
    plainLanguage: string;
    documentReference: string;
    reviewStatus: string;
  }>;
}

export async function getDashboard(actor: Actor): Promise<DashboardData> {
  const [documentCount, clauseCount, findings, scans, documents, urgent] = await Promise.all([
    db.regulatoryDocument.count({ where: { workspaceId: actor.workspaceId } }),
    db.documentClause.count({ where: { workspaceId: actor.workspaceId } }),
    db.finding.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { severity: true, reviewStatus: true },
    }),
    db.dataFieldScan.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { riskLevel: true, consented: true },
    }),
    db.regulatoryDocument.findMany({
      where: { workspaceId: actor.workspaceId },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        reference: true,
        regulator: true,
        publishedAt: true,
        _count: { select: { clauses: true, findings: true } },
      },
    }),
    db.finding.findMany({
      where: {
        workspaceId: actor.workspaceId,
        reviewStatus: "PENDING_REVIEW",
        severity: { in: ["CRITICAL", "HIGH"] },
      },
      orderBy: [{ severity: "asc" }, { dueDate: "asc" }],
      take: 5,
      include: {
        obligation: { select: { plainLanguage: true } },
        document: { select: { reference: true } },
      },
    }),
  ]);

  const count = (predicate: (row: (typeof findings)[number]) => boolean) =>
    findings.filter(predicate).length;

  return {
    documentCount,
    clauseCount,
    findings: {
      total: findings.length,
      pending: count((row) => row.reviewStatus === "PENDING_REVIEW"),
      critical: count((row) => row.severity === "CRITICAL"),
      high: count((row) => row.severity === "HIGH"),
      medium: count((row) => row.severity === "MEDIUM"),
      low: count((row) => row.severity === "LOW"),
      approved: count(
        (row) => row.reviewStatus === "APPROVED" || row.reviewStatus === "APPROVED_WITH_EDITS",
      ),
      rejected: count((row) => row.reviewStatus === "REJECTED"),
    },
    scans: {
      total: scans.length,
      critical: scans.filter((row) => row.riskLevel === "CRITICAL").length,
      high: scans.filter((row) => row.riskLevel === "HIGH").length,
      unconsented: scans.filter((row) => !row.consented).length,
    },
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      reference: document.reference,
      regulator: document.regulator,
      publishedAt: document.publishedAt,
      clauseCount: document._count.clauses,
      findingCount: document._count.findings,
    })),
    urgent: urgent.map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      dueDate: finding.dueDate,
      plainLanguage: finding.obligation.plainLanguage,
      documentReference: finding.document.reference,
      reviewStatus: finding.reviewStatus,
    })),
  };
}

export interface DocumentListItem {
  id: string;
  title: string;
  reference: string;
  regulator: RegulatorKey;
  summary: string;
  publishedAt: Date;
  effectiveAt: Date | null;
  status: string;
  clauseCount: number;
  findingCount: number;
  criticalCount: number;
}

export async function listDocuments(actor: Actor): Promise<DocumentListItem[]> {
  const documents = await db.regulatoryDocument.findMany({
    where: { workspaceId: actor.workspaceId },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      reference: true,
      regulator: true,
      summary: true,
      publishedAt: true,
      effectiveAt: true,
      status: true,
      _count: { select: { clauses: true, findings: true } },
      findings: { select: { severity: true } },
    },
  });

  return documents.map((document) => ({
    id: document.id,
    title: document.title,
    reference: document.reference,
    regulator: document.regulator,
    summary: document.summary,
    publishedAt: document.publishedAt,
    effectiveAt: document.effectiveAt,
    status: document.status,
    clauseCount: document._count.clauses,
    findingCount: document._count.findings,
    criticalCount: document.findings.filter((finding) => finding.severity === "CRITICAL").length,
  }));
}

export interface DocumentClauseView {
  id: string;
  sectionLabel: string;
  heading: string | null;
  pageNumber: number;
  text: string;
  obligations: Array<{
    id: string;
    reference: string;
    plainLanguage: string;
    obligationType: string;
    sla: string | null;
    citationVerified: boolean;
    extractionConfidence: number;
    finding: {
      id: string;
      severity: Severity;
      status: string;
      reviewStatus: string;
      dueDate: Date;
      confidence: number;
    } | null;
  }>;
}

export interface DocumentDetail {
  id: string;
  title: string;
  reference: string;
  regulator: RegulatorKey;
  summary: string;
  sourceUrl: string;
  publishedAt: Date;
  effectiveAt: Date | null;
  status: string;
  pageCount: number;
  checksum: string;
  clauses: DocumentClauseView[];
}

export async function getDocument(actor: Actor, documentId: string): Promise<DocumentDetail> {
  const document = await db.regulatoryDocument.findFirst({
    where: { id: documentId, workspaceId: actor.workspaceId },
    include: {
      clauses: {
        orderBy: { orderIndex: "asc" },
        include: {
          obligations: {
            orderBy: { reference: "asc" },
            select: {
              id: true,
              reference: true,
              plainLanguage: true,
              obligationType: true,
              sla: true,
              citationVerified: true,
              extractionConfidence: true,
              finding: {
                select: {
                  id: true,
                  severity: true,
                  status: true,
                  reviewStatus: true,
                  dueDate: true,
                  confidence: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!document) {
    notFound("Circular");
  }

  return {
    id: document.id,
    title: document.title,
    reference: document.reference,
    regulator: document.regulator,
    summary: document.summary,
    sourceUrl: document.sourceUrl,
    publishedAt: document.publishedAt,
    effectiveAt: document.effectiveAt,
    status: document.status,
    pageCount: document.pageCount,
    checksum: document.checksum,
    clauses: document.clauses.map((clause) => ({
      id: clause.id,
      sectionLabel: clause.sectionLabel,
      heading: clause.heading,
      pageNumber: clause.pageNumber,
      text: clause.text,
      obligations: clause.obligations.map((obligation) => ({
        id: obligation.id,
        reference: obligation.reference,
        plainLanguage: obligation.plainLanguage,
        obligationType: obligation.obligationType,
        sla: obligation.sla,
        citationVerified: obligation.citationVerified,
        extractionConfidence: obligation.extractionConfidence,
        finding: obligation.finding,
      })),
    })),
  };
}

export interface FindingFilter {
  severity?: Severity;
  review?: "pending" | "approved" | "rejected";
  cursor?: string;
  take?: number;
}

function reviewStatusFilter(
  review: NonNullable<FindingFilter["review"]>,
): NonNullable<Prisma.FindingWhereInput["reviewStatus"]> {
  if (review === "pending") {
    return { equals: "PENDING_REVIEW" };
  }
  if (review === "approved") {
    return { in: ["APPROVED", "APPROVED_WITH_EDITS"] };
  }
  return { equals: "REJECTED" };
}

export interface FindingListItem {
  id: string;
  reference: string;
  plainLanguage: string;
  obligationType: string;
  severity: Severity;
  status: string;
  reviewStatus: string;
  dueDate: Date;
  confidence: number;
  policyCode: string | null;
  controlCode: string | null;
  documentReference: string;
}

export async function listFindings(
  actor: Actor,
  filter: FindingFilter = {},
): Promise<{ items: FindingListItem[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(filter.take ?? 20, 1), 50);
  const rows = await db.finding.findMany({
    where: {
      workspaceId: actor.workspaceId,
      ...(filter.severity ? { severity: filter.severity } : {}),
      ...(filter.review ? { reviewStatus: reviewStatusFilter(filter.review) } : {}),
    },
    orderBy: [{ severity: "asc" }, { dueDate: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    include: {
      obligation: { select: { reference: true, plainLanguage: true, obligationType: true } },
      document: { select: { reference: true } },
      policy: { select: { code: true } },
      control: { select: { code: true } },
    },
  });

  const hasNext = rows.length > take;
  const items = (hasNext ? rows.slice(0, take) : rows).map((finding) => ({
    id: finding.id,
    reference: finding.obligation.reference,
    plainLanguage: finding.obligation.plainLanguage,
    obligationType: finding.obligation.obligationType,
    severity: finding.severity,
    status: finding.status,
    reviewStatus: finding.reviewStatus,
    dueDate: finding.dueDate,
    confidence: finding.confidence,
    policyCode: finding.policy?.code ?? null,
    controlCode: finding.control?.code ?? null,
    documentReference: finding.document.reference,
  }));

  return {
    items,
    nextCursor: hasNext ? (items[items.length - 1]?.id ?? null) : null,
  };
}

export interface FindingDetail {
  id: string;
  severity: Severity;
  status: string;
  gapDescription: string;
  severityRationale: string | null;
  citationVerified: boolean;
  extractionConfidence: number;
  mappingConfidence: number;
  confidence: number;
  dueDate: Date;
  redlineBefore: string;
  redlineAfter: string;
  approvedWording: string | null;
  taskTitle: string | null;
  taskAssignee: string | null;
  taskAssigneeEmail: string | null;
  taskDueDate: Date | null;
  reviewStatus: string;
  reviewerName: string | null;
  reviewedAt: Date | null;
  reviewComments: string | null;
  diff: DiffToken[];
  document: {
    id: string;
    title: string;
    reference: string;
    regulator: RegulatorKey;
    sourceUrl: string;
  };
  obligation: {
    reference: string;
    plainLanguage: string;
    actionRequired: string;
    applicableTo: string;
    obligationType: string;
    sla: string | null;
    requirement: unknown;
  };
  clause: { sectionLabel: string; heading: string | null; pageNumber: number; text: string };
  policy: { code: string; title: string; ownerName: string; section: string } | null;
  control: { code: string; title: string; ownerName: string; systemName: string | null } | null;
  reviews: Array<{
    id: string;
    actorName: string;
    actorRole: string;
    action: string;
    comments: string;
    createdAt: Date;
    approvedWording: string | null;
  }>;
}

function snapshotValue(value: Prisma.JsonValue, key: string): string | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const raw = value[key];
    return typeof raw === "string" ? raw : null;
  }
  return null;
}

export async function getFinding(actor: Actor, findingId: string): Promise<FindingDetail> {
  const finding = await db.finding.findFirst({
    where: { id: findingId, workspaceId: actor.workspaceId },
    include: {
      obligation: { include: { clause: true } },
      document: {
        select: { id: true, title: true, reference: true, regulator: true, sourceUrl: true },
      },
      policy: { select: { code: true, title: true, ownerName: true, section: true } },
      control: { select: { code: true, title: true, ownerName: true, systemName: true } },
      reviews: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!finding) {
    notFound("Finding");
  }

  return {
    id: finding.id,
    severity: finding.severity,
    status: finding.status,
    gapDescription: finding.gapDescription,
    severityRationale: finding.severityRationale,
    citationVerified: finding.citationVerified,
    extractionConfidence: finding.extractionConfidence,
    mappingConfidence: finding.mappingConfidence,
    confidence: finding.confidence,
    dueDate: finding.dueDate,
    redlineBefore: finding.redlineBefore,
    redlineAfter: finding.redlineAfter,
    approvedWording: finding.approvedWording,
    taskTitle: finding.taskTitle,
    taskAssignee: finding.taskAssignee,
    taskAssigneeEmail: finding.taskAssigneeEmail,
    taskDueDate: finding.taskDueDate,
    reviewStatus: finding.reviewStatus,
    reviewerName: finding.reviewerName,
    reviewedAt: finding.reviewedAt,
    reviewComments: finding.reviewComments,
    diff: diffWords(finding.redlineBefore, finding.redlineAfter),
    document: finding.document,
    obligation: {
      reference: finding.obligation.reference,
      plainLanguage: finding.obligation.plainLanguage,
      actionRequired: finding.obligation.actionRequired,
      applicableTo: finding.obligation.applicableTo,
      obligationType: finding.obligation.obligationType,
      sla: finding.obligation.sla,
      requirement: finding.obligation.requirement,
    },
    clause: {
      sectionLabel: finding.obligation.clause.sectionLabel,
      heading: finding.obligation.clause.heading,
      pageNumber: finding.obligation.clause.pageNumber,
      text: finding.obligation.clause.text,
    },
    policy: finding.policy,
    control: finding.control,
    reviews: finding.reviews.map((review) => ({
      id: review.id,
      actorName: review.actorName,
      actorRole: review.actorRole,
      action: review.action,
      comments: review.comments,
      createdAt: review.createdAt,
      approvedWording: snapshotValue(review.updated, "approvedWording"),
    })),
  };
}

export type ReviewActionInput = "APPROVED" | "APPROVED_WITH_EDITS" | "REJECTED";

export interface ReviewFindingInput {
  action: ReviewActionInput;
  comments: string;
  approvedWording?: string;
}

export interface ReviewFindingResult {
  id: string;
  reviewStatus: string;
  emailQueued: boolean;
}

export async function reviewFinding(
  actor: Actor,
  findingId: string,
  input: ReviewFindingInput,
): Promise<ReviewFindingResult> {
  const existing = await db.finding.findFirst({
    where: { id: findingId, workspaceId: actor.workspaceId },
    include: {
      obligation: { select: { reference: true, plainLanguage: true } },
      document: { select: { reference: true } },
    },
  });

  if (!existing) {
    notFound("Finding");
  }

  if (existing.reviewStatus !== "PENDING_REVIEW") {
    throw new AppError(ERROR_CODES.CONFLICT, "This finding has already been reviewed.");
  }

  const comments = input.comments.trim();
  if (input.action === "REJECTED" && comments.length < 10) {
    throw new AppError(
      ERROR_CODES.BAD_REQUEST,
      "A rejection needs a reason of at least 10 characters.",
    );
  }

  let approvedWording: string | null = null;

  if (input.action === "APPROVED_WITH_EDITS") {
    const wording = input.approvedWording?.trim() ?? "";
    if (wording.length < 12) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, "Edited wording must be at least 12 characters.");
    }
    if (wording.length > 2000) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        "Edited wording must be 2000 characters or fewer.",
      );
    }
    approvedWording = wording;
  }

  const reviewedAt = new Date();
  const previous = {
    reviewStatus: existing.reviewStatus,
    approvedWording: existing.approvedWording,
  };
  const updated = {
    reviewStatus: input.action,
    approvedWording,
  };

  await db.$transaction(async (tx) => {
    await tx.finding.update({
      where: { id: existing.id },
      data: {
        reviewStatus: input.action,
        reviewerId: actor.userId,
        reviewerName: actor.name,
        reviewedAt,
        reviewComments: comments,
        approvedWording,
      },
    });

    await tx.reviewEvent.create({
      data: {
        workspaceId: actor.workspaceId,
        findingId: existing.id,
        actorId: actor.userId,
        actorName: actor.name,
        actorRole: actor.role,
        action: input.action,
        previous: previous as unknown as Prisma.InputJsonValue,
        updated: updated as unknown as Prisma.InputJsonValue,
        comments,
        createdAt: reviewedAt,
      },
    });

    await recordAudit(
      {
        workspaceId: actor.workspaceId,
        actorId: actor.userId,
        action: "finding.reviewed",
        entity: "Finding",
        entityId: existing.id,
        metadata: {
          decision: input.action,
          obligation: existing.obligation.reference,
          document: existing.document.reference,
        },
      },
      tx,
    );
  });

  let emailQueued = false;

  if (
    (input.action === "APPROVED" || input.action === "APPROVED_WITH_EDITS") &&
    existing.taskAssigneeEmail
  ) {
    try {
      const assignee = await db.user.findFirst({
        where: {
          email: existing.taskAssigneeEmail,
          memberships: { some: { workspaceId: actor.workspaceId } },
        },
        select: { id: true },
      });

      await enqueueEmail({
        event: "finding.remediation_task",
        to: existing.taskAssigneeEmail,
        ...(assignee ? { userId: assignee.id } : {}),
        workspaceId: actor.workspaceId,
        idempotencyKey: `finding-task:${existing.id}`,
        payload: {
          assigneeName: existing.taskAssignee ?? "Control owner",
          workspaceName: actor.workspaceName,
          taskTitle: existing.taskTitle ?? `Remediate ${existing.obligation.reference}`,
          findingReference: existing.obligation.reference,
          dueDate: (existing.taskDueDate ?? existing.dueDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          }),
          reviewerName: actor.name,
          workspaceUrl: `${env.APP_URL}/app/findings/${existing.id}`,
        },
      });
      emailQueued = true;
    } catch (error) {
      logger.error(
        {
          findingId: existing.id,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
        "remediation email enqueue failed",
      );
    }
  }

  return { id: existing.id, reviewStatus: input.action, emailQueued };
}

export interface IngestDocumentInput {
  regulator: RegulatorKey;
  title: string;
  reference: string;
  summary: string;
  sourceUrl: string;
  publishedAt: string;
  effectiveAt?: string;
  pageCount?: number;
  content: string;
  /** Pre-parsed clauses (fetched HTML/PDF) so real section labels and pages survive. */
  clauses?: SourceClause[];
}

export interface IngestDocumentResult {
  id: string;
  reference: string;
  clauses: number;
  obligations: number;
  findings: number;
}

export async function ingestDocument(
  actor: Actor,
  input: IngestDocumentInput,
): Promise<IngestDocumentResult> {
  const clauses =
    input.clauses && input.clauses.length > 0 ? input.clauses : parseDocumentText(input.content);
  if (clauses.length === 0) {
    throw new AppError(
      ERROR_CODES.BAD_REQUEST,
      "No citable clauses were found. Separate clauses with a blank line and keep each above 24 characters.",
    );
  }

  const duplicate = await db.regulatoryDocument.findFirst({
    where: { workspaceId: actor.workspaceId, reference: input.reference },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(ERROR_CODES.CONFLICT, "A circular with this reference is already ingested.");
  }

  const [policies, controls] = await Promise.all([
    db.internalPolicy.findMany({ where: { workspaceId: actor.workspaceId } }),
    db.internalControl.findMany({ where: { workspaceId: actor.workspaceId } }),
  ]);

  const policyRecords: ComplianceRecord[] = policies.map((policy) => ({
    kind: "policy",
    code: policy.code,
    title: policy.title,
    section: policy.section,
    text: policy.text,
    tags: policy.tags,
    ownerName: policy.ownerName,
    ownerEmail: policy.ownerEmail,
    attributes: policy.attributes as Record<string, unknown>,
  }));

  const controlRecords: ComplianceRecord[] = controls.map((control) => ({
    kind: "control",
    code: control.code,
    title: control.title,
    section: "Control activity",
    text: control.description,
    tags: control.tags,
    ownerName: control.ownerName,
    ownerEmail: control.ownerEmail,
    attributes: control.attributes as Record<string, unknown>,
    ...(control.systemName ? { systemName: control.systemName } : {}),
  }));

  const policyByCode = new Map(policies.map((policy) => [policy.code, policy.id]));
  const controlByCode = new Map(controls.map((control) => [control.code, control.id]));
  const content = input.content.trim();
  const checksum = createHash("sha256").update(content).digest("hex");
  const now = new Date();
  const effectiveAt = input.effectiveAt ? new Date(input.effectiveAt) : null;

  let obligationCount = 0;
  let findingCount = 0;

  const documentId = await db.$transaction(async (tx) => {
    const document = await tx.regulatoryDocument.create({
      data: {
        workspaceId: actor.workspaceId,
        regulator: input.regulator,
        title: input.title,
        reference: input.reference,
        summary: input.summary,
        sourceUrl: input.sourceUrl,
        publishedAt: new Date(input.publishedAt),
        effectiveAt,
        status: "ANALYZED",
        content,
        pageCount: input.pageCount ?? 1,
        checksum,
      },
    });

    for (const [index, clause] of clauses.entries()) {
      const clauseRow = await tx.documentClause.create({
        data: {
          workspaceId: actor.workspaceId,
          documentId: document.id,
          sectionLabel: clause.sectionLabel,
          heading: clause.heading ?? null,
          pageNumber: clause.pageNumber,
          orderIndex: index + 1,
          text: clause.text,
        },
      });

      const drafts = analyzeClause({
        document: {
          key: input.reference.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          regulator: input.regulator,
          reference: input.reference,
          effectiveAt,
        },
        clause,
        clauseOrder: index + 1,
        policies: policyRecords,
        controls: controlRecords,
        now,
      });

      for (const draft of drafts) {
        const obligation = await tx.obligation.create({
          data: {
            workspaceId: actor.workspaceId,
            documentId: document.id,
            clauseId: clauseRow.id,
            reference: draft.obligation.reference,
            plainLanguage: draft.obligation.plainLanguage,
            actionRequired: draft.obligation.actionRequired,
            applicableTo: draft.obligation.applicableTo,
            obligationType: draft.obligation.type,
            requirement: draft.obligation.requirement as unknown as Prisma.InputJsonValue,
            sla: draft.obligation.sla ?? null,
            effectiveDeadline: effectiveAt,
            extractionConfidence: draft.obligation.extractionConfidence,
            citationVerified: draft.obligation.citationVerified,
            criticNotes: draft.obligation.criticNotes,
          },
        });

        const policyCode = draft.mapping.policyCode;
        const controlCode = draft.mapping.controlCode;

        await tx.finding.create({
          data: {
            workspaceId: actor.workspaceId,
            obligationId: obligation.id,
            documentId: document.id,
            policyId: policyCode ? (policyByCode.get(policyCode) ?? null) : null,
            controlId: controlCode ? (controlByCode.get(controlCode) ?? null) : null,
            status: draft.finding.status,
            severity: draft.finding.severity,
            gapDescription: draft.finding.gapDescription,
            severityRationale: draft.finding.severityRationale,
            citationVerified: draft.finding.citationVerified,
            extractionConfidence: draft.finding.extractionConfidence,
            mappingConfidence: draft.finding.mappingConfidence,
            confidence: draft.finding.confidence,
            dueDate: draft.finding.dueDate,
            redlineBefore: draft.finding.redlineBefore,
            redlineAfter: draft.finding.redlineAfter,
            taskTitle: draft.finding.taskTitle,
            taskAssignee: draft.finding.taskAssignee,
            taskAssigneeEmail: draft.finding.taskAssigneeEmail,
            taskDueDate: draft.finding.taskDueDate,
            reviewStatus: draft.finding.reviewStatus,
          },
        });

        obligationCount += 1;
        findingCount += 1;
      }
    }

    await recordAudit(
      {
        workspaceId: actor.workspaceId,
        actorId: actor.userId,
        action: "document.ingested",
        entity: "RegulatoryDocument",
        entityId: document.id,
        metadata: {
          reference: input.reference,
          regulator: input.regulator,
          clauses: clauses.length,
          obligations: obligationCount,
        },
      },
      tx,
    );

    return document.id;
  });

  logger.info(
    { documentId, clauses: clauses.length, obligations: obligationCount },
    "circular ingested",
  );

  return {
    id: documentId,
    reference: input.reference,
    clauses: clauses.length,
    obligations: obligationCount,
    findings: findingCount,
  };
}

export async function askComplianceQuestion(actor: Actor, question: string): Promise<QaAnswer> {
  const [policies, controls, clauses] = await Promise.all([
    db.internalPolicy.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, code: true, title: true, text: true },
      take: 100,
    }),
    db.internalControl.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, code: true, title: true, description: true },
      take: 100,
    }),
    db.documentClause.findMany({
      where: { workspaceId: actor.workspaceId },
      select: {
        id: true,
        sectionLabel: true,
        text: true,
        document: { select: { regulator: true, reference: true } },
      },
      orderBy: [{ documentId: "asc" }, { orderIndex: "asc" }],
      take: 300,
    }),
  ]);

  const sources: QaSource[] = [
    ...policies.map((policy) => ({
      id: policy.id,
      label: `${policy.code} · ${policy.title}`,
      kind: "policy" as const,
      text: policy.text,
    })),
    ...controls.map((control) => ({
      id: control.id,
      label: `${control.code} · ${control.title}`,
      kind: "control" as const,
      text: control.description,
    })),
    ...clauses.map((clause) => ({
      id: clause.id,
      label: `${clause.document.regulator} ${clause.document.reference} · ${clause.sectionLabel}`,
      kind: "clause" as const,
      text: clause.text,
    })),
  ];

  return answerQuestion(question, sources);
}

export interface DataScanView {
  id: string;
  datasetName: string;
  fieldName: string;
  dataCategory: string;
  sensitiveType: string | null;
  sampleMasked: string | null;
  encrypted: boolean;
  consented: boolean;
  riskLevel: Severity;
  finding: string;
  citation: string;
}

export interface DataScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unconsented: number;
  unencrypted: number;
}

export interface DataScanPage {
  items: DataScanView[];
  summary: DataScanSummary;
}

export async function listDataScans(actor: Actor): Promise<DataScanPage> {
  const rows = await db.dataFieldScan.findMany({
    where: { workspaceId: actor.workspaceId },
    orderBy: [{ riskLevel: "asc" }, { datasetName: "asc" }, { fieldName: "asc" }],
    take: 200,
  });

  const items = rows.map((row) => ({
    id: row.id,
    datasetName: row.datasetName,
    fieldName: row.fieldName,
    dataCategory: row.dataCategory,
    sensitiveType: row.sensitiveType,
    sampleMasked: row.sampleMasked,
    encrypted: row.encrypted,
    consented: row.consented,
    riskLevel: row.riskLevel,
    finding: row.finding,
    citation: row.citation,
  }));

  return {
    items,
    summary: {
      total: items.length,
      critical: items.filter((item) => item.riskLevel === "CRITICAL").length,
      high: items.filter((item) => item.riskLevel === "HIGH").length,
      medium: items.filter((item) => item.riskLevel === "MEDIUM").length,
      low: items.filter((item) => item.riskLevel === "LOW").length,
      unconsented: items.filter((item) => !item.consented).length,
      unencrypted: items.filter((item) => !item.encrypted).length,
    },
  };
}

export async function createDataScan(
  actor: Actor,
  input: DataFieldInput,
): Promise<{ result: ScanResult; created: boolean }> {
  const existing = await db.dataFieldScan.findUnique({
    where: {
      workspaceId_datasetName_fieldName: {
        workspaceId: actor.workspaceId,
        datasetName: input.datasetName,
        fieldName: input.fieldName,
      },
    },
    select: { id: true },
  });

  const result = scanField(input);

  await db.dataFieldScan.upsert({
    where: {
      workspaceId_datasetName_fieldName: {
        workspaceId: actor.workspaceId,
        datasetName: input.datasetName,
        fieldName: input.fieldName,
      },
    },
    update: {
      dataCategory: result.dataCategory,
      sensitiveType: result.sensitiveType ?? null,
      sampleMasked: result.sampleMasked,
      encrypted: result.encrypted,
      consented: result.consented,
      riskLevel: result.riskLevel,
      finding: result.finding,
      citation: result.citation,
    },
    create: {
      workspaceId: actor.workspaceId,
      datasetName: result.datasetName,
      fieldName: result.fieldName,
      dataCategory: result.dataCategory,
      sensitiveType: result.sensitiveType ?? null,
      sampleMasked: result.sampleMasked,
      encrypted: result.encrypted,
      consented: result.consented,
      riskLevel: result.riskLevel,
      finding: result.finding,
      citation: result.citation,
    },
  });

  await recordAudit({
    workspaceId: actor.workspaceId,
    actorId: actor.userId,
    action: "data.scanned",
    entity: "DataFieldScan",
    metadata: {
      dataset: input.datasetName,
      field: input.fieldName,
      risk: result.riskLevel,
    },
  });

  return { result, created: !existing };
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorName: string | null;
  metadata: unknown;
  createdAt: Date;
}

export async function listAuditLog(actor: Actor, take = 60): Promise<AuditEntry[]> {
  const rows = await db.auditLog.findMany({
    where: { workspaceId: actor.workspaceId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 100),
    include: { actor: { select: { name: true, email: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    actorName: row.actor?.name ?? row.actor?.email ?? null,
    metadata: row.metadata,
    createdAt: row.createdAt,
  }));
}

export function confidenceBreakdown(finding: {
  extractionConfidence: number;
  mappingConfidence: number;
  citationVerified: boolean;
  confidence: number;
}): Array<{ label: string; value: number; weight: string }> {
  const citation = finding.citationVerified ? 0.4 : 0;
  const mapping = 0.35 * finding.mappingConfidence;
  const ruleCertainty = Math.min(
    1,
    Math.max(0, round((finding.confidence - citation - mapping) / 0.25)),
  );

  return [
    { label: "Citation verified", value: finding.citationVerified ? 1 : 0, weight: "40%" },
    { label: "Policy mapping", value: finding.mappingConfidence, weight: "35%" },
    { label: "Gap rule certainty", value: ruleCertainty, weight: "25%" },
  ];
}
