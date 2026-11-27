"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Action = "APPROVED" | "APPROVED_WITH_EDITS" | "REJECTED";

interface ApiErrorBody {
  error?: {
    message?: string;
    requestId?: string;
    details?: Array<{ path?: string; message?: string }>;
  };
}

const options: Array<{ value: Action; label: string; blurb: string }> = [
  {
    value: "APPROVED",
    label: "Approve draft",
    blurb: "Accept the drafted wording and queue the owner task.",
  },
  {
    value: "APPROVED_WITH_EDITS",
    label: "Approve with edits",
    blurb: "Replace the draft with your own wording, then approve.",
  },
  {
    value: "REJECTED",
    label: "Reject",
    blurb: "Send it back with a recorded reason. No task is queued.",
  },
];

export function ReviewForm({
  findingId,
  defaultWording,
}: {
  findingId: string;
  defaultWording: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState<Action>("APPROVED");
  const [comments, setComments] = useState("");
  const [wording, setWording] = useState(defaultWording);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    if (action === "REJECTED" && comments.trim().length < 10) {
      setError("A rejection needs a reason of at least 10 characters.");
      return;
    }
    if (action === "APPROVED_WITH_EDITS" && wording.trim().length < 12) {
      setError("Edited wording must be at least 12 characters.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/findings/${findingId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          comments,
          ...(action === "APPROVED_WITH_EDITS" ? { approvedWording: wording } : {}),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
        const detail = body.error?.details
          ?.slice(0, 2)
          .map((item) => (item.path ? `${item.path}: ${item.message}` : item.message))
          .join(" ");
        setError(detail || body.error?.message || "The review could not be recorded.");
        return;
      }

      setSubmitted(true);
      router.refresh();
    } catch {
      setError("The server did not respond. Check the connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Record a review decision</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-brand dark:text-support">
          Officer action
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        The decision is attributable, timestamped, and written to the audit trail. It never
        publishes a policy.
      </p>

      <fieldset className="mt-4">
        <legend className="sr-only">Review action</legend>
        <div className="grid gap-2">
          {options.map((option) => {
            const selected = action === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                disabled={pending || submitted}
                onClick={() => {
                  setAction(option.value);
                  setError(null);
                }}
                className={cn(
                  "rounded-xl border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  selected
                    ? "border-brand bg-brand/10 dark:border-support dark:bg-support/15"
                    : "border-line bg-surface hover:border-muted/40 hover:bg-surface-2/60",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      selected ? "text-brand dark:text-support" : "text-fg",
                    )}
                  >
                    {option.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-4 items-center justify-center rounded-full border",
                      selected ? "border-brand bg-brand" : "border-line",
                    )}
                  >
                    {selected ? (
                      <CheckCircle size={11} weight="fill" className="text-brand-ink" />
                    ) : null}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">
                  {option.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {action === "APPROVED_WITH_EDITS" ? (
        <div className="mt-4">
          <Field
            label="Approved wording"
            htmlFor="approved-wording"
            hint={`${wording.trim().length}/2000 characters. This replaces the draft in the review record only.`}
          >
            <Textarea
              id="approved-wording"
              value={wording}
              onChange={(event) => setWording(event.target.value)}
              maxLength={2000}
              minLength={12}
              className="min-h-[140px] text-[13px]"
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-4">
        <Field
          label={action === "REJECTED" ? "Rejection reason" : "Review note"}
          htmlFor="review-comments"
          hint={
            action === "REJECTED"
              ? `Required, at least 10 characters (${comments.trim().length}/10). Stored with the review event.`
              : "Optional context for the next reviewer and the audit trail."
          }
        >
          <Textarea
            id="review-comments"
            value={comments}
            disabled={pending || submitted}
            onChange={(event) => setComments(event.target.value)}
            maxLength={2000}
            className="min-h-[92px] text-[13px]"
            placeholder={
              action === "REJECTED"
                ? "Explain what is wrong and what evidence is needed."
                : "e.g. Approved with the 6-hour SLA; storage budget tracked separately."
            }
          />
        </Field>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-3.5 py-3 text-xs leading-relaxed text-fg"
        >
          <WarningCircle
            size={15}
            weight="fill"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-danger"
          />
          <span>
            <span className="font-semibold">Error:</span> {error}
          </span>
        </div>
      ) : null}

      {submitted ? (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-3 text-xs text-fg dark:border-support/35 dark:bg-support/15"
        >
          <CheckCircle
            size={15}
            weight="bold"
            aria-hidden="true"
            className="shrink-0 text-brand dark:text-support"
          />
          <span>Decision recorded. Refreshing view...</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={pending || submitted}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <SpinnerGap size={16} weight="bold" className="animate-spin" aria-hidden="true" />
            Recording decision
          </>
        ) : action === "REJECTED" ? (
          "Reject finding"
        ) : action === "APPROVED_WITH_EDITS" ? (
          "Approve with edits"
        ) : (
          "Approve draft"
        )}
      </button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
        Approval queues a remediation email to the mapped owner. No policy record is changed.
      </p>
    </div>
  );
}
