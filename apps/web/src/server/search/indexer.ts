import "server-only";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { embedTexts, embeddingModel, isEmbeddingConfigured } from "@/server/llm/embeddings";
import { toVectorLiteral } from "./vector";

export interface IndexDocumentResult {
  status: "READY" | "FAILED" | "SKIPPED";
  clauses: number;
  embedded: number;
}

function embeddingInput(clause: {
  sectionLabel: string;
  heading: string | null;
  text: string;
}): string {
  const prefix = [clause.sectionLabel, clause.heading].filter(Boolean).join(" — ");
  return prefix.length > 0 ? `${prefix}\n${clause.text}` : clause.text;
}

/**
 * Embeds every clause that lacks a current vector. Real database column, real
 * provider call: if the provider fails the document is marked FAILED and the
 * assistant falls back to BM25 rather than using invented vectors.
 */
export async function indexDocument(input: {
  workspaceId: string;
  documentId: string;
  force?: boolean;
}): Promise<IndexDocumentResult> {
  const document = await db.regulatoryDocument.findFirst({
    where: { id: input.documentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      clauses: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, text: true, sectionLabel: true, heading: true },
      },
    },
  });

  if (!document) {
    return { status: "SKIPPED", clauses: 0, embedded: 0 };
  }

  if (!isEmbeddingConfigured()) {
    await db.regulatoryDocument.update({
      where: { id: document.id },
      data: { indexStatus: "SKIPPED" },
    });
    return { status: "SKIPPED", clauses: document.clauses.length, embedded: 0 };
  }

  if (document.clauses.length === 0) {
    await db.regulatoryDocument.update({
      where: { id: document.id },
      data: { indexStatus: "READY", indexedAt: new Date() },
    });
    return { status: "READY", clauses: 0, embedded: 0 };
  }

  const model = embeddingModel();
  const pending = new Map(document.clauses.map((clause) => [clause.id, clause]));

  if (!input.force) {
    try {
      const current = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "DocumentClause"
        WHERE "documentId" = ${document.id}
          AND "workspaceId" = ${input.workspaceId}
          AND "embedding" IS NOT NULL
          AND "embeddingModel" = ${model}
      `);
      for (const row of current) {
        pending.delete(row.id);
      }
    } catch (error) {
      logger.warn(
        { documentId: document.id, errorName: error instanceof Error ? error.name : "UnknownError" },
        "could not read existing clauses; re-embedding",
      );
    }
  }

  if (pending.size === 0) {
    await db.regulatoryDocument.update({
      where: { id: document.id },
      data: { indexStatus: "READY", indexedAt: new Date() },
    });
    return { status: "READY", clauses: document.clauses.length, embedded: 0 };
  }

  const targets = [...pending.values()];
  let embedded = 0;

  try {
    const vectors = await embedTexts(targets.map(embeddingInput), {
      taskType: "RETRIEVAL_DOCUMENT",
    });
    if (vectors.length !== targets.length) {
      throw new Error("Embedding count did not match the clause count.");
    }

    for (const [index, clause] of targets.entries()) {
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
          AND "workspaceId" = ${input.workspaceId}
      `);
      embedded += 1;
    }

    await db.regulatoryDocument.update({
      where: { id: document.id },
      data: { indexStatus: "READY", indexedAt: new Date() },
    });

    logger.info(
      { documentId: document.id, clauses: document.clauses.length, embedded },
      "document indexed",
    );
    return { status: "READY", clauses: document.clauses.length, embedded };
  } catch (error) {
    await db.regulatoryDocument.update({
      where: { id: document.id },
      data: { indexStatus: "FAILED", indexedAt: new Date() },
    });
    logger.warn(
      {
        documentId: document.id,
        clauses: document.clauses.length,
        embedded,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "document indexing failed; lexical retrieval remains available",
    );
    return { status: "FAILED", clauses: document.clauses.length, embedded };
  }
}
