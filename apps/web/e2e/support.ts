import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, persona: RegExp): Promise<void> {
  await page.goto("/signin");
  await page.getByRole("button", { name: persona }).click();
  await expect(page).toHaveURL(/\/app$/);
}
