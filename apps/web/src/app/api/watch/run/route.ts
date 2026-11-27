import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail, ok } from "@/lib/http";
import { apiHeaders, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { assertSameOrigin, enforceLimit, watchLimiter } from "@/server/rate-limits";
import { runWatch } from "@/server/watch/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  sourceId: z.string().trim().min(1).max(64).optional(),
});

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("watch:run");
    await enforceLimit(watchLimiter, actor.userId);

    const raw = await request.text();
    let body: z.infer<typeof bodySchema> = {};
    if (raw.trim() !== "") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new AppError(ERROR_CODES.BAD_REQUEST, "Invalid JSON body.");
      }
      body = bodySchema.parse(parsed);
    }

    const result = await runWatch({
      workspaceId: actor.workspaceId,
      trigger: "MANUAL",
      actor,
      ...(body.sourceId ? { sourceId: body.sourceId } : {}),
    });

    return ok(result, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
