import "server-only";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";

const DEV_SECRET = "hexa-demo-only-session-secret-change-this-value";

export function authSecret(): string {
  if (env.AUTH_SECRET) {
    return env.AUTH_SECRET;
  }

  // The demo secret is never used in production, even when demo mode is opted in:
  // persona sign-in is documented as non-production and must not ship.
  if (env.NODE_ENV !== "production" && env.DEMO_MODE_ENABLED) {
    return DEV_SECRET;
  }

  throw new AppError(ERROR_CODES.INTERNAL, "Authentication is not configured.", { expose: false });
}
