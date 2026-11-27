import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { assertSameOrigin, enforceLimit, ingestLimiter } from "@/server/rate-limits";
import { ingestFromUrl } from "@/server/watch/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  url: z
    .string()
    .trim()
    .max(500)
    .regex(/^https?:\/\/[^\s]+$/i, "Enter an http(s) URL."),
  regulator: z.enum(["RBI", "SEBI", "IRDAI", "MEITY"]).optional(),
  title: z.string().trim().min(4).max(160).optional(),
});

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("watch:manage");
    await enforceLimit(ingestLimiter, actor.userId);
    const body = await readJson(request, bodySchema);
    const result = await ingestFromUrl(actor, body);
    return ok(result, { status: 201, headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
