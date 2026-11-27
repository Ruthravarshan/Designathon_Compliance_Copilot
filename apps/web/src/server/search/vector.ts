import "server-only";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { toVectorLiteral } from "@/lib/search/vector";
import { db } from "@/server/db";

export interface VectorHit {
  id: string;
  similarity: number;
}

export { toVectorLiteral };

/**
 * Top-K cosine matches for one workspace. An unavailable extension or a missing
 * column degrades to an empty result so the caller can use BM25 alone; it never
 * fails the question.
 */
export async function searchClauseVectors(
  workspaceId: string,
  vector: readonly number[],
  limit = 24,
): Promise<VectorHit[]> {
  if (vector.length === 0) {
    return [];
  }

  const literal = toVectorLiteral(vector);
  const bounded = Math.min(Math.max(limit, 1), 100);

  try {
    const rows = await db.$queryRaw<Array<{ id: string; similarity: number }>>(Prisma.sql`
      SELECT c."id" AS id, (1 - (c."embedding" <=> ${literal}::vector))::float8 AS similarity
      FROM "DocumentClause" c
      INNER JOIN "RegulatoryDocument" d ON d."id" = c."documentId"
      WHERE c."workspaceId" = ${workspaceId}
        AND c."embedding" IS NOT NULL
        AND d."status" <> 'ARCHIVED'
      ORDER BY c."embedding" <=> ${literal}::vector
      LIMIT ${bounded}
    `);
    return rows
      .map((row) => ({ id: row.id, similarity: Number(row.similarity) }))
      .filter((row) => Number.isFinite(row.similarity));
  } catch (error) {
    logger.warn(
      {
        errorName: error instanceof Error ? error.name : "UnknownError",
        code:
          error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "VECTOR_UNAVAILABLE",
      },
      "vector search unavailable; using lexical retrieval",
    );
    return [];
  }
}
