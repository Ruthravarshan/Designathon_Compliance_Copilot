import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { ingestDocument } from "@/server/compliance/service";
import { MAX_ARCHIVE_BYTES } from "@/server/compliance/files";
import { db } from "@/server/db";
import { getStorageConnection } from "@/server/storage/connections";
import { getStorageProvider } from "@/server/storage";
import { extractDocument } from "@/server/watch/fetch";
import { assertSameOrigin, enforceLimit, ingestLimiter } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a real date.");

const bodySchema = z.object({
  connectionId: z.string().trim().min(1).max(64),
  itemId: z.string().trim().min(1).max(400),
  regulator: z.enum(["RBI", "SEBI", "IRDAI", "MEITY"]),
  title: z.string().trim().min(4).max(160),
  reference: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[A-Za-z0-9/._-]+$/, "Use letters, numbers, slashes, dots, or dashes."),
  summary: z.string().trim().min(20).max(600),
  publishedAt: dateString,
  effectiveAt: dateString.optional(),
});

async function readAll(body: ReadableStream, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new AppError(ERROR_CODES.BAD_REQUEST, "The file is larger than the 20 MB limit.", {
          status: 413,
        });
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("document:ingest");
    await enforceLimit(ingestLimiter, actor.userId);
    const body = await readJson(request, bodySchema);

    const duplicate = await db.regulatoryDocument.findFirst({
      where: {
        workspaceId: actor.workspaceId,
        OR: [{ reference: body.reference }, { storageItemId: body.itemId }],
      },
      select: { id: true, reference: true },
    });
    if (duplicate) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        `This file is already ingested as ${duplicate.reference}.`,
      );
    }

    const connection = await getStorageConnection(actor.workspaceId, body.connectionId);
    if (!connection) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "That storage connection does not exist.");
    }
    const provider = getStorageProvider(connection);

    const stat = provider.stat ? await provider.stat(body.itemId).catch(() => null) : null;
    const read = await provider.read({ itemId: body.itemId });
    const bytes = await readAll(read.body, MAX_ARCHIVE_BYTES);
    if (bytes.byteLength < 5 || Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
      throw new AppError(ERROR_CODES.BAD_REQUEST, "Only PDF files can be imported.");
    }

    const extracted = await extractDocument({
      finalUrl: stat?.webUrl ?? body.itemId,
      contentType: "application/pdf",
      bytes: Buffer.from(bytes),
    });
    if (extracted.clauses.length === 0) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        "No readable text layer was found in that PDF. Import a text-based PDF.",
      );
    }

    const fallbackHost =
      connection.provider === "GOOGLE_DRIVE"
        ? "https://drive.google.com/"
        : connection.provider === "SHAREPOINT"
          ? "https://www.microsoft365.com/"
          : "https://supabase.com/storage";

    const result = await ingestDocument(actor, {
      regulator: body.regulator,
      title: body.title,
      reference: body.reference,
      summary: body.summary,
      sourceUrl: stat?.webUrl ?? fallbackHost,
      publishedAt: body.publishedAt,
      ...(body.effectiveAt ? { effectiveAt: body.effectiveAt } : {}),
      pageCount: extracted.pageCount,
      content: extracted.text,
      clauses: extracted.clauses,
      file: {
        bytes,
        filename: stat?.name ?? "document.pdf",
        contentType: "application/pdf",
        storage: {
          connectionId: connection.id,
          itemId: body.itemId,
          webUrl: stat?.webUrl ?? "",
          path: stat?.name ?? "document.pdf",
          ...(stat?.modifiedAt ? { modifiedAt: new Date(stat.modifiedAt) } : {}),
        },
      },
    });

    return ok(result, { status: 201, headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
