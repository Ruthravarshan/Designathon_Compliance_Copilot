import { createHash } from "node:crypto";
import { Prisma, ReviewAction as PrismaReviewAction, ReviewStatus, Role } from "@prisma/client";
import { analyzeClause } from "../src/lib/compliance/pipeline";
import { scanCatalog } from "../src/lib/compliance/data-scan";
import type { ComplianceRecord, FindingDraft } from "../src/lib/compliance/types";
import { createPrismaClient } from "../src/server/prisma-client";
import {
  DEMO_CONTROLS,
  DEMO_DATA_CATALOG,
  DEMO_DOCUMENTS,
  DEMO_NOW,
  DEMO_PERSONAS,
  DEMO_POLICIES,
  DEMO_WORKSPACES,
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

async function seedDocuments(
  workspaceId: string,
  register: Awaited<ReturnType<typeof seedRegister>>,
): Promise<number> {
  let findingCount = 0;

  for (const documentSeed of DEMO_DOCUMENTS) {
    const content = documentContent(documentSeed.clauses);
    const checksum = createHash("sha256").update(content).digest("hex");

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
        pageCount: documentSeed.pageCount,
        checksum,
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
        pageCount: documentSeed.pageCount,
        checksum,
        ingestedAt: DEMO_NOW,
      },
    });

    await db.obligation.deleteMany({ where: { workspaceId, documentId: document.id } });
    await db.documentClause.deleteMany({ where: { workspaceId, documentId: document.id } });

    for (const [index, clause] of documentSeed.clauses.entries()) {
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
          metadata: { reference: documentSeed.reference, clauses: documentSeed.clauses.length },
        },
      });
    }
  }

  return findingCount;
}

async function seedPreReviewedFinding(workspaceId: string, ownerId: string) {
  const logFinding = await db.finding.findFirst({
    where: { workspaceId, obligation: { obligationType: "LOGGING" } },
    include: { obligation: true },
  });

  if (!logFinding) {
    return;
  }

  const reviewedAt = new Date("2026-11-12T10:15:00.000Z");
  const comments =
    "Approved the 180-day log retention edit. Budget for the extra storage is tracked under CTRL-SEC-09 follow-up.";

  await db.finding.update({
    where: { id: logFinding.id },
    data: {
      reviewStatus: "APPROVED_WITH_EDITS",
      reviewerId: ownerId,
      reviewerName: "Meera Krishnan",
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
      actorName: "Meera Krishnan",
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
        metadata: { source: "prisma/seed.ts", documents: DEMO_DOCUMENTS.length },
      },
    });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  await db.emailMessage.upsert({
    where: { idempotencyKey: `welcome:meera:seed` },
    update: {},
    create: {
      workspaceId: primary.id,
      userId: ownerId,
      toEmail: DEMO_PERSONAS[0]!.email,
      template: "welcome",
      subject: "Welcome to Hexa Compliance Copilot",
      payload: { name: "Meera", loginUrl: `${appUrl}/signin` },
      idempotencyKey: "welcome:meera:seed",
    },
  });

  console.log(`Seeded "${primary.name}" and the isolation tenant "${isolation.name}".`);
  console.log(
    `${DEMO_DOCUMENTS.length} circulars, ${register.policies.length} policies, ${register.controls.length} controls, ${findingCount} findings, ${scanCount} data fields.`,
  );
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
