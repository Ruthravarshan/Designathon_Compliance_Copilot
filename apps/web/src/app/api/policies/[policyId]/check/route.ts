import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail, ok } from "@/lib/http";
import { apiHeaders, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { assertSameOrigin, enforceLimit, reviewLimiter } from "@/server/rate-limits";
import { checkPolicyCompliance } from "@/server/policy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ policyId: string }> }) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("policy:check");
    await enforceLimit(reviewLimiter, actor.userId);

    const { policyId } = await context.params;
    if (!/^[a-z0-9]{10,64}$/i.test(policyId)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, "That policy id is not valid.");
    }

    const result = await checkPolicyCompliance(actor, policyId);
    return ok(result, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
