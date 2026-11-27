"use client";

import Link from "next/link";
import { Bell, Check, Circle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import type { NotificationItem } from "@/components/shell/notification-bell";

export function NotificationsView({
  items,
  unreadCount,
  markingAll = false,
  onMarkAllRead,
}: {
  items: readonly NotificationItem[];
  unreadCount: number;
  markingAll?: boolean;
  onMarkAllRead?: () => void | Promise<void>;
}) {
  return (
    <div className="mx-auto max-w-[820px] space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread workspace notifications.`
            : "All caught up across your workspace notifications."
        }
        action={
          unreadCount > 0 && onMarkAllRead ? (
            <Button
              variant="secondary"
              size="sm"
              pending={markingAll}
              pendingLabel="Marking read..."
              onClick={() => void onMarkAllRead()}
            >
              <Check size={14} weight="bold" aria-hidden="true" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No notifications yet."
          description="Ingestion updates, assignment requests, and policy changes will appear here."
          icon={Bell}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const unread = !item.readAt;
              const content = (
                <div className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-2/60">
                  <Circle
                    size={9}
                    weight="fill"
                    aria-hidden="true"
                    className={cn("mt-1.5 shrink-0", unread ? "text-brand" : "text-transparent")}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={cn("text-sm", unread ? "font-semibold text-fg" : "text-fg")}>
                        {item.title}
                      </p>
                      <span className="font-mono text-xs text-muted">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted">{item.body}</p>
                  </div>
                </div>
              );

              return (
                <li key={item.id}>
                  {item.href ? <Link href={item.href}>{content}</Link> : content}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
