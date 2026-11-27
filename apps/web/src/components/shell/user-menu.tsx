"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CaretDown, GearSix, SignOut } from "@phosphor-icons/react";
import { humanize } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";

export function UserMenu({
  name,
  email,
  avatarUrl,
  role,
  departmentName,
  signingOut = false,
  onSignOut,
}: {
  name: string;
  email: string | null;
  avatarUrl?: string | null;
  role: string;
  departmentName?: string | null;
  signingOut?: boolean;
  onSignOut: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const items = Array.from(
          containerRef.current?.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not([disabled])',
          ) ?? [],
        );
        if (items.length === 0) {
          return;
        }
        event.preventDefault();
        const currentIndex = items.findIndex((item) => item === document.activeElement);
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          currentIndex === -1 ? 0 : (currentIndex + delta + items.length) % items.length;
        items[nextIndex]?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-3 text-left transition-colors duration-150 hover:border-muted/60 hover:bg-surface-2 sm:min-h-10"
      >
        <Avatar name={name} avatarUrl={avatarUrl} size="sm" />
        <span className="hidden max-w-[140px] truncate text-sm font-medium text-fg md:block">
          {name}
        </span>
        <CaretDown size={13} weight="bold" aria-hidden="true" className="text-muted" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="pp-card-shadow absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-fg">{name}</p>
            {email ? <p className="truncate font-mono text-xs text-muted">{email}</p> : null}
            <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              {humanize(role)}
              {departmentName ? ` · ${departmentName}` : ""}
            </p>
          </div>
          <div className="p-1.5">
            <Link
              href="/app/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm text-fg transition-colors hover:bg-surface-2"
            >
              <GearSix size={16} weight="bold" aria-hidden="true" className="text-muted" />
              <span>Personal settings</span>
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void onSignOut()}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              <SignOut size={16} weight="bold" aria-hidden="true" className="text-muted" />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
