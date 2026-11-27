import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail } from "@/lib/http";
import { runWatchForAllWorkspaces } from "@/server/watch/service";

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
          message: "Scheduled regulatory watch is unavailable.",
          requestId,
        },
      },
      { status: 503, headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  }

  if (!isAuthorized(request)) {
    return fail(new AppError(ERROR_CODES.UNAUTHORIZED, "Unauthorized"), requestId);
  }

  const runs = await runWatchForAllWorkspaces();
  const summary = {
    workspaces: runs.length,
    ingested: runs.reduce((total, item) => total + item.result.ingested, 0),
    revisions: runs.reduce((total, item) => total + item.result.revisions, 0),
    failed: runs.reduce((total, item) => total + item.result.failed, 0),
    results: runs.map((item) => ({
      workspaceId: item.workspaceId,
      status: item.result.status,
      message: item.result.message,
    })),
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
