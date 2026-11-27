"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface-2 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-9 items-center justify-center rounded-full px-3.5 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-8",
              selected ? "bg-brand text-brand-ink" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  content: ReactNode;
}

export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const baseId = useId();
  const activeItem = items.find((item) => item.id === value) ?? items[0];

  const handleKeyDown = (index: number, key: string) => {
    if (items.length === 0) {
      return;
    }
    if (key === "ArrowRight") {
      const next = items[(index + 1) % items.length];
      if (next) {
        onChange(next.id);
      }
    } else if (key === "ArrowLeft") {
      const prev = items[(index - 1 + items.length) % items.length];
      if (prev) {
        onChange(prev.id);
      }
    } else if (key === "Home") {
      const first = items[0];
      if (first) {
        onChange(first.id);
      }
    } else if (key === "End") {
      const last = items[items.length - 1];
      if (last) {
        onChange(last.id);
      }
    }
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-1 border-b border-line pb-px"
      >
        {items.map((item, index) => {
          const selected = item.id === activeItem?.id;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(index, event.key)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 border-b-2 px-3.5 text-sm font-medium transition-colors duration-150 sm:min-h-10",
                selected
                  ? "border-brand text-fg"
                  : "border-transparent text-muted hover:border-line hover:text-fg",
              )}
            >
              <span>{item.label}</span>
              {typeof item.count === "number" ? (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted">
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {activeItem ? (
        <div
          id={`${baseId}-panel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeItem.id}`}
          className="pt-5"
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={copied ? copiedLabel : label}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-muted transition-colors duration-150 hover:border-muted/60 hover:text-fg",
        className,
      )}
    >
      {copied ? (
        <>
          <Check size={12} weight="bold" aria-hidden="true" className="text-brand" />
          <span className="text-fg">{copiedLabel}</span>
        </>
      ) : (
        <>
          <Copy size={12} weight="bold" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
