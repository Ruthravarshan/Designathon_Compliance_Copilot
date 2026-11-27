import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test("board viewer is read-only in the UI and blocked by the API", async ({ page }) => {
  await signIn(page, /Nikhil Rao/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back, Nikhil");

  await page.goto("/app/findings");
  await page.locator('a[href^="/app/findings/"]').first().click();

  await expect(page.getByText("Read-only review state")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Record a review decision" })).toHaveCount(0);

  await page.goto("/app/audit");
  await expect(page.getByText("The audit trail is restricted.")).toBeVisible();

  const response = await page.request.post("/api/findings/aaaaaaaaaaaaaaaaaaaaaaaa/review", {
    data: { action: "APPROVED", comments: "" },
  });
  expect(response.status()).toBe(403);
});

test("the second tenant sees only its own empty workspace", async ({ page }) => {
  await signIn(page, /Tara Singh/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back, Tara");
  await expect(page.getByText(/Scoped to Northwind Assurance/)).toBeVisible();

  await page.goto("/app/findings");
  await expect(page.getByRole("heading", { name: "No findings yet." })).toBeVisible();

  await page.goto("/app/circulars");
  await expect(page.getByRole("heading", { name: "No circulars ingested yet." })).toBeVisible();
});

test("anonymous visitors are redirected to sign-in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: /Sign in to PolicyPulse/i })).toBeVisible();
});
