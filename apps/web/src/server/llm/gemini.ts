import { z } from "zod";
import { IngestionError } from "@/server/ingestion/errors";
import { isAllowedModel } from "./prompt";
import {
  candidateExtractionSchema,
  GEMINI_RESPONSE_SCHEMA,
  normalizeCandidate,
  type CandidateExtraction,
} from "./schema";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_OUTPUT_TOKENS = 4_096;
const MAX_BACKOFF_MS = 8_000;
const MAX_RETRY_AFTER_MS = 30_000;

const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })),
        }),
      }),
    )
    .min(1),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().int().nonnegative().optional(),
      candidatesTokenCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export interface GeminiInput {
  prompt: string;
  model: string;
}

export interface GeminiResult {
  candidate: CandidateExtraction;
  model: string;
  promptVersion: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
}

export interface GeminiOptions {
  apiKey?: string;
  authMode?: "api-key" | "bearer";
  promptVersion?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  timeoutMs?: number;
  maxOutputTokens?: number;
}

function requiredKey(explicit: string | undefined): string {
  const value = explicit ?? process.env.GEMINI_API_KEY;
  const parsed = z.string().trim().min(1).safeParse(value);
  if (!parsed.success) {
    throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "Gemini is not configured.");
  }
  return parsed.data;
}

function authMode(): "api-key" | "bearer" {
  const parsed = z.enum(["api-key", "bearer"]).default("api-key").safeParse(process.env.GEMINI_AUTH_MODE);
  return parsed.success ? parsed.data : "api-key";
}

/** Retry-After may be seconds or an HTTP date; anything else falls back to jittered backoff. */
export function retryDelayMs(header: string | null, attempt: number, now: () => number): number {
  const backoff = Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
  if (!header) {
    return backoff;
  }
  const seconds = Number.parseInt(header.trim(), 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_AFTER_MS, seconds * 1000);
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, date - now()));
  }
  return backoff;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Server-only Gemini call. The key never appears in an error or a body sent to
 * a caller; provider responses are reduced to a safe code and token counts.
 */
export async function generateExtraction(
  input: GeminiInput,
  options: GeminiOptions = {},
): Promise<GeminiResult> {
  if (!isAllowedModel(input.model)) {
    throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "The configured Gemini model is not allowed.");
  }
  const key = requiredKey(options.apiKey);
  const mode = options.authMode ?? authMode();
  const httpFetch = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const promptVersion = options.promptVersion ?? "extract-v1";
  const url = `${API_BASE}/${encodeURIComponent(input.model)}:generateContent`;

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (mode === "bearer") {
    headers.authorization = `Bearer ${key}`;
  } else {
    headers["x-goog-api-key"] = key;
  }

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  });

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const startedAt = now();
    try {
      const response = await httpFetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < maxAttempts - 1) {
          await sleep(retryDelayMs(response.headers.get("retry-after"), attempt, now));
          continue;
        }
        throw new IngestionError("EXTRACTION_FAILED", "Gemini could not extract the document.");
      }

      const parsedResponse = responseSchema.safeParse(await response.json());
      if (!parsedResponse.success) {
        throw new IngestionError("EXTRACTION_FAILED", "Gemini returned an unusable response.");
      }
      const text = parsedResponse.data.candidates[0]?.content.parts
        .map((part) => part.text ?? "")
        .join("");
      if (!text) {
        throw new IngestionError("EXTRACTION_FAILED", "Gemini returned an unusable response.");
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new IngestionError("EXTRACTION_FAILED", "Gemini returned unusable JSON.");
      }
      const candidate = candidateExtractionSchema.safeParse(json);
      if (!candidate.success) {
        throw new IngestionError("EXTRACTION_FAILED", "Gemini returned a response outside the schema.");
      }

      return {
        candidate: normalizeCandidate(candidate.data),
        model: input.model,
        promptVersion,
        latencyMs: Math.max(0, now() - startedAt),
        promptTokens: parsedResponse.data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: parsedResponse.data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    } catch (error) {
      if (error instanceof IngestionError) {
        // Schema/JSON errors are terminal: falling back is safer than retrying a bad prompt.
        throw error;
      }
      if (attempt < maxAttempts - 1) {
        await sleep(retryDelayMs(null, attempt, now));
        continue;
      }
      throw new IngestionError("EXTRACTION_FAILED", "Gemini could not be reached.");
    }
  }

  throw new IngestionError("EXTRACTION_FAILED", "Gemini could not extract the document.");
}
