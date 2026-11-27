import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { signInWithPersona } from "@/server/auth/sign-in";
import { assertSameOrigin, authLimiter, clientKey, enforceLimit } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  persona: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    await enforceLimit(authLimiter, clientKey(request));
    const body = await readJson(request, bodySchema);
    const actor = await signInWithPersona(body.persona, request);

    return ok(
      {
        name: actor.name,
        role: actor.role,
        workspace: actor.workspaceName,
        workspaceSlug: actor.workspaceSlug,
      },
      { headers: apiHeaders(requestId) },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
