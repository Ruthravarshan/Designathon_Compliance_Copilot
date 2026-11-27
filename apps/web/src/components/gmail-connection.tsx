"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, PaperPlaneTilt, Plugs } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/ui/overlays";

interface ApiErrorBody {
  error?: { message?: string; requestId?: string };
}

type Pending = "test" | "disconnect" | null;

export function GmailConnectionActions({
  connected,
  canManage,
  recipient,
}: {
  connected: boolean;
  canManage: boolean;
  recipient: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  async function sendTest() {
    setPending("test");
    setFeedback(null);

    try {
      const response = await fetch("/api/integrations/gmail/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as ApiErrorBody;
        setFeedback({
          kind: "error",
          message: result.error?.message ?? "The test email could not be sent.",
        });
        return;
      }

      setFeedback({ kind: "ok", message: `Test email sent to ${recipient}.` });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "The server did not respond. Try again." });
    } finally {
      setPending(null);
    }
  }

  async function disconnect() {
    setPending("disconnect");
    setFeedback(null);

    try {
      const response = await fetch("/api/integrations/gmail/disconnect", { method: "POST" });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as ApiErrorBody;
        setFeedback({
          kind: "error",
          message: result.error?.message ?? "The mailbox could not be disconnected.",
        });
        return;
      }

      setConfirmOpen(false);
      setFeedback({ kind: "ok", message: "Mailbox disconnected." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "The server did not respond. Try again." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={sendTest}
          disabled={!connected || pending !== null}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "test" ? (
            <>
              <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden="true" />
              Sending
            </>
          ) : (
            <>
              <PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />
              Send test email
            </>
          )}
        </button>

        {canManage && connected ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={pending !== null}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-medium text-fg transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "disconnect" ? (
              <>
                <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden="true" />
                Disconnecting
              </>
            ) : (
              <>
                <Plugs size={16} weight="bold" aria-hidden="true" />
                Disconnect
              </>
            )}
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Disconnect Gmail mailbox"
        description="Automated remediation and alert emails will stop until you reconnect an OAuth mailbox."
        confirmLabel="Disconnect mailbox"
        variant="danger"
        pending={pending === "disconnect"}
        onConfirm={() => void disconnect()}
        onClose={() => setConfirmOpen(false)}
      />

      {feedback ? (
        <p
          role={feedback.kind === "ok" ? "status" : "alert"}
          className={
            feedback.kind === "ok"
              ? "rounded-xl border border-brand/25 bg-brand/10 px-4 py-3 text-xs text-fg dark:border-support/35 dark:bg-support/15"
              : "rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-xs text-fg"
          }
        >
          {feedback.kind === "error" ? <span className="font-semibold">Error: </span> : null}
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
