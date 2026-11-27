import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail, ok } from "@/lib/http";
import { apiHeaders, requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { listStorageConnections } from "@/server/storage/connections";
import { getStorageProvider } from "@/server/storage";
import { selectStorageConnections } from "@/server/storage/selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  connectionId: z.string().trim().min(1).max(64).optional(),
  folderId: z.string().trim().min(1).max(400).optional(),
  pageToken: z.string().trim().min(1).max(2000).optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFor();

  try {
    const actor = await requireActor("storage:manage");
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      connectionId: url.searchParams.get("connectionId") ?? undefined,
      folderId: url.searchParams.get("folderId") ?? undefined,
      pageToken: url.searchParams.get("pageToken") ?? undefined,
    });
    if (!parsed.success) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, "That storage request is not valid.");
    }

    const connections = await listStorageConnections(actor.workspaceId);
    if (connections.length === 0) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        "No storage connection is configured for this workspace yet.",
      );
    }
    const selected = parsed.data.connectionId
      ? connections.find((connection) => connection.id === parsed.data.connectionId)
      : selectStorageConnections(connections).primary;
    if (!selected) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "That storage connection does not exist.");
    }

    const provider = getStorageProvider(selected);
    if (!provider.list) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        "This storage provider does not support browsing. Import the file by URL instead.",
      );
    }

    const listing = await provider.list({
      ...(parsed.data.folderId ? { folderId: parsed.data.folderId } : {}),
      ...(parsed.data.pageToken ? { pageToken: parsed.data.pageToken } : {}),
      limit: 100,
    });

    return ok(
      {
        connection: { id: selected.id, provider: selected.provider },
        entries: listing.entries,
        ...(listing.nextPageToken ? { nextPageToken: listing.nextPageToken } : {}),
      },
      { headers: apiHeaders(requestId) },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
