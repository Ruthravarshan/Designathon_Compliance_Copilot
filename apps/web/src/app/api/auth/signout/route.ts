import { fail, ok } from "@/lib/http";
import { apiHeaders, requestIdFor } from "@/server/api";
import { getActor } from "@/server/auth/actor";
import { clearSession } from "@/server/auth/session";
import { recordAudit, requestMeta } from "@/server/audit";
import { db } from "@/server/db";
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
      // Invalidate the token server-side too; clearing only the browser cookie
      // leaves a copied session usable until it expires.
      await db.user.update({
        where: { id: actor.userId },
        data: { sessionVersion: { increment: 1 } },
      });
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
