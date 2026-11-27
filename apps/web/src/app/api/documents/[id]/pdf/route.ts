import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail } from "@/lib/http";
import { requestIdFor } from "@/server/api";
import { requireActor } from "@/server/auth/actor";
import { db } from "@/server/db";
import { getStorageConnection } from "@/server/storage/connections";
import { getStorageProvider } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRange(value: string | null, size: number): { start: number; end: number } | null {
  if (!value) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return null;
  }
  const start = rawStart ? Number.parseInt(rawStart, 10) : 0;
  const end = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

function safeFilename(name: string | null): string {
  const base = (name ?? "document.pdf").split(/[\\/]/).pop() ?? "document.pdf";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "-").slice(0, 140).trim();
  return cleaned.length > 0 ? cleaned : "document.pdf";
}

function disposition(filename: string, download: boolean): string {
  const fallback = filename.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "");
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFor();

  try {
    const actor = await requireActor("document:read");
    const { id } = await context.params;
    if (!/^[a-z0-9]{10,64}$/i.test(id)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, "That document id is not valid.");
    }

    const document = await db.regulatoryDocument.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      select: {
        fileBytes: true,
        fileContentType: true,
        filename: true,
        storageConnectionId: true,
        storageItemId: true,
      },
    });
    if (!document) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Circular not found.");
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    const filename = safeFilename(document.filename);
    const headers = new Headers({
      "content-type": document.fileContentType ?? "application/pdf",
      "content-disposition": disposition(filename, download),
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
      "accept-ranges": "bytes",
    });

    if (document.fileBytes && document.fileBytes.byteLength > 0) {
      const size = document.fileBytes.byteLength;
      const range = parseRange(request.headers.get("range"), size);
      if (request.headers.get("range") && !range) {
        headers.set("content-range", `bytes */${size}`);
        return new Response(null, { status: 416, headers });
      }
      if (range) {
        const slice = document.fileBytes.subarray(range.start, range.end + 1);
        headers.set("content-length", String(slice.byteLength));
        headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
        return new Response(slice, { status: 206, headers });
      }
      headers.set("content-length", String(size));
      return new Response(document.fileBytes, { status: 200, headers });
    }

    if (document.storageConnectionId && document.storageItemId) {
      const connection = await getStorageConnection(actor.workspaceId, document.storageConnectionId);
      if (connection) {
        // The provider streams the whole file; byte ranges are served from the
        // archived copy above, so this path advertises no range support.
        headers.delete("accept-ranges");
        const result = await getStorageProvider(connection).read({
          itemId: document.storageItemId,
        });
        headers.set("content-type", result.contentType);
        if (result.contentLength !== undefined) {
          headers.set("content-length", String(result.contentLength));
        }
        return new Response(result.body, { status: 200, headers });
      }
    }

    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      "This circular has no archived PDF. Re-ingest it with the official file.",
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
