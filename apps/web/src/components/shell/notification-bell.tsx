"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, Circle, EnvelopeSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export function NotificationBell({
  unreadCount,
  items,
  markingAll = false,
  onMarkAllRead,
}: {
  unreadCount: number;
  items: readonly NotificationItem[];
  markingAll?: boolean;
  onMarkAllRead?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const latest = items.slice(0, 5);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg transition-colors duration-150 hover:border-muted/60 hover:bg-surface-2 sm:size-10"
      >
        <Bell size={18} weight="bold" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none tabular-nums text-brand-ink">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Recent notifications"
          className="pp-card-shadow absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-fg">Notifications</p>
            {unreadCount > 0 && onMarkAllRead ? (
              <Button
                variant="ghost"
                size="sm"
                pending={markingAll}
                onClick={() => void onMarkAllRead()}
                className="h-8 px-2.5 text-xs"
              >
                <Check size={13} weight="bold" aria-hidden="true" />
                Mark all read
              </Button>
            ) : null}
          </div>

          {latest.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <EnvelopeSimple
                size={20}
                weight="bold"
                aria-hidden="true"
                className="mx-auto text-muted"
              />
              <p className="mt-2 text-sm text-muted">No notifications yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {latest.map((item) => {
                const unread = !item.readAt;
                const inner = (
                  <div className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-surface-2/60">
                    <Circle
                      size={8}
                      weight="fill"
                      aria-hidden="true"
                      className={cn("mt-1.5 shrink-0", unread ? "text-brand" : "text-transparent")}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm",
                          unread ? "font-semibold text-fg" : "text-fg",
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.body}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link href={item.href} onClick={() => setOpen(false)}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-line px-4 py-2.5 text-right">
            <Link
              href="/app/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
