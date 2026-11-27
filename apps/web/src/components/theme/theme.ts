export const THEME_COOKIE_NAME = "pp_theme";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"];

/** Parse a raw cookie or stored value into a valid ThemeMode, falling back to defaultTheme. */
export function parseThemeCookie(
  value: string | null | undefined,
  fallback: ThemeMode = "light",
): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return fallback;
}

/** Resolve ThemeMode to a concrete light or dark theme given system preference. */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === "dark") {
    return "dark";
  }
  if (mode === "light") {
    return "light";
  }
  return systemPrefersDark ? "dark" : "light";
}

/** Build the Set-Cookie / document.cookie assignment string for pp_theme. */
export function buildThemeCookieHeader(mode: ThemeMode): string {
  return `${THEME_COOKIE_NAME}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Toggle cleanly between light and dark based on the currently active resolved theme. */
export function toggleResolvedTheme(currentResolved: ResolvedTheme): ThemeMode {
  return currentResolved === "dark" ? "light" : "dark";
}
