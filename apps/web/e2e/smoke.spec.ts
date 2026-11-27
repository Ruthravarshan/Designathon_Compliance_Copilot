import { expect, test } from "@playwright/test";

test("landing page states the product promise", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("with receipts");
  await expect(page.getByRole("link", { name: /open workbench/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clause-grounded" })).toBeVisible();
  await expect(page.getByText("Built for regulated operations.")).toBeVisible();
});

test("landing page sections are interactive with zero horizontal overflow", async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflow, `Horizontal overflow at ${width}px`).toBe(false);
  }

  // Interactive workbench scenario switch & sign-off preview
  await page.getByRole("button", { name: /RBI · Residency/i }).click();
  await expect(page.getByText("POL-CLOUD-05 · Cloud & data residency").first()).toBeVisible();
  await page.getByRole("button", { name: /Simulate sign-off/i }).click();
  await expect(page.getByText(/Audit event \+ outbox email queued/i)).toBeVisible();

  // Interactive 4-stage workflow
  await page.getByRole("button", { name: /04\s*Sign off/i }).click();
  await expect(page.getByText(/Stage 04 output/i)).toBeVisible();

  // Interactive backend platform modules
  await page.getByRole("tab", { name: /Storage, Gmail & Exports/i }).click();
  await expect(page.getByText(/SharePoint → Drive \/ Supabase/i)).toBeVisible();

  // Interactive RBAC preview
  await page.getByRole("button", { name: /Board Auditor|^Auditor$/i }).click();
  await expect(page.getByText("403 Blocked").first()).toBeVisible();
});

test("build OS page keeps the ten hour route", async ({ page }) => {
  await page.goto("/platform");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ten hours");
  await expect(page.getByText("The 10-hour route")).toBeVisible();
  await expect(page.getByRole("link", { name: /open the workflow/i })).toBeVisible();
});

test("health endpoint returns a structured payload", async ({ request }) => {
  const response = await request.get("/api/health", { timeout: 60_000 });

  expect([200, 503]).toContain(response.status());
  const body = (await response.json()) as {
    service: string;
    status: string;
    requestId: string;
  };

  expect(body.service).toBe("hexa-web");
  expect(["ok", "degraded"]).toContain(body.status);
  expect(body.requestId).toMatch(/[0-9a-f-]{36}/);
});
