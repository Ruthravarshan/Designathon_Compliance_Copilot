"use client";

import { useId, useRef, useState } from "react";
import { FilePdf, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/components/ui/api-helpers";
import { IconButton } from "@/components/ui/button";

export function UploadDropzone({
  file,
  maxSizeBytes,
  disabled = false,
  onFileSelect,
  error,
}: {
  file: File | null;
  maxSizeBytes: number;
  disabled?: boolean;
  onFileSelect: (file: File | null, validationError: string | null) => void;
  error?: string | null;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const validateAndEmit = (candidate: File | null) => {
    if (!candidate) {
      onFileSelect(null, null);
      return;
    }
    const isPdfMime = candidate.type === "application/pdf";
    const isPdfExt = candidate.name.toLowerCase().endsWith(".pdf");
    if (!isPdfMime && !isPdfExt) {
      onFileSelect(null, "Only PDF files are accepted.");
      return;
    }
    if (candidate.size > maxSizeBytes) {
      onFileSelect(null, `File exceeds maximum allowed size of ${formatBytes(maxSizeBytes)}.`);
      return;
    }
    onFileSelect(candidate, null);
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block font-mono text-[11px] uppercase tracking-[0.12em] text-muted"
      >
        Circular PDF file
      </label>

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand/35 bg-surface p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <FilePdf size={20} weight="bold" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{file.name}</p>
              <p className="font-mono text-xs text-muted tabular-nums">{formatBytes(file.size)}</p>
            </div>
          </div>
          <IconButton
            label="Remove selected file"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = "";
              }
              onFileSelect(null, null);
            }}
          >
            <X size={16} weight="bold" aria-hidden="true" />
          </IconButton>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onClick={() => {
            if (!disabled) {
              inputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if (!disabled && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) {
              setDragging(true);
            }
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) {
              validateAndEmit(event.dataTransfer.files?.[0] ?? null);
            }
          }}
          className={cn(
            "flex min-h-[168px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition-colors duration-150",
            dragging
              ? "border-brand bg-brand/10"
              : "border-line bg-surface hover:border-muted/60 hover:bg-surface-2/60",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <span className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface-2 text-brand">
            <UploadSimple size={20} weight="bold" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold text-fg">
            Drop a regulatory PDF here, or press Enter to browse
          </p>
          <p className="mt-1 font-mono text-xs text-muted">
            PDF only · Max {formatBytes(maxSizeBytes)}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => validateAndEmit(event.target.files?.[0] ?? null)}
      />

      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-fg">
          <WarningCircle
            size={14}
            weight="fill"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-danger"
          />
          <span>
            <span className="font-semibold">Error:</span> {error}
          </span>
        </p>
      ) : null}
    </div>
  );
}
