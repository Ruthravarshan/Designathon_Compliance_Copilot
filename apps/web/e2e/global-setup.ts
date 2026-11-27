import { execSync } from "node:child_process";

const BASE_URL = "http://localhost:3000";
const WARM_PAGES = ["/app", "/app/findings", "/app/audit", "/app/circulars"];

/**
 * Reset the demo corpus before the suite so finding review states are
 * deterministic between runs. Set E2E_SKIP_SEED=1 to reuse the current data.
 *
 * The webServer plugin starts before global setup, so this also warms the dev
 * server: first-compile latency on a cold machine otherwise exceeds the
 * sign-in assertion timeout for the first concurrent tests.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_SKIP_SEED !== "1") {
    execSync("npm run db:seed", {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
      timeout: 120_000,
    });
  }

  await warmServer();
}

async function warmServer(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(120_000) });
    await fetch(`${BASE_URL}/signin`, { signal: AbortSignal.timeout(120_000) });

    const signIn = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ persona: "owner" }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!signIn.ok) {
      return;
    }

    const cookie = (signIn.headers.getSetCookie?.() ?? [])
      .map((value) => value.split(";")[0])
      .filter((value): value is string => Boolean(value))
      .join("; ");
    const headers = cookie ? { cookie } : undefined;

    const findings = await fetch(`${BASE_URL}/app/findings`, {
      headers,
      signal: AbortSignal.timeout(120_000),
    });
    const detailHref = (await findings.text()).match(/href="(\/app\/findings\/[a-z0-9]+)"/i)?.[1];

    const pages = detailHref ? [...WARM_PAGES, detailHref] : WARM_PAGES;
    for (const path of pages) {
      await fetch(`${BASE_URL}${path}`, { headers, signal: AbortSignal.timeout(120_000) });
    }
  } catch (error) {
    console.warn("E2E warm-up skipped:", error instanceof Error ? error.message : error);
  }
}
