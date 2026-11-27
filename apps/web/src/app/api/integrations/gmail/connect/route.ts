import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { signOAuthState } from "@/lib/oauth-state";
import { requireActor } from "@/server/auth/actor";
import { authSecret } from "@/server/auth/secret";
import {
  GMAIL_OAUTH_PATH,
  GMAIL_STATE_COOKIE,
  GMAIL_STATE_TTL_SECONDS,
  createGmailConnectUrl,
  isGmailConfigured,
  resolveRedirectUri,
} from "@/server/email/gmail";
import { assertSameOrigin, authLimiter, enforceLimit } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settingsRedirect(query: string): NextResponse {
  return NextResponse.redirect(new URL(`/app/settings/email${query}`, env.APP_URL));
}

export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor("email:send");
    await enforceLimit(authLimiter, actor.userId);
    if (actor.role !== "OWNER") {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        "Only the workspace owner can connect the sending mailbox.",
      );
    }

    if (!isGmailConfigured()) {
      throw new AppError(
        ERROR_CODES.INTERNAL,
        "Gmail sending is not configured on this deployment.",
        { status: 503 },
      );
    }

    const origin = env.APP_URL;
    const state = signOAuthState(
      {
        nonce: randomUUID(),
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        redirectUri: resolveRedirectUri(origin),
      },
      authSecret(),
    );

    const { url } = createGmailConnectUrl({ origin, state, loginHint: actor.email });

    const response = NextResponse.redirect(url);
    response.cookies.set(GMAIL_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: GMAIL_OAUTH_PATH,
      maxAge: GMAIL_STATE_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    const code = error instanceof AppError ? error.code.toLowerCase() : "internal";
    return settingsRedirect(`?error=${code}`);
  }
}
