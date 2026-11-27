import { fail, ok } from "@/lib/http";
import { apiHeaders, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { getGmailStatus } from "@/server/email/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFor();

  try {
    const actor = await requireActor("email:send");
    const checkLive = new URL(request.url).searchParams.get("check") === "1";
    const status = await getGmailStatus(actor.workspaceId, { checkLive });

    return ok(status, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
