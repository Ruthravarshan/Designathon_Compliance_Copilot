import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let database: "ok" | "unreachable" = "ok";

  try {
    // A stalled database must not keep the health check past its <1s budget.
    const deadline = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Database check timed out")), 500);
    });
    await Promise.race([db.$queryRaw`SELECT 1`, deadline]);
  } catch (error) {
    database = "unreachable";
    logger.warn({ err: error, requestId }, "health check: database unreachable");
  }

  const status = database === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      service: "hexa-web",
      version: env.APP_VERSION,
      database,
      latencyMs: Date.now() - startedAt,
      requestId,
      timestamp: new Date().toISOString(),
    },
    {
      status: status === "ok" ? 200 : 503,
      headers: { "x-request-id": requestId, "cache-control": "no-store" },
    },
  );
}
