import "server-only";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RateLimiter } from "@/lib/rate-limit";

export const authLimiter = new RateLimiter({ limit: 10, windowMs: 60_000, name: "auth" });
export const reviewLimiter = new RateLimiter({ limit: 20, windowMs: 60_000, name: "review" });
export const assistantLimiter = new RateLimiter({ limit: 15, windowMs: 60_000, name: "assistant" });
export const scanLimiter = new RateLimiter({ limit: 10, windowMs: 60_000, name: "scan" });
export const ingestLimiter = new RateLimiter({ limit: 5, windowMs: 5 * 60_000, name: "ingest" });

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "local";
}

export async function enforceLimit(limiter: RateLimiter, key: string): Promise<void> {
  const result = await limiter.check(key);
  if (!result.allowed) {
    throw new AppError(ERROR_CODES.RATE_LIMITED, "Too many requests. Try again shortly.", {
      details: { retryAfterSeconds: result.retryAfterSeconds },
    });
  }
}

/** Block cross-site browser posts. Non-browser clients without an Origin are allowed. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Request origin is not allowed.");
  }

  if (originHost !== request.headers.get("host")) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Request origin is not allowed.");
  }
}
