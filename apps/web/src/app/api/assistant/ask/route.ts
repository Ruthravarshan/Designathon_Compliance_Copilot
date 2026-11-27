import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { askComplianceQuestion } from "@/server/compliance/service";
import { assertSameOrigin, assistantLimiter, enforceLimit } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question: z.string().trim().min(8, "Ask a full question.").max(500),
});

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("assistant:ask");
    await enforceLimit(assistantLimiter, actor.userId);
    const body = await readJson(request, bodySchema);
    const answer = await askComplianceQuestion(actor, body.question);

    return ok(answer, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
