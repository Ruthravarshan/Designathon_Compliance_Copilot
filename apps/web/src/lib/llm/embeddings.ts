import { z } from "zod";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const EMBEDDING_DIMENSIONS = 768;
export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_INPUT_CHARS = 6_000;
const MAX_ATTEMPTS = 2;

const responseSchema = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()).length(EMBEDDING_DIMENSIONS) })),
});

export class EmbeddingError extends Error {
  readonly code: "NOT_CONFIGURED" | "EMBEDDING_FAILED";

  constructor(code: "NOT_CONFIGURED" | "EMBEDDING_FAILED", message: string) {
    super(message);
    this.name = "EmbeddingError";
    this.code = code;
  }
}

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface EmbeddingOptions {
  taskType?: EmbeddingTaskType;
  apiKey?: string;
  authMode?: "api-key" | "bearer";
  model?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  batchSize?: number;
  sleep?: (ms: number) => Promise<void>;
}

export function isEmbeddingConfigured(): boolean {
  return z.string().trim().min(1).safeParse(process.env.GEMINI_API_KEY).success;
}

export function embeddingModel(): string {
  const configured = process.env.GEMINI_EMBEDDING_MODEL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_EMBEDDING_MODEL;
}

function authHeaders(apiKey: string, authMode: "api-key" | "bearer"): Record<string, string> {
  return authMode === "bearer"
    ? { "content-type": "application/json", authorization: `Bearer ${apiKey}` }
    : { "content-type": "application/json", "x-goog-api-key": apiKey };
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Embeds text with Gemini. Returns one 768-dimension vector per input, in input
 * order. Throws rather than returning placeholder vectors: a fabricated vector
 * would silently corrupt retrieval.
 */
export async function embedTexts(
  texts: readonly string[],
  options: EmbeddingOptions = {},
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const key = z
    .string()
    .trim()
    .min(1)
    .safeParse(options.apiKey ?? process.env.GEMINI_API_KEY);
  if (!key.success) {
    throw new EmbeddingError("NOT_CONFIGURED", "Embeddings are not configured.");
  }

  const mode = z
    .enum(["api-key", "bearer"])
    .default("api-key")
    .safeParse(options.authMode ?? process.env.GEMINI_AUTH_MODE);
  const authMode = mode.success ? mode.data : "api-key";
  const model = options.model ?? embeddingModel();
  const taskType = options.taskType ?? "RETRIEVAL_DOCUMENT";
  const httpFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const batchSize = Math.max(1, Math.min(options.batchSize ?? DEFAULT_BATCH_SIZE, 100));
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const output: number[][] = [];
  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts
      .slice(start, start + batchSize)
      .map((text) => (text.trim().length === 0 ? " " : text.slice(0, MAX_INPUT_CHARS)));

    const body = JSON.stringify({
      requests: batch.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    });

    const url = `${API_BASE}/${encodeURIComponent(model)}:batchEmbedContents`;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await httpFetch(url, {
          method: "POST",
          headers: authHeaders(key.data, authMode),
          body,
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });

        if (!response.ok) {
          if (isRetryable(response.status) && attempt < MAX_ATTEMPTS - 1) {
            await sleep(400 * 2 ** attempt);
            continue;
          }
          throw new EmbeddingError(
            "EMBEDDING_FAILED",
            `The embedding provider returned ${response.status}.`,
          );
        }

        const parsed = responseSchema.safeParse(await response.json());
        if (!parsed.success || parsed.data.embeddings.length !== batch.length) {
          throw new EmbeddingError(
            "EMBEDDING_FAILED",
            "The embedding provider returned an unexpected payload.",
          );
        }
        for (const embedding of parsed.data.embeddings) {
          output.push(embedding.values);
        }
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (error instanceof EmbeddingError) {
          throw error;
        }
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(400 * 2 ** attempt);
          continue;
        }
      }
    }

    if (lastError) {
      throw lastError instanceof EmbeddingError
        ? lastError
        : new EmbeddingError("EMBEDDING_FAILED", "The embedding request failed.");
    }
  }

  return output;
}
