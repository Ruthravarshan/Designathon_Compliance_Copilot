export interface ApiErrorShape {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

export type ParsedApiResult<T> =
  | { ok: true; data: T; requestId: string | null }
  | { ok: false; status: number; error: ApiErrorShape };

/** Safely parse `{ data }` or `{ error }` JSON envelopes from same-origin `/api/*` calls. */
export async function parseApiResponse<T>(response: Response): Promise<ParsedApiResult<T>> {
  const headerRequestId = response.headers.get("x-request-id");
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok && payload !== null && typeof payload === "object" && "data" in payload) {
    return {
      ok: true,
      data: (payload as { data: T }).data,
      requestId: headerRequestId,
    };
  }

  if (
    payload !== null &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error !== null &&
    typeof payload.error === "object"
  ) {
    const err = payload.error as Record<string, unknown>;
    return {
      ok: false,
      status: response.status,
      error: {
        code: typeof err.code === "string" ? err.code : "REQUEST_FAILED",
        message: typeof err.message === "string" ? err.message : "That didn't save. Try again.",
        requestId:
          typeof err.requestId === "string" ? err.requestId : (headerRequestId ?? undefined),
        details: err.details,
      },
    };
  }

  return {
    ok: false,
    status: response.status,
    error: {
      code: "REQUEST_FAILED",
      message: "That didn't save. Try again.",
      requestId: headerRequestId ?? undefined,
    },
  };
}

export const REJECTION_NOTE_MIN = 10;
export const REJECTION_NOTE_MAX = 2000;

export function validateRejectionNote(note: string): {
  valid: boolean;
  trimmedLength: number;
  error: string | null;
} {
  const trimmed = note.trim();
  if (trimmed.length < REJECTION_NOTE_MIN) {
    return {
      valid: false,
      trimmedLength: trimmed.length,
      error: `The note must be at least ${REJECTION_NOTE_MIN} characters.`,
    };
  }
  if (trimmed.length > REJECTION_NOTE_MAX) {
    return {
      valid: false,
      trimmedLength: trimmed.length,
      error: `The note cannot exceed ${REJECTION_NOTE_MAX} characters.`,
    };
  }
  return {
    valid: true,
    trimmedLength: trimmed.length,
    error: null,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
