import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail, ok } from "@/lib/http";
import { apiHeaders, requestIdFor } from "@/server/api";
import { recordAudit, requestMeta } from "@/server/audit";
import { requireActor } from "@/server/auth/actor";
import { disconnectGmail } from "@/server/email/gmail";
import { assertSameOrigin, authLimiter, clientKey, enforceLimit } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    await enforceLimit(authLimiter, clientKey(request));

    const actor = await requireActor("email:send");
    if (actor.role !== "OWNER") {
      throw new AppError(ERROR_CODES.FORBIDDEN, "Only the workspace owner can disconnect Gmail.");
    }

    const removed = await disconnectGmail(actor.workspaceId);

    if (removed) {
      const meta = requestMeta(request);
      await recordAudit({
        workspaceId: actor.workspaceId,
        actorId: actor.userId,
        action: "integration.gmail_disconnected",
        entity: "GmailAccount",
        entityId: actor.workspaceId,
        metadata: { provider: "gmail" },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    return ok({ disconnected: removed }, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
