import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { verifyOAuthState } from "@/lib/oauth-state";
import { recordAudit, requestMeta } from "@/server/audit";
import { getActor } from "@/server/auth/actor";
import { authSecret } from "@/server/auth/secret";
import {
  GMAIL_OAUTH_PATH,
  GMAIL_STATE_COOKIE,
  connectGmailAccount,
  isGmailConfigured,
} from "@/server/email/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stateMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) {
    return false;
  }
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();

  function back(query: string): NextResponse {
    const response = NextResponse.redirect(new URL(`/app/settings/email${query}`, env.APP_URL));
    response.cookies.set(GMAIL_STATE_COOKIE, "", { path: GMAIL_OAUTH_PATH, maxAge: 0 });
    return response;
  }

  if (url.searchParams.get("error")) {
    return back("?error=access_denied");
  }

  const cookieState = store.get(GMAIL_STATE_COOKIE)?.value;
  const queryState = url.searchParams.get("state");
  if (!stateMatches(cookieState, queryState)) {
    return back("?error=invalid_state");
  }

  const payload = verifyOAuthState(cookieState, authSecret());
  if (!payload) {
    return back("?error=invalid_state");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return back("?error=missing_code");
  }

  const actor = await getActor();
  if (
    !actor ||
    actor.userId !== payload.userId ||
    actor.workspaceId !== payload.workspaceId ||
    actor.role !== "OWNER"
  ) {
    return back("?error=not_authorized");
  }

  if (!isGmailConfigured()) {
    return back("?error=not_configured");
  }

  try {
    await connectGmailAccount({
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      code,
      redirectUri: payload.redirectUri,
    });

    const meta = requestMeta(request);
    await recordAudit({
      workspaceId: payload.workspaceId,
      actorId: payload.userId,
      action: "integration.gmail_connected",
      entity: "GmailAccount",
      entityId: payload.workspaceId,
      metadata: { provider: "gmail" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return back("?connected=1");
  } catch (error) {
    const code = error instanceof AppError ? error.code.toLowerCase() : "internal";
    return back(`?error=${code}`);
  }
}
