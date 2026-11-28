import { AppError, type ErrorCode } from "@/lib/errors";

/**
 * Safe, closed set of ingestion codes. Provider bodies, document text, URLs
 * with credentials, and secrets never enter these errors or the logs.
 */
export const INGESTION_ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  HOST_NOT_ALLOWED: "HOST_NOT_ALLOWED",
  UNSUPPORTED_SCHEME: "UNSUPPORTED_SCHEME",
  CREDENTIALS_NOT_ALLOWED: "CREDENTIALS_NOT_ALLOWED",
  DNS_RESOLUTION_FAILED: "DNS_RESOLUTION_FAILED",
  PRIVATE_ADDRESS_BLOCKED: "PRIVATE_ADDRESS_BLOCKED",
  TOO_MANY_REDIRECTS: "TOO_MANY_REDIRECTS",
  REDIRECT_NOT_ALLOWED: "REDIRECT_NOT_ALLOWED",
  FETCH_TIMEOUT: "FETCH_TIMEOUT",
  RESPONSE_TOO_LARGE: "RESPONSE_TOO_LARGE",
  FETCH_FAILED: "FETCH_FAILED",
  ROBOTS_DISALLOWED: "ROBOTS_DISALLOWED",
  NO_DOCUMENTS_FOUND: "NO_DOCUMENTS_FOUND",
  UNSUPPORTED_CONTENT: "UNSUPPORTED_CONTENT",
  INVALID_PDF: "INVALID_PDF",
  ENCRYPTED_PDF: "ENCRYPTED_PDF",
  NO_TEXT_LAYER: "NO_TEXT_LAYER",
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  INTEGRATION_NOT_CONFIGURED: "INTEGRATION_NOT_CONFIGURED",
  DUPLICATE_DOCUMENT: "DUPLICATE_DOCUMENT",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  INTERNAL: "INTERNAL",
} as const;

export type IngestionErrorCode = keyof typeof INGESTION_ERROR_CODES;

const DEFAULT_STATUS: Record<IngestionErrorCode, number> = {
  BAD_REQUEST: 400,
  HOST_NOT_ALLOWED: 403,
  UNSUPPORTED_SCHEME: 400,
  CREDENTIALS_NOT_ALLOWED: 400,
  DNS_RESOLUTION_FAILED: 502,
  PRIVATE_ADDRESS_BLOCKED: 403,
  TOO_MANY_REDIRECTS: 400,
  REDIRECT_NOT_ALLOWED: 400,
  FETCH_TIMEOUT: 504,
  RESPONSE_TOO_LARGE: 413,
  FETCH_FAILED: 502,
  ROBOTS_DISALLOWED: 403,
  NO_DOCUMENTS_FOUND: 404,
  UNSUPPORTED_CONTENT: 415,
  INVALID_PDF: 415,
  ENCRYPTED_PDF: 415,
  NO_TEXT_LAYER: 422,
  EXTRACTION_FAILED: 502,
  STORAGE_UNAVAILABLE: 503,
  INTEGRATION_NOT_CONFIGURED: 503,
  DUPLICATE_DOCUMENT: 409,
  PERSISTENCE_FAILED: 502,
  INTERNAL: 500,
};

const RETRYABLE: ReadonlySet<IngestionErrorCode> = new Set<IngestionErrorCode>([
  "DNS_RESOLUTION_FAILED",
  "FETCH_TIMEOUT",
  "FETCH_FAILED",
  "STORAGE_UNAVAILABLE",
  "EXTRACTION_FAILED",
  "PERSISTENCE_FAILED",
  "INTERNAL",
]);

export interface IngestionErrorOptions {
  status?: number;
  cause?: unknown;
}

/**
 * Extends AppError so the shared error envelope handles it. The ErrorCode union
 * is owned by the backend; these ingestion-specific codes are bridged here
 * without weakening the local type.
 */
export class IngestionError extends AppError {
  readonly ingestionCode: IngestionErrorCode;

  constructor(code: IngestionErrorCode, message: string, options: IngestionErrorOptions = {}) {
    super(code as unknown as ErrorCode, message, {
      status: options.status ?? DEFAULT_STATUS[code],
      expose: true,
      cause: options.cause,
    });
    this.name = "IngestionError";
    this.ingestionCode = code;
  }
}

export function safeErrorCode(error: unknown): IngestionErrorCode {
  return error instanceof IngestionError ? error.ingestionCode : "INTERNAL";
}

export function isRetryableCode(code: IngestionErrorCode): boolean {
  return RETRYABLE.has(code);
}
