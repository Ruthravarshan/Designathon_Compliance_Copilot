"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { WarningCircle, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "./button";

function useFocusTrap(
  open: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;
    const focusables = container?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !container) {
        return;
      }
      const list = Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (list.length === 0) {
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, containerRef, onClose]);
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  pending = false,
  error,
  requestId,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  pending?: boolean;
  error?: string | null;
  requestId?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, panelRef, () => {
    if (!pending) {
      onClose();
    }
  });

  if (!open) {
    return null;
  }

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
        aria-describedby={descId}
        className="pp-card-shadow w-full max-w-[460px] rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-fg">
            {title}
          </h2>
          <IconButton label="Close dialog" variant="ghost" disabled={pending} onClick={onClose}>
            <X size={16} weight="bold" aria-hidden="true" />
          </IconButton>
        </div>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-muted">
          {description}
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 p-3 text-xs text-fg"
          >
            <WarningCircle
              size={15}
              weight="fill"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-danger"
            />
            <div className="space-y-1">
              <p>
                <span className="font-semibold">Error:</span> {error}
              </p>
              {requestId ? <p className="font-mono text-muted">Request ID: {requestId}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={variant} pending={pending} pendingLabel="Working..." onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sheet({
  open,
  title,
  side = "right",
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  side?: "left" | "right";
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, panelRef, onClose);

  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-fg/45",
        side === "right" ? "justify-end" : "justify-start",
      )}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "flex h-full w-full max-w-[420px] flex-col border-line bg-surface",
          side === "right" ? "border-l" : "border-r",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-fg">
            {title}
          </h2>
          <IconButton label="Close panel" variant="ghost" onClick={onClose}>
            <X size={18} weight="bold" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export interface ToastItem {
  id: string;
  tone: "neutral" | "error";
  message: string;
  requestId?: string | null;
}

export function ToastList({
  items,
  onDismiss,
}: {
  items: readonly ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-[380px] flex-col gap-2"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          className={cn(
            "pp-card-shadow flex items-start justify-between gap-3 rounded-2xl border bg-surface p-4 text-sm text-fg",
            item.tone === "error" ? "border-danger/40" : "border-line",
          )}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            {item.tone === "error" ? (
              <WarningCircle
                size={16}
                weight="fill"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-danger"
              />
            ) : null}
            <div className="min-w-0">
              <p className="leading-snug">
                {item.tone === "error" ? <span className="font-semibold">Error: </span> : null}
                {item.message}
              </p>
              {item.requestId ? (
                <p className="mt-1 font-mono text-[11px] text-muted">ID: {item.requestId}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(item.id)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X size={14} weight="bold" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
