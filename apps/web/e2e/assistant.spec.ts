import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test("assistant answers from the register with checkable citations", async ({ page }) => {
  await signIn(page, /Rajeshwari/);
  await page.goto("/app/assistant");
  await expect(page.getByRole("heading", { name: "Ask the register" })).toBeVisible();

  await page
    .getByLabel(/Ask the register/)
    .fill("How fast must we report a cyber incident to IRDAI?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  const thread = page.locator('[aria-live="polite"]');
  await expect(thread.getByText("Grounded answer")).toBeVisible({ timeout: 60_000 });
  await expect(thread.getByText(/\d+ citations/)).toBeVisible();
  await expect(thread.getByText("Citations", { exact: true })).toBeVisible();
  await expect(thread.getByText(/(Grounded by|Extractive retrieval)/)).toBeVisible();
  await expect(thread.getByText(/(verified|deterministic)/)).toBeVisible();
});

test("assistant refuses when nothing in the register matches", async ({ page }) => {
  await signIn(page, /Rajeshwari/);
  await page.goto("/app/assistant");

  await page
    .getByLabel(/Ask the register/)
    .fill("What does our quantum satellite telemetry policy say?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  const thread = page.locator('[aria-live="polite"]');
  await expect(thread.getByText("Refused")).toBeVisible({ timeout: 60_000 });
  await expect(thread.getByText(/escalates rather than invent/)).toBeVisible();
});
