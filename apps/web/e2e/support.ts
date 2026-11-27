import { expect, type Cookie, type Page } from "@playwright/test";

// The auth limiter allows 10 sign-ins per minute; cache the session per persona
// per worker so only the first use goes through the UI.
const sessionCookies = new Map<string, Cookie[]>();

export async function signIn(page: Page, persona: RegExp): Promise<void> {
  const cached = sessionCookies.get(persona.source);
  if (cached) {
    await page.context().addCookies(cached);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app$/);
    return;
  }

  await page.goto("/signin");
  await page.getByRole("button", { name: persona }).click();
  await expect(page).toHaveURL(/\/app$/);
  sessionCookies.set(persona.source, await page.context().cookies());
}
