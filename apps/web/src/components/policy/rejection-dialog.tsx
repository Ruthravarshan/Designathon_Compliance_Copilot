"use client";

import { useEffect, useId, useRef, useState } from "react";
import { WarningCircle, X } from "@phosphor-icons/react";
import {
  REJECTION_NOTE_MAX,
  REJECTION_NOTE_MIN,
  validateRejectionNote,
} from "@/components/ui/api-helpers";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";

export interface RejectionReasonOption {
  value: string;
  label: string;
}

export function RejectionDialog({
  open,
  title = "Reject with a note",
  description = "Provide a clear explanation. The note is recorded in the audit log and sent to the relevant owner.",
  reasons,
  submitLabel = "Confirm rejection",
  pending = false,
  serverError,
  requestId,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title?: string;
  description?: string;
  reasons?: readonly RejectionReasonOption[];
  submitLabel?: string;
  pending?: boolean;
  serverError?: string | null;
  requestId?: string | null;
  onSubmit: (payload: { note: string; reason?: string }) => void | Promise<void>;
  onClose: () => void;
}) {
  const titleId = useId();
  const reasonId = useId();
  const noteId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [reason, setReason] = useState(reasons?.[0]?.value ?? "");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(reasons?.[0]?.value ?? "");
      setNote("");
      setTouched(false);
    }
  }, [open, reasons]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [open, pending, onClose]);

  if (!open) {
    return null;
  }

  const validation = validateRejectionNote(note);
  const inlineError = touched && !validation.valid ? (validation.error ?? undefined) : undefined;

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!validation.valid) {
      return;
    }
    await onSubmit({
      note: note.trim(),
      ...(reasons && reasons.length > 0 && reason ? { reason } : {}),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/45 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pp-card-shadow w-full max-w-[520px] rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-fg">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
          </div>
          <IconButton label="Close dialog" variant="ghost" disabled={pending} onClick={onClose}>
            <X size={16} weight="bold" aria-hidden="true" />
          </IconButton>
        </div>

        <form onSubmit={(event) => void handleFormSubmit(event)} className="mt-5 space-y-4">
          {reasons && reasons.length > 0 ? (
            <Field label="Reason" htmlFor={reasonId}>
              <Select
                id={reasonId}
                value={reason}
                disabled={pending}
                onChange={(event) => setReason(event.target.value)}
              >
                {reasons.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field
            label="Rejection note"
            htmlFor={noteId}
            required
            error={inlineError}
            hint={`Minimum ${REJECTION_NOTE_MIN} characters. Recorded permanently in the audit trail.`}
          >
            <Textarea
              id={noteId}
              value={note}
              disabled={pending}
              maxLength={REJECTION_NOTE_MAX}
              placeholder="Explain what is inaccurate, missing, or needs remediation..."
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            <div className="flex justify-end font-mono text-[11px] tabular-nums text-muted">
              {validation.trimmedLength} / {REJECTION_NOTE_MAX}
            </div>
          </Field>

          {serverError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 p-3 text-xs text-fg"
            >
              <WarningCircle
                size={15}
                weight="fill"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-danger"
              />
              <div className="space-y-1">
                <p>
                  <span className="font-semibold">Error:</span> {serverError}
                </p>
                {requestId ? <p className="font-mono text-muted">Request ID: {requestId}</p> : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2.5 pt-2">
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              pending={pending}
              pendingLabel="Recording rejection..."
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
