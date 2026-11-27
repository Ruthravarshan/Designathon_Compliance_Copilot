import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { createDataScan, listDataScans } from "@/server/compliance/service";
import { assertSameOrigin, enforceLimit, scanLimiter } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  datasetName: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase snake_case."),
  fieldName: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase snake_case."),
  dataCategory: z.enum(["identifier", "contact", "financial", "health", "biometric", "metadata"]),
  sensitiveType: z.string().trim().max(40).optional(),
  sampleMasked: z.string().trim().min(1).max(64),
  encrypted: z.boolean(),
  consented: z.boolean(),
});

export async function GET() {
  const requestId = requestIdFor();

  try {
    const actor = await requireActor("document:read");
    const page = await listDataScans(actor);
    return ok(page, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("data:scan");
    await enforceLimit(scanLimiter, actor.userId);
    const body = await readJson(request, bodySchema);

    const result = await createDataScan(actor, {
      datasetName: body.datasetName,
      fieldName: body.fieldName,
      dataCategory: body.dataCategory,
      ...(body.sensitiveType ? { sensitiveType: body.sensitiveType } : {}),
      sampleMasked: body.sampleMasked,
      encrypted: body.encrypted,
      consented: body.consented,
    });

    return ok(result, { status: 201, headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
