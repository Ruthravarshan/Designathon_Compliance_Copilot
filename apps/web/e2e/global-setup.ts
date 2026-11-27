import { execSync } from "node:child_process";

/**
 * Reset the demo corpus before the suite so finding review states are
 * deterministic between runs. Set E2E_SKIP_SEED=1 to reuse the current data.
 */
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_SEED === "1") {
    return;
  }

  execSync("npm run db:seed", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
    timeout: 120_000,
  });
}
