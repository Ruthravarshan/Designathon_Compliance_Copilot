"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ApiErrorBody {
  error?: { message?: string };
}

interface CheckResult {
  result: string;
  score: number;
  openFindings: number;
  critical: number;
  high: number;
  overdue: number;
  summary: string;
  notified: number;
}

const TONE: Record<string, "brand" | "danger" | "outline"> = {
  COMPLIANT: "brand",
  AT_RISK: "outline",
  GAPS: "danger",
};

export function PolicyCheckButton({
  policyId,
  compact = false,
}: {
  policyId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  async function check() {
    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/policies/${policyId}/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        const parsed = (await response.json().catch(() => ({}))) as ApiErrorBody;
        setError(parsed.error?.message || "The compliance check could not run.");
        return;
      }
      const parsed = (await response.json()) as { data?: CheckResult };
      if (parsed.data) {
        setResult(parsed.data);
      }
      router.refresh();
    } catch {
      setError("The server did not respond. Check the connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      <Button
        variant={compact ? "secondary" : "primary"}
        size={compact ? "sm" : "default"}
        onClick={() => void check()}
        pending={pending}
        pendingLabel="Checking…"
      >
        <ShieldCheck size={15} weight="bold" aria-hidden="true" />
        Check compliance
      </Button>
      <span
        aria-live="polite"
        className="max-w-[46ch] text-left text-xs leading-relaxed lg:text-right"
      >
        {error ? (
          <span className="inline-flex items-start gap-1.5 text-fg">
            <WarningCircle
              size={13}
              weight="fill"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-danger"
            />
            <span>
              <span className="font-semibold">Error:</span> {error}
            </span>
          </span>
        ) : result ? (
          <span className="inline-flex flex-wrap items-center justify-start gap-2 text-muted lg:justify-end">
            <Badge tone={TONE[result.result] ?? "outline"} dot>
              {result.result.replace(/_/g, " ")} · {result.score}/100
            </Badge>
            <span>
              {result.openFindings} open · {result.critical} critical · {result.high} high ·{" "}
              {result.overdue} overdue
              {result.notified > 0 ? ` · ${result.notified} alert email queued` : ""}
            </span>
          </span>
        ) : null}
      </span>
    </div>
  );
}
