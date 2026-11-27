"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Play, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface PolicyCheckResponse {
  data?: {
    result: string;
    score: number;
    openFindings: number;
    notified: number;
    summary: string;
  };
  error?: { message?: string };
}

export function PolicyCheckButton({
  policyId,
  compact = false,
}: {
  policyId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function runCheck() {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/policies/${policyId}/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await response.json().catch(() => ({}))) as PolicyCheckResponse;
      if (!response.ok || !body.data) {
        setFeedback({
          kind: "err",
          text: body.error?.message ?? "Policy compliance check failed.",
        });
        return;
      }
      const { result, score, notified } = body.data;
      setFeedback({
        kind: "ok",
        text: `${result.replace(/_/g, " ")} (${score}/100)${notified > 0 ? ` · ${notified} alert queued` : ""}`,
      });
      router.refresh();
    } catch {
      setFeedback({ kind: "err", text: "Server did not respond. Retry." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant={compact ? "secondary" : "primary"}
        size={compact ? "sm" : "default"}
        pending={pending}
        pendingLabel="Checking..."
        onClick={() => void runCheck()}
      >
        <Play size={13} weight="fill" aria-hidden="true" />
        Run check
      </Button>
      {feedback ? (
        <p
          role={feedback.kind === "err" ? "alert" : "status"}
          className={
            feedback.kind === "err"
              ? "inline-flex items-center gap-1 text-[11px] text-danger"
              : "inline-flex items-center gap-1 font-mono text-[11px] text-brand dark:text-support"
          }
        >
          {feedback.kind === "err" ? (
            <WarningCircle size={12} weight="bold" aria-hidden="true" />
          ) : (
            <CheckCircle size={12} weight="bold" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </p>
      ) : null}
    </div>
  );
}
