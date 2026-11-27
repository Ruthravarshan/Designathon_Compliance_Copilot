import "server-only";
import type { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "Request body must be valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The request contains invalid fields.", {
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return parsed.data as z.infer<S>;
}

export function apiHeaders(requestId: string, extra?: Record<string, string>): HeadersInit {
  return {
    "cache-control": "no-store",
    "x-request-id": requestId,
    ...extra,
  };
}

export function requestIdFor(): string {
  return crypto.randomUUID();
}
