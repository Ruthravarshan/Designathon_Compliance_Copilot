import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  brand:
    "border-brand/25 bg-brand/10 text-brand dark:border-support/35 dark:bg-support/15 dark:text-support",
  outline: "border-line bg-transparent text-muted",
  neutral: "border-line bg-surface text-fg",
  danger: "border-danger/35 bg-danger/10 text-fg",
  accent: "border-line bg-surface-2 text-fg dark:border-accent/40 dark:text-accent",
} as const;

interface BadgeProps {
  tone?: keyof typeof tones;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
