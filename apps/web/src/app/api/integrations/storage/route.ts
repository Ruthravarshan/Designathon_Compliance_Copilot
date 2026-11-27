import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { assertSameOrigin, enforceLimit, storageLimiter } from "@/server/rate-limits";
import {
  deleteStorageConnection,
  listStorageConnections,
  storageConnectionInputSchema,
  upsertStorageConnection,
} from "@/server/storage/connections";
import { selectStorageConnections } from "@/server/storage/selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deleteSchema = z.object({ id: z.string().trim().min(1) });

export async function GET() {
  const requestId = requestIdFor();

  try {
    const actor = await requireActor("storage:manage");
    const connections = await listStorageConnections(actor.workspaceId);
    return ok(
      { connections, roles: selectStorageConnections(connections) },
      { headers: apiHeaders(requestId) },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PUT(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("storage:manage");
    await enforceLimit(storageLimiter, actor.userId);
    const value = await readJson(request, storageConnectionInputSchema);
    const connection = await upsertStorageConnection({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      value,
    });

    return ok(connection, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function DELETE(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("storage:manage");
    await enforceLimit(storageLimiter, actor.userId);
    const body = await readJson(request, deleteSchema);
    await deleteStorageConnection({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      id: body.id,
    });

    return ok({ deleted: true }, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
