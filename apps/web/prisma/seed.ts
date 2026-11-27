import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Prisma, ReviewAction as PrismaReviewAction, ReviewStatus, Role } from "@prisma/client";
import { analyzeClause } from "../src/lib/compliance/pipeline";
import { scanCatalog } from "../src/lib/compliance/data-scan";
import { embedTexts, embeddingModel, isEmbeddingConfigured } from "../src/lib/llm/embeddings";
import { toVectorLiteral } from "../src/lib/search/vector";
import type { ComplianceRecord, FindingDraft, SourceClause } from "../src/lib/compliance/types";
import { extractDocument } from "../src/lib/watch/extract";
import { createPrismaClient } from "../src/server/prisma-client";
import {
  DEMO_CONTROLS,
  DEMO_DATA_CATALOG,
  DEMO_NOW,
  DEMO_PERSONAS,
  DEMO_POLICIES,
  DEMO_SOURCES,
  DEMO_WORKSPACES,
  REAL_DOCUMENTS,
  documentContent,
} from "../src/server/compliance/corpus";

const db = createPrismaClient();

async function seedWorkspaces() {
  const workspaces = new Map<string, { id: string; name: string }>();

  for (const seed of DEMO_WORKSPACES) {
    const workspace = await db.workspace.upsert({
      where: { slug: seed.slug },
      update: { name: seed.name },
      create: { slug: seed.slug, name: seed.name },
    });
    workspaces.set(seed.slug, workspace);
  }

  return workspaces;
}

async function seedPeople(
  workspaces: Map<string, { id: string; name: string }>,
): Promise<Map<string, string>> {
  const userIds = new Map<string, string>();

  for (const persona of DEMO_PERSONAS) {
    const workspace = workspaces.get(persona.workspaceSlug);
    if (!workspace) {
      throw new Error(`Unknown workspace slug: ${persona.workspaceSlug}`);
    }

    const user = await db.user.upsert({
      where: { email: persona.email },
      update: { name: persona.name },
      create: { email: persona.email, name: persona.name },
    });

    await db.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      update: { role: persona.role as Role },
      create: {
        userId: user.id,
        workspaceId: workspace.id,
        role: persona.role as Role,
      },
    });

    await db.emailPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    userIds.set(persona.key, user.id);
  }

  return userIds;
}

async function seedRegister(workspaceId: string) {
  for (const policy of DEMO_POLICIES) {
    await db.internalPolicy.upsert({
      where: { workspaceId_code: { workspaceId, code: policy.code } },
      update: {
        title: policy.title,
        section: policy.section,
        text: policy.text,
        tags: policy.tags,
        attributes: policy.attributes as Prisma.InputJsonValue,
        ownerName: policy.ownerName,
        ownerEmail: policy.ownerEmail,
        reviewedAt: new Date("2026-09-30T00:00:00.000Z"),
      },
      create: {
        workspaceId,
        code: policy.code,
        title: policy.title,
        version: "v3.2",
        section: policy.section,
        text: policy.text,
        tags: policy.tags,
        attributes: policy.attributes as Prisma.InputJsonValue,
        ownerName: policy.ownerName,
        ownerEmail: policy.ownerEmail,
        reviewedAt: new Date("2026-09-30T00:00:00.000Z"),
      },
    });
  }

  for (const control of DEMO_CONTROLS) {
    await db.internalControl.upsert({
      where: { workspaceId_code: { workspaceId, code: control.code } },
      update: {
        title: control.title,
        description: control.text,
        tags: control.tags,
        attributes: control.attributes as Prisma.InputJsonValue,
        ownerName: control.ownerName,
        ownerEmail: control.ownerEmail,
        systemName: control.systemName ?? null,
        lastTestedAt: new Date("2026-10-15T00:00:00.000Z"),
      },
      create: {
        workspaceId,
        code: control.code,
        title: control.title,
        description: control.text,
        tags: control.tags,
        attributes: control.attributes as Prisma.InputJsonValue,
        ownerName: control.ownerName,
        ownerEmail: control.ownerEmail,
        systemName: control.systemName ?? null,
        lastTestedAt: new Date("2026-10-15T00:00:00.000Z"),
      },
    });
  }

  const policies = await db.internalPolicy.findMany({ where: { workspaceId } });
  const controls = await db.internalControl.findMany({ where: { workspaceId } });

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

  return {
    policies,
    controls,
    policyByCode: new Map(policies.map((policy) => [policy.code, policy])),
    controlByCode: new Map(controls.map((control) => [control.code, control])),
    policyRecords,
    controlRecords,
  };
}

const DEVANAGARI = /[\u0900-\u097F]/g;

