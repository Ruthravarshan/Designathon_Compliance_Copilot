import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test("citations expose web page, page-anchored PDF, and both copy formats", async ({ page }) => {
  await page.addInitScript(() => {
    const store: string[] = [];
    Object.defineProperty(window, "__copied", { value: store, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          store.push(value);
        },
        write: async (items: ClipboardItem[]) => {
          const item = items[0];
          if (!item) {
            return;
          }
          const html = await item.getType("text/html");
          const text = await item.getType("text/plain");
          store.push(`RICH_HTML:${await html.text()}`);
          store.push(`RICH_TEXT:${await text.text()}`);
        },
      },
    });
  });

  await signIn(page, /Rajeshwari/);
  await page.goto("/app/assistant");
  await page
    .getByLabel(/Ask the register/)
    .fill("What are the incident reporting timelines for cyber security incidents?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  const thread = page.locator('[aria-live="polite"]');
  await expect(thread.getByText("Citations", { exact: true })).toBeVisible({ timeout: 90_000 });

  const webLink = thread.getByRole("link", { name: /Web page/ }).first();
  await expect(webLink).toHaveAttribute("href", /^https?:\/\//);
  await expect(webLink).toHaveAttribute("target", "_blank");

  const pdfLink = thread.getByRole("link", { name: /PDF/ }).first();
  const pdfHref = await pdfLink.getAttribute("href");
  expect(pdfHref).toMatch(/\/api\/documents\/[a-z0-9]+\/pdf/);

  await thread
    .getByRole("button", { name: /Markdown/i })
    .first()
    .click();
  await thread
    .getByRole("button", { name: /Rich text/i })
    .first()
    .click();
  await page.waitForTimeout(500);
  const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  const markdown = copied.find((entry) => entry.includes("**Sources**")) ?? "";
  expect(markdown).toContain("](");
  expect(markdown).toContain("http://localhost:3000");
  const rich = copied.find((entry) => entry.startsWith("RICH_HTML:")) ?? "";
  expect(rich).toContain("<a href=");
});
