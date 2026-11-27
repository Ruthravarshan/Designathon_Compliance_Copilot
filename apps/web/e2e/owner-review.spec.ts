import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test("owner reviews a critical finding and the decision is audited", async ({ page }) => {
  await signIn(page, /Meera Krishnan/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back, Meera");

  await page.getByRole("link", { name: "Open findings" }).click();
  await expect(page).toHaveURL(/\/app\/findings$/);

  await page.getByRole("link", { name: /servers located within India/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "servers located within India",
  );
  await expect(page.getByText("Citation verified").first()).toBeVisible();

  await page.getByRole("button", { name: "Approve draft", exact: true }).click();

  await expect(page.getByText("Decision on record")).toBeVisible();
  await expect(page.getByText("Meera Krishnan · Approved")).toBeVisible();

  await page.getByRole("link", { name: "Audit trail" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Audit trail");
  await expect(page.getByText("finding.reviewed").first()).toBeVisible();
});
