"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
  index: string;
  exact?: boolean;
}

export function AppNav({
  items,
  orientation = "vertical",
}: {
  items: NavItem[];
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Workbench"
      className={cn(orientation === "vertical" ? "space-y-1" : "flex gap-1 overflow-x-auto pb-1")}
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              orientation === "horizontal" && "shrink-0 py-1.5",
              active ? "bg-brand text-brand-ink" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span
              className={cn(
                "font-mono text-[10px] tracking-[0.12em]",
                active ? "text-brand-ink/70" : "text-muted/70",
              )}
            >
              {item.index}
            </span>
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
