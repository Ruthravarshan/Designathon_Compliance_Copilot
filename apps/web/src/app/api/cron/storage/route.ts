import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail } from "@/lib/http";
import { syncAllWorkspaceStorage } from "@/server/storage/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  if (!env.CRON_SECRET) {
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = Buffer.from(env.CRON_SECRET);
  const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function handle(request: Request) {
  const requestId = crypto.randomUUID();

  if (!env.CRON_SECRET) {
    return NextResponse.json(
      {
        error: {
          code: ERROR_CODES.INTERNAL,
          message: "Scheduled storage sync is unavailable.",
          requestId,
        },
      },
      { status: 503, headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  }
  if (!isAuthorized(request)) {
    return fail(new AppError(ERROR_CODES.UNAUTHORIZED, "Unauthorized"), requestId);
  }

  const results = await syncAllWorkspaceStorage();
  const summary = {
    workspaces: results.length,
    checked: results.reduce((total, item) => total + item.checked, 0),
    updated: results.reduce((total, item) => total + item.updated, 0),
    reindexed: results.reduce((total, item) => total + item.reindexed, 0),
    failed: results.reduce((total, item) => total + item.failed, 0),
    results,
  };

  return NextResponse.json(
    { data: summary },
    { headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