/** The SEBI CSCRF attaches Hindi and English versions; embed the English text. */
function englishClauses(clauses: readonly SourceClause[]): SourceClause[] {
  return clauses.filter((clause) => {
    const dense = clause.text.replace(/\s+/g, "");
    if (dense.length === 0) {
      return false;
    }
    const devanagari = (clause.text.match(DEVANAGARI) ?? []).length;
    return devanagari / dense.length < 0.1;
  });
}

/** Embeds seeded clauses with the same provider and model the app uses. */
async function indexSeededDocument(workspaceId: string, documentId: string): Promise<void> {
  if (!isEmbeddingConfigured()) {
    await db.regulatoryDocument.update({
      where: { id: documentId },
      data: { indexStatus: "SKIPPED" },
    });
    console.log("  embedding skipped: GEMINI_API_KEY is not set");
    return;
  }

  const clauses = await db.documentClause.findMany({
    where: { workspaceId, documentId },
    orderBy: { orderIndex: "asc" },
    select: { id: true, text: true, sectionLabel: true, heading: true },
  });
  const model = embeddingModel();
  const CHUNK = 20;
  const BACKOFF_MS = [5_000, 15_000, 45_000];
  let embedded = 0;

  try {
    for (let start = 0; start < clauses.length; start += CHUNK) {
      const chunk = clauses.slice(start, start + CHUNK);
      let vectors: number[][] | null = null;
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= BACKOFF_MS.length && vectors === null; attempt += 1) {
        try {
          vectors = await embedTexts(
            chunk.map((clause) => {
              const prefix = [clause.sectionLabel, clause.heading].filter(Boolean).join(" — ");
              return prefix.length > 0 ? `${prefix}\n${clause.text}` : clause.text;
            }),
            { taskType: "RETRIEVAL_DOCUMENT", batchSize: CHUNK },
          );
        } catch (error) {
          lastError = error;
          const delay = BACKOFF_MS[attempt];
          if (delay === undefined) {
            break;
          }
          console.log(
            `  embedding throttled, retrying in ${delay / 1000}s: ${error instanceof Error ? error.message : "unknown error"}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (vectors === null) {
        throw lastError ?? new Error("The embedding request failed.");
      }
      if (vectors.length !== chunk.length) {
        throw new Error("Embedding count did not match the clause count.");
      }

      for (const [index, clause] of chunk.entries()) {
        const vector = vectors[index];
        if (!vector) {
          continue;
        }
        await db.$executeRaw(Prisma.sql`
          UPDATE "DocumentClause"
          SET "embedding" = ${toVectorLiteral(vector)}::vector,
              "embeddingModel" = ${model},
              "embeddedAt" = NOW()
          WHERE "id" = ${clause.id}
            AND "workspaceId" = ${workspaceId}
        `);
        embedded += 1;
      }

      // Gemini free tier throttles bursts; pace between chunks.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }

    await db.regulatoryDocument.update({
      where: { id: documentId },
      data: { indexStatus: "READY", indexedAt: new Date() },
    });
    console.log(`  embedded ${embedded} of ${clauses.length} clauses`);
  } catch (error) {
    await db.regulatoryDocument.update({
      where: { id: documentId },
      data: { indexStatus: "FAILED", indexedAt: new Date() },
    });
    console.error(
      `  embedding stopped after ${embedded} clauses, lexical retrieval remains: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

async function seedDocuments(
  workspaceId: string,
  register: Awaited<ReturnType<typeof seedRegister>>,
): Promise<number> {
  let findingCount = 0;

  const references = REAL_DOCUMENTS.map((documentSeed) => documentSeed.reference);
  const removed = await db.regulatoryDocument.deleteMany({
    where: { workspaceId, reference: { notIn: references } },
  });
  if (removed.count > 0) {
    console.log(`Removed ${removed.count} document(s) that are not part of the real corpus.`);
  }

  for (const documentSeed of REAL_DOCUMENTS) {
    const bytes = new Uint8Array(readFileSync(documentSeed.fixture));
    const extracted = await extractDocument({ contentType: documentSeed.contentType, bytes });
    const clauses = englishClauses(extracted.clauses);
    if (clauses.length === 0) {
      throw new Error(`No extractable clauses in ${documentSeed.fixture}.`);
    }

    const content = documentContent(clauses);
    const checksum = createHash("sha256").update(content).digest("hex");
    const fileChecksum = createHash("sha256").update(bytes).digest("hex");
    const filename = documentSeed.fixture.split("/").pop() ?? "document.pdf";

    console.log(
      `${documentSeed.reference}: ${extracted.pageCount} pages, ${clauses.length} English clauses`,
    );

    const document = await db.regulatoryDocument.upsert({
      where: {
        workspaceId_reference: { workspaceId, reference: documentSeed.reference },
      },
      update: {
        regulator: documentSeed.regulator,
        title: documentSeed.title,
        summary: documentSeed.summary,
        sourceUrl: documentSeed.sourceUrl,
        publishedAt: new Date(documentSeed.publishedAt),
        effectiveAt: new Date(documentSeed.effectiveAt),
        status: "ANALYZED",
        content,
        pageCount: extracted.pageCount,
        checksum,
        fileBytes: new Uint8Array(bytes),
        fileChecksum,
        filename,
        fileContentType: documentSeed.contentType,
        indexStatus: "PENDING",
        ingestedAt: DEMO_NOW,
      },
      create: {
        workspaceId,
        regulator: documentSeed.regulator,
        title: documentSeed.title,
        reference: documentSeed.reference,
        summary: documentSeed.summary,
        sourceUrl: documentSeed.sourceUrl,
        publishedAt: new Date(documentSeed.publishedAt),
        effectiveAt: new Date(documentSeed.effectiveAt),
        status: "ANALYZED",
        content,
        pageCount: extracted.pageCount,
        checksum,
        fileBytes: new Uint8Array(bytes),
        fileChecksum,
        filename,
        fileContentType: documentSeed.contentType,
        indexStatus: "PENDING",
        ingestedAt: DEMO_NOW,
      },
    });

    await db.obligation.deleteMany({ where: { workspaceId, documentId: document.id } });
    await db.documentClause.deleteMany({ where: { workspaceId, documentId: document.id } });

    for (const [index, clause] of clauses.entries()) {
      const clauseRow = await db.documentClause.create({
        data: {
          workspaceId,
          documentId: document.id,
          sectionLabel: clause.sectionLabel,
          heading: clause.heading ?? null,
          pageNumber: clause.pageNumber,
          orderIndex: index + 1,
          text: clause.text,
        },
      });

      const drafts: FindingDraft[] = analyzeClause({
        document: {
          key: documentSeed.key,
          regulator: documentSeed.regulator,
          reference: documentSeed.reference,
          effectiveAt: new Date(documentSeed.effectiveAt),
        },
        clause,
        clauseOrder: index + 1,
        policies: register.policyRecords,
        controls: register.controlRecords,
        now: DEMO_NOW,
      });

      for (const draft of drafts) {
        const obligation = await db.obligation.create({
          data: {
            workspaceId,
            documentId: document.id,
            clauseId: clauseRow.id,
            reference: draft.obligation.reference,
            plainLanguage: draft.obligation.plainLanguage,
            actionRequired: draft.obligation.actionRequired,
            applicableTo: draft.obligation.applicableTo,
            obligationType: draft.obligation.type,
            requirement: draft.obligation.requirement as unknown as Prisma.InputJsonValue,
            sla: draft.obligation.sla ?? null,
            effectiveDeadline: new Date(documentSeed.effectiveAt),
            extractionConfidence: draft.obligation.extractionConfidence,
            citationVerified: draft.obligation.citationVerified,
            criticNotes: draft.obligation.criticNotes,
          },
        });

        const policyCode = draft.mapping.policyCode;
        const controlCode = draft.mapping.controlCode;

        await db.finding.create({
          data: {
            workspaceId,
            obligationId: obligation.id,
            documentId: document.id,
            policyId: policyCode ? (register.policyByCode.get(policyCode)?.id ?? null) : null,
            controlId: controlCode ? (register.controlByCode.get(controlCode)?.id ?? null) : null,
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
            reviewStatus: draft.finding.reviewStatus as ReviewStatus,
          },
        });

        findingCount += 1;
      }
    }

    const auditCount = await db.auditLog.count({
      where: { workspaceId, action: "document.ingested", entityId: document.id },
    });

    if (auditCount === 0) {
      await db.auditLog.create({
        data: {
          workspaceId,
          action: "document.ingested",
          entity: "RegulatoryDocument",
          entityId: document.id,
          metadata: { reference: documentSeed.reference, clauses: clauses.length },
        },
      });
    }

    await indexSeededDocument(workspaceId, document.id);
  }

  return findingCount;
}

async function seedPreReviewedFinding(workspaceId: string, ownerId: string) {
  const logFinding =
    (await db.finding.findFirst({
      where: { workspaceId, obligation: { obligationType: "LOGGING" } },
      include: { obligation: true },
    })) ??
    (await db.finding.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { obligation: true },
    }));

  if (!logFinding) {
    return;
  }

  const reviewedAt = new Date("2026-11-12T10:15:00.000Z");
  const comments =
    "Approved the wording update. Budget for the extra control effort is tracked in the remediation plan.";

  await db.finding.update({
    where: { id: logFinding.id },
    data: {
      reviewStatus: "APPROVED_WITH_EDITS",
      reviewerId: ownerId,
      reviewerName: "Rajeshwari",
      reviewedAt,
      reviewComments: comments,
      approvedWording: logFinding.redlineAfter,
      updatedAt: reviewedAt,
    },
  });

  await db.reviewEvent.deleteMany({ where: { findingId: logFinding.id } });

  await db.reviewEvent.create({
    data: {
      workspaceId,
      findingId: logFinding.id,
      actorId: ownerId,
      actorName: "Rajeshwari",
      actorRole: "OWNER",
      action: PrismaReviewAction.APPROVED_WITH_EDITS,
      previous: { reviewStatus: "PENDING_REVIEW" },
      updated: {
        reviewStatus: "APPROVED_WITH_EDITS",
        approvedWording: logFinding.redlineAfter,
      },
      comments,
      createdAt: reviewedAt,
    },
  });

  const auditCount = await db.auditLog.count({
    where: { workspaceId, action: "finding.reviewed", entityId: logFinding.id },
  });

  if (auditCount === 0) {
    await db.auditLog.create({
      data: {
        workspaceId,
        actorId: ownerId,
        action: "finding.reviewed",
        entity: "Finding",
        entityId: logFinding.id,
        metadata: { decision: "APPROVED_WITH_EDITS", seeded: true },
        createdAt: reviewedAt,
      },
    });
  }
}

async function seedDataScans(workspaceId: string) {
  const results = scanCatalog(DEMO_DATA_CATALOG);

  for (const result of results) {
    await db.dataFieldScan.upsert({
      where: {
        workspaceId_datasetName_fieldName: {
          workspaceId,
          datasetName: result.datasetName,
          fieldName: result.fieldName,
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
        workspaceId,
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
  }

  return results.length;
}

async function seedWatchSources(workspaceId: string): Promise<number> {
  for (const source of DEMO_SOURCES) {
    await db.regulatorySource.upsert({
      where: { workspaceId_listingUrl: { workspaceId, listingUrl: source.listingUrl } },
      update: {
        name: source.name,
        regulator: source.regulator,
        kind: source.kind,
        allowedDomains: source.allowedDomains,
        linkPattern: source.linkPattern ?? null,
        schedule: source.schedule,
      },
      create: {
        workspaceId,
        name: source.name,
        regulator: source.regulator,
        kind: source.kind,
        listingUrl: source.listingUrl,
        allowedDomains: source.allowedDomains,
        linkPattern: source.linkPattern ?? null,
        schedule: source.schedule,
        enabled: source.enabled,
      },
    });
  }

  return DEMO_SOURCES.length;
}

async function main() {
  const workspaces = await seedWorkspaces();
  const userIds = await seedPeople(workspaces);

  const primary = workspaces.get("hexa-demo");
  const isolation = workspaces.get("northwind-assurance");
  const ownerId = userIds.get("owner");

  if (!primary || !isolation || !ownerId) {
    throw new Error("Demo workspaces or owner persona are missing.");
  }

  const register = await seedRegister(primary.id);
  const findingCount = await seedDocuments(primary.id, register);
  await seedPreReviewedFinding(primary.id, ownerId);
  const scanCount = await seedDataScans(primary.id);
  const sourceCount = await seedWatchSources(primary.id);

  const seededAudit = await db.auditLog.count({
    where: { workspaceId: primary.id, action: "workspace.seeded" },
  });

  if (seededAudit === 0) {
    await db.auditLog.create({
      data: {
        workspaceId: primary.id,
        actorId: ownerId,
        action: "workspace.seeded",
        entity: "Workspace",
        entityId: primary.id,
        metadata: { source: "prisma/seed.ts", documents: REAL_DOCUMENTS.length },
      },
    });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  await db.emailMessage.upsert({
    where: { idempotencyKey: `welcome:owner:seed` },
    update: {},
    create: {
      workspaceId: primary.id,
      userId: ownerId,
      toEmail: DEMO_PERSONAS[0]!.email,
      template: "welcome",
      subject: "Welcome to PolicyPulse",
      payload: { name: "Rajeshwari", loginUrl: `${appUrl}/signin` },
      idempotencyKey: "welcome:owner:seed",
    },
  });

  console.log(`Seeded "${primary.name}" and the isolation tenant "${isolation.name}".`);
  console.log(
    `${REAL_DOCUMENTS.length} real regulator documents, ${register.policies.length} policies, ${register.controls.length} controls, ${findingCount} findings, ${scanCount} data fields.`,
  );
  console.log(`${sourceCount} watch sources.`);
  console.log("Queued one welcome email. Process it with: npm run email:process");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
