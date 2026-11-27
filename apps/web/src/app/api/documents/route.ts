import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { ingestDocument, listDocuments } from "@/server/compliance/service";
import { assertSameOrigin, enforceLimit, ingestLimiter } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a real date.");

const bodySchema = z.object({
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
  content: z.string().trim().min(80).max(50_000),
});

export async function GET(request: Request) {
  const requestId = requestIdFor();

  try {
    const actor = await requireActor("document:read");
    const rawCursor = new URL(request.url).searchParams.get("cursor");
    const cursor = rawCursor && /^[A-Za-z0-9_-]+$/.test(rawCursor) ? rawCursor : undefined;
    const page = await listDocuments(actor, { cursor });
    return ok(
      {
        items: page.items.map((document) => ({
          ...document,
          publishedAt: document.publishedAt.toISOString(),
          effectiveAt: document.effectiveAt?.toISOString() ?? null,
        })),
        nextCursor: page.nextCursor,
      },
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
    const body = await readJson(request, bodySchema);

    const result = await ingestDocument(actor, body);

    return ok(result, { status: 201, headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
