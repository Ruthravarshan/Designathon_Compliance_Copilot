import { fail, ok } from "@/lib/http";
import { apiHeaders, requestIdFor } from "@/server/api";
import { getActor } from "@/server/auth/actor";
import { clearSession } from "@/server/auth/session";
import { recordAudit, requestMeta } from "@/server/audit";
import { assertSameOrigin } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await getActor();
    await clearSession();

    if (actor) {
      const meta = requestMeta(request);
      await recordAudit({
        workspaceId: actor.workspaceId,
        actorId: actor.userId,
        action: "auth.signed_out",
        entity: "User",
        entityId: actor.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    return ok({ signedOut: true }, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
