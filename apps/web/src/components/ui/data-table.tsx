import type { ReactNode } from "react";
import { ArrowDown } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export interface DataColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  className?: string;
  render: (row: T) => ReactNode;
  /** Optional mobile card label override; defaults to header. */
  mobileLabel?: string;
  /** Omit from mobile card stack if redundant. */
  hideOnMobile?: boolean;
}

export function DataTable<T>({
  caption,
  rows,
  columns,
  getRowKey,
  renderMobileHeader,
  renderRowActions,
  className,
}: {
  caption: string;
  rows: readonly T[];
  columns: readonly DataColumn<T>[];
  getRowKey: (row: T) => string;
  renderMobileHeader?: (row: T) => ReactNode;
  renderRowActions?: (row: T) => ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {/* Desktop table (>= 1024px) */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface lg:block">
        <table className="w-full border-collapse text-left text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 border-b border-line bg-surface-2">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
              {renderRowActions ? (
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="h-11 transition-colors duration-150 hover:bg-surface-2/60"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-2.5 align-middle text-fg",
                      column.align === "right" && "text-right tabular-nums",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {renderRowActions ? (
                  <td className="px-4 py-2 text-right align-middle">{renderRowActions(row)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile & tablet stacked cards (< 1024px, safe at 320px) */}
      <ul className="space-y-3 lg:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li
            key={getRowKey(row)}
            className="pp-card-shadow rounded-2xl border border-line bg-surface p-4"
          >
            {renderMobileHeader ? <div className="mb-3">{renderMobileHeader(row)}</div> : null}
            <dl className="grid gap-2.5">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div
                    key={column.key}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line/60 pt-2 first:border-t-0 first:pt-0"
                  >
                    <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                      {column.mobileLabel ?? column.header}
                    </dt>
                    <dd className="min-w-0 text-right text-sm text-fg">{column.render(row)}</dd>
                  </div>
                ))}
            </dl>
            {renderRowActions ? (
              <div className="mt-3 flex justify-end border-t border-line pt-3">
                {renderRowActions(row)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Pagination({
  loadedCount,
  hasMore,
  loading = false,
  onLoadMore,
  noun = "items",
  className,
}: {
  loadedCount: number;
  hasMore: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  noun?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-between gap-3 pt-2 sm:flex-row sm:items-center",
        className,
      )}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted tabular-nums">
        Showing {loadedCount} {noun}
        {!hasMore ? " · End of list" : ""}
      </p>
      {hasMore && onLoadMore ? (
        <Button
          variant="secondary"
          size="sm"
          pending={loading}
          pendingLabel="Loading more..."
          onClick={onLoadMore}
        >
          <ArrowDown size={14} weight="bold" aria-hidden="true" />
          Load more
        </Button>
      ) : null}
    </div>
  );
}
