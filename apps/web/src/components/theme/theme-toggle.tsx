"use client";

import { useCallback, useEffect, useState } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import {
  buildThemeCookieHeader,
  parseThemeCookie,
  resolveTheme,
  THEME_COOKIE_NAME,
  toggleResolvedTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "./theme";

function readCookieMode(defaultMode: ThemeMode): ThemeMode {
  if (typeof document === "undefined") {
    return defaultMode;
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE_NAME}=([^;]+)`));
  return parseThemeCookie(match?.[1] ? decodeURIComponent(match[1]) : undefined, defaultMode);
}

function applyThemeToDocument(mode: ThemeMode): ResolvedTheme {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
  const resolved = resolveTheme(mode, prefersDark);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.themeMode = mode;
    root.style.colorScheme = resolved;
  }
  return resolved;
}

export function useThemePreference(initialMode: ThemeMode = "light") {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [resolved, setResolved] = useState<ResolvedTheme>(
    initialMode === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    const cookieMode = readCookieMode(initialMode);
    setMode(cookieMode);
    setResolved(applyThemeToDocument(cookieMode));

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) {
      return;
    }

    const onChange = () => {
      const current = readCookieMode(initialMode);
      if (current === "system") {
        setResolved(applyThemeToDocument("system"));
      }
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [initialMode]);

  const updateMode = useCallback((next: ThemeMode) => {
    document.cookie = buildThemeCookieHeader(next);
    setMode(next);
    setResolved(applyThemeToDocument(next));
  }, []);

  return { mode, resolved, updateMode };
}

export function ThemeToggle({
  initialMode = "light",
  className,
}: {
  initialMode?: ThemeMode;
  className?: string;
}) {
  const { resolved, updateMode } = useThemePreference(initialMode);
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => updateMode(toggleResolvedTheme(resolved))}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg transition-colors duration-150 hover:border-muted/60 hover:bg-surface-2 sm:size-10",
        className,
      )}
    >
      {isDark ? (
        <Sun size={18} weight="bold" aria-hidden="true" />
      ) : (
        <Moon size={18} weight="bold" aria-hidden="true" />
      )}
    </button>
  );
}

const APPEARANCE_OPTIONS: readonly {
  mode: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    mode: "system",
    label: "System",
    description: "Follows your operating system light or dark preference.",
    icon: Desktop,
  },
  {
    mode: "light",
    label: "Light",
    description: "High-contrast canvas for bright offices and document review.",
    icon: Sun,
  },
  {
    mode: "dark",
    label: "Dark",
    description: "Deep navy surface tokens for low-light operations.",
    icon: Moon,
  },
];

export function AppearanceSelector({ initialMode = "system" }: { initialMode?: ThemeMode }) {
  const { mode, updateMode } = useThemePreference(initialMode);

  return (
    <div role="radiogroup" aria-label="Appearance theme" className="grid gap-3 sm:grid-cols-3">
      {APPEARANCE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = mode === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => updateMode(option.mode)}
            className={cn(
              "flex min-h-11 flex-col items-start rounded-2xl border p-4 text-left transition-colors duration-150",
              selected
                ? "border-brand bg-brand/10 text-fg"
                : "border-line bg-surface text-fg hover:border-muted/60 hover:bg-surface-2",
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <Icon
                size={18}
                weight={selected ? "fill" : "bold"}
                aria-hidden="true"
                className={selected ? "text-brand" : "text-muted"}
              />
              <span
                className={cn(
                  "size-2.5 rounded-full border",
                  selected ? "border-brand bg-brand" : "border-line bg-transparent",
                )}
                aria-hidden="true"
              />
            </div>
            <span className="mt-3 text-sm font-semibold">{option.label}</span>
            <span className="mt-1 text-xs leading-relaxed text-muted">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
