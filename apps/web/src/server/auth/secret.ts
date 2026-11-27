import "server-only";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";

const DEV_SECRET = "hexa-demo-only-session-secret-change-this-value";

export function authSecret(): string {
  if (env.AUTH_SECRET) {
    return env.AUTH_SECRET;
  }

  if (env.DEMO_MODE_ENABLED && env.NODE_ENV !== "production") {
    return DEV_SECRET;
  }

  throw new AppError(ERROR_CODES.INTERNAL, "Authentication is not configured.", { expose: false });
}
