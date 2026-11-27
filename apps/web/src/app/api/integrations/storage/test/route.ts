import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { assertSameOrigin, enforceLimit, storageLimiter } from "@/server/rate-limits";
import { testStorageConnection } from "@/server/storage/connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().trim().min(1) });

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("storage:manage");
    await enforceLimit(storageLimiter, actor.userId);
    const body = await readJson(request, bodySchema);
    const result = await testStorageConnection({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      id: body.id,
    });

    return ok(result, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}