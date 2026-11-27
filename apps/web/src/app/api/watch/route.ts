import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { assertSameOrigin, enforceLimit, reviewLimiter } from "@/server/rate-limits";
import { listWatchOverview, toggleSource } from "@/server/watch/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  sourceId: z.string().trim().min(1).max(64),
  enabled: z.boolean(),
});

export async function GET() {
  const requestId = requestIdFor();

  try {
    const actor = await requireActor("watch:read");
    const overview = await listWatchOverview(actor);
    return ok(overview, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("watch:manage");
    await enforceLimit(reviewLimiter, actor.userId);
    const body = await readJson(request, patchSchema);
    await toggleSource(actor, body.sourceId, body.enabled);
    return ok(
      { sourceId: body.sourceId, enabled: body.enabled },
      { headers: apiHeaders(requestId) },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
