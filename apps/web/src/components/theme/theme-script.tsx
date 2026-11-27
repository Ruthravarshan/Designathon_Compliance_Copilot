import { THEME_COOKIE_NAME, type ThemeMode } from "./theme";

/**
 * Inline pre-paint script that applies `data-theme` and `color-scheme` to `<html>`
 * from the `pp_theme` cookie (or workspace default) before hydration to avoid flash.
 */
export function ThemeScript({ defaultTheme = "light" }: { defaultTheme?: ThemeMode }) {
  const script = `(() => {
    try {
      const match = document.cookie.match(/(?:^|; )${THEME_COOKIE_NAME}=([^;]+)/);
      const raw = match ? decodeURIComponent(match[1]) : ${JSON.stringify(defaultTheme)};
      const mode = raw === "dark" || raw === "light" || raw === "system" ? raw : ${JSON.stringify(defaultTheme)};
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const resolved = mode === "dark" ? "dark" : mode === "light" ? "light" : (prefersDark ? "dark" : "light");
      const root = document.documentElement;
      root.dataset.theme = resolved;
      root.dataset.themeMode = mode;
      root.style.colorScheme = resolved;
    } catch {}
  })();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
