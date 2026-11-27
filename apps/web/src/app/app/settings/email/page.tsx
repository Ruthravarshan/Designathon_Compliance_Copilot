import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowClockwise,
  EnvelopeSimple,
  PaperPlaneTilt,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { GmailConnectionActions } from "@/components/gmail-connection";
import { UnauthorizedState } from "@/components/unauthorized-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { actorCan, getActor } from "@/server/auth/actor";
import { getGmailStatus } from "@/server/email/gmail";

export const metadata: Metadata = { title: "Email settings" };
export const dynamic = "force-dynamic";

const CONNECT_HREF = "/api/integrations/gmail/connect";

const ERROR_COPY: Record<string, string> = {
  access_denied: "Google access was cancelled. No mailbox was connected.",
  invalid_state: "The sign-in request expired or did not match this browser. Start again.",
  missing_code: "Google did not return an authorization code. Start again.",
  not_authorized: "Only the signed-in workspace owner can finish connecting the mailbox.",
  not_configured: "Gmail sending is not configured on this deployment yet.",
  forbidden: "Only the workspace owner can connect the sending mailbox.",
  unauthorized: "Sign in again to connect the mailbox.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  conflict: "Google could not complete the connection. Start again.",
  bad_request: "Google rejected the request. Start again.",
  internal: "The Gmail connection could not be completed. Try again.",
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }
  if (!actorCan(actor, "email:send")) {
    return <UnauthorizedState signedInAs={`${actor.name} · ${actor.role}`} />;
  }

  const params = await searchParams;
  const status = await getGmailStatus(actor.workspaceId);
  const canManage = actor.role === "OWNER";
  const errorMessage = params.error
    ? (ERROR_COPY[params.error] ?? "The Gmail connection did not complete. Try again.")
    : null;
  const connectedNow = params.connected === "1";

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Workbench / Settings / Email
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Sending mailbox
          </h1>
          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">
            PolicyPulse sends automated email through a Gmail account you connect with Google OAuth.
            It never asks for the Gmail password or an App Password.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status.connected ? (
            <Badge tone="brand" dot>
              Connected
            </Badge>
          ) : (
            <Badge tone="outline">
              {status.status === "REVOKED" ? "Revoked" : "Not connected"}
            </Badge>
          )}
          <Badge tone="outline">Gmail API</Badge>
        </div>
      </header>

      {connectedNow ? (
        <div
          role="status"
          className="rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm text-brand"
        >
          Gmail connected. Send a test email to confirm delivery.
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <WarningCircle size={18} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <EnvelopeSimple size={18} weight="bold" aria-hidden="true" className="text-brand" />
            <h2 className="text-base font-medium">Sending mailbox</h2>
          </div>

          {status.connected && status.email ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Address
                </dt>
                <dd className="font-mono text-xs text-fg">{status.email}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Access token expires
                </dt>
                <dd className="text-xs text-muted">{formatTimestamp(status.expiresAt)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Last refreshed
                </dt>
                <dd className="text-xs text-muted">{formatTimestamp(status.lastRefreshedAt)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Scope
                </dt>
                <dd className="break-all font-mono text-[10px] text-muted">{status.scope}</dd>
              </div>
            </dl>
          ) : (
            <div className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-6 text-center">
              <p className="text-sm font-medium">No mailbox connected</p>
              <p className="mx-auto mt-1 max-w-[42ch] text-xs leading-relaxed text-muted">
                {status.configured
                  ? "Connect a Gmail account to start sending automated email from this workspace."
                  : "This deployment is missing the Google OAuth configuration. Add the three variables listed below and redeploy."}
              </p>
            </div>
          )}

          {status.lastErrorCode && status.status !== "CONNECTED" ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-danger">
              Last error · {status.lastErrorCode}
            </p>
          ) : null}

          <div className="mt-5 space-y-3 border-t border-line pt-5">
            {!status.configured ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs leading-relaxed text-danger">
                Set <code className="font-mono">GOOGLE_CLIENT_ID</code>,{" "}
                <code className="font-mono">GOOGLE_CLIENT_SECRET</code>, and{" "}
                <code className="font-mono">TOKEN_ENCRYPTION_KEY</code>, then set{" "}
                <code className="font-mono">EMAIL_PROVIDER=gmail</code>. Full steps are in{" "}
                <code className="font-mono">docs/GMAIL-OAUTH.md</code>.
              </div>
            ) : null}

            {canManage && status.configured ? (
              <a
                href={CONNECT_HREF}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover"
              >
                <PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />
                {status.connected ? "Reconnect Gmail" : "Connect Gmail"}
              </a>
            ) : null}

            {!canManage ? (
              <p className="text-xs leading-relaxed text-muted">
                Only the workspace owner can connect, reconnect, or disconnect the mailbox. You can
                still send a test email once it is connected.
              </p>
            ) : null}

            <GmailConnectionActions
              connected={status.connected}
              canManage={canManage}
              recipient={actor.email}
            />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-medium">How sending works</h2>
          <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
            <li className="flex gap-2.5">
              <ArrowClockwise
                size={15}
                weight="bold"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-brand"
              />
              <span>
                Access tokens are refreshed automatically before they expire. A revoked refresh
                token marks the connection and asks the owner to reconnect.
              </span>
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck
                size={15}
                weight="bold"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-brand"
              />
              <span>
                Access and refresh tokens are encrypted at rest with AES-256-GCM. They never reach
                the browser or the logs.
              </span>
            </li>
            <li className="flex gap-2.5">
              <PaperPlaneTilt
                size={15}
                weight="bold"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-brand"
              />
              <span>
                Product email is written to the outbox first. The cron worker drains the queue
                through the Gmail API, so a failed send retries instead of blocking a request.
              </span>
            </li>
            <li className="flex gap-2.5">
              <EnvelopeSimple
                size={15}
                weight="bold"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-brand"
              />
              <span>
                The requested scope is <code className="font-mono">gmail.send</code> only.
                PolicyPulse can send mail but cannot read the mailbox.
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
