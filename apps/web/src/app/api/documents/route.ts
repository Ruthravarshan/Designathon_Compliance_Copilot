import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { ingestDocument, listDocuments } from "@/server/compliance/service";
import { MAX_ARCHIVE_BYTES } from "@/server/compliance/files";
import { extractDocument } from "@/server/watch/fetch";
import { assertSameOrigin, enforceLimit, ingestLimiter } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a real date.");

const metaSchema = z.object({
  regulator: z.enum(["RBI", "SEBI", "IRDAI", "MEITY"]),
  title: z.string().trim().min(4).max(160),
  reference: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[A-Za-z0-9/._-]+$/, "Use letters, numbers, slashes, dots, or dashes."),
  summary: z.string().trim().min(20).max(600),
  sourceUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^https?:\/\/[^\s]+$/, "Enter an http(s) source URL."),
  publishedAt: dateString,
  effectiveAt: dateString.optional(),
  pageCount: z.number().int().min(1).max(5000).optional(),
});

const jsonBodySchema = metaSchema.extend({
  content: z.string().trim().min(80).max(50_000),
});

function optionalText(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function numberField(form: FormData, key: string): number | undefined {
  const raw = optionalText(form, key);
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readIngestInput(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    const body = await readJson(request, jsonBodySchema);
    return { meta: body, content: body.content, clauses: undefined, file: undefined };
  }

  const declared = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declared) && declared > MAX_ARCHIVE_BYTES + 2_000_000) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The upload is larger than the 20 MB limit.", {
      status: 413,
    });
  }

  const form = await request.formData();
  const parsed = metaSchema.safeParse({
    regulator: form.get("regulator"),
    title: form.get("title"),
    reference: form.get("reference"),
    summary: form.get("summary"),
    sourceUrl: form.get("sourceUrl"),
    publishedAt: form.get("publishedAt"),
    effectiveAt: optionalText(form, "effectiveAt"),
    pageCount: numberField(form, "pageCount"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError(
      ERROR_CODES.BAD_REQUEST,
      issue ? `${issue.path.join(".")}: ${issue.message}` : "The upload fields are invalid.",
    );
  }
  const meta = parsed.data;

  const upload = form.get("file");
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > MAX_ARCHIVE_BYTES) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, "The PDF is larger than the 20 MB limit.", {
        status: 413,
      });
    }
    const bytes = Buffer.from(await upload.arrayBuffer());
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new AppError(ERROR_CODES.BAD_REQUEST, "Upload a PDF file.");
    }
    const extracted = await extractDocument({
      finalUrl: meta.sourceUrl,
      contentType: "application/pdf",
      bytes,
    });
    if (extracted.clauses.length === 0) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        "No readable text layer was found in that PDF. Upload a text-based PDF.",
      );
    }
    return {
      meta: { ...meta, pageCount: meta.pageCount ?? extracted.pageCount },
      content: extracted.text,
      clauses: extracted.clauses,
      file: { bytes, filename: upload.name || "document.pdf", contentType: "application/pdf" },
    };
  }

  const content = optionalText(form, "content");
  if (!content || content.length < 80) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "Attach a PDF or paste at least 80 characters.");
  }
  return { meta, content, clauses: undefined, file: undefined };
}

export async function GET() {
  const requestId = requestIdFor();

  try {
    const actor = await requireActor("document:read");
    const documents = await listDocuments(actor);
    return ok(
      documents.map((document) => ({
        ...document,
        publishedAt: document.publishedAt.toISOString(),
        effectiveAt: document.effectiveAt?.toISOString() ?? null,
      })),
      { headers: apiHeaders(requestId) },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("document:ingest");
    await enforceLimit(ingestLimiter, actor.userId);
    const input = await readIngestInput(request);

    const result = await ingestDocument(actor, {
      ...input.meta,
      content: input.content,
      ...(input.clauses ? { clauses: input.clauses } : {}),
      ...(input.file ? { file: input.file } : {}),
    });

    return ok(result, { status: 201, headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
