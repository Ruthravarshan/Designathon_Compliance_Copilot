import { describe, expect, it } from "vitest";
import {
  buildThemeCookieHeader,
  parseThemeCookie,
  resolveTheme,
  THEME_COOKIE_NAME,
  toggleResolvedTheme,
} from "./theme";

describe("theme helpers", () => {
  it("parses valid theme cookies and falls back safely", () => {
    expect(parseThemeCookie("light")).toBe("light");
    expect(parseThemeCookie("dark")).toBe("dark");
    expect(parseThemeCookie("system")).toBe("system");
    expect(parseThemeCookie("invalid", "dark")).toBe("dark");
    expect(parseThemeCookie(null, "system")).toBe("system");
    expect(parseThemeCookie(undefined)).toBe("light");
  });

  it("resolves system theme against prefers-color-scheme", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
  });

  it("builds a SameSite=Lax path=/ cookie string", () => {
    expect(buildThemeCookieHeader("dark")).toBe(
      `${THEME_COOKIE_NAME}=dark; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  });

  it("toggles resolved theme cleanly", () => {
    expect(toggleResolvedTheme("light")).toBe("dark");
    expect(toggleResolvedTheme("dark")).toBe("light");
  });
});
