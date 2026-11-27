import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { reviewFinding } from "@/server/compliance/service";
import { assertSameOrigin, enforceLimit, reviewLimiter } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["APPROVED", "APPROVED_WITH_EDITS", "REJECTED"]),
  comments: z.string().trim().max(2000).default(""),
  approvedWording: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("finding:review");
    await enforceLimit(reviewLimiter, actor.userId);

    const { id } = await context.params;
    if (!/^[a-z0-9]{10,64}$/i.test(id)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, "That finding id is not valid.");
    }
    const body = await readJson(request, bodySchema);

    const result = await reviewFinding(actor, id, {
      action: body.action,
      comments: body.comments,
      ...(body.approvedWording ? { approvedWording: body.approvedWording } : {}),
    });

    return ok(result, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
