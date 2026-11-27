import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateExtraction, retryDelayMs, type GeminiOptions } from "./gemini";

const candidate = {
  title: "Circular",
  issuer: "RBI",
  reference: "RBI/2026/1",
  summary: "A circular",
  publishedAt: "2026-01-02",
  effectiveAt: null,
  obligations: [
    {
      type: "SECURITY_TESTING",
      plainLanguage: "Run a test",
      actionRequired: "Run it",
      applicableTo: "CISO",
      quotes: [{ quote: "The bank shall complete a vulnerability assessment every six months.", pageNumber: 1 }],
    },
  ],
  policyAreas: ["security"],
  riskSuggestion: null,
};

function body(value: unknown): string {
  return JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 },
  });
}

function response(text: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(text, { status, headers });
}

const options = (overrides: Partial<GeminiOptions> = {}): GeminiOptions => ({
  apiKey: "test-key-value",
  now: () => 1_000,
  sleep: async () => undefined,
  ...overrides,
});

describe("Gemini adapter", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed with no key and a disallowed model", async () => {
    await expect(
      generateExtraction({ prompt: "x", model: "gemini-2.5-flash" }, options({ apiKey: undefined })),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });
    await expect(
      generateExtraction({ prompt: "x", model: "../../evil" }, options()),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });
  });

  it("sends a bounded, schema-constrained request and returns only safe metadata", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = async (url: string, init: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return response(body(candidate));
    };
    const result = await generateExtraction(
      { prompt: "extract this", model: "gemini-2.5-flash" },
      options({ fetch: fetchMock as unknown as typeof globalThis.fetch }),
    );

    expect(result).toMatchObject({
      model: "gemini-2.5-flash",
      promptVersion: "extract-v1",
      latencyMs: 0,
      promptTokens: 12,
      completionTokens: 34,
    });
    expect(result.candidate.title).toBe("Circular");
    expect(calls[0]?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect((calls[0]?.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key-value");
    const sent = JSON.parse(String(calls[0]?.init.body)) as {
      generationConfig: { temperature: number; responseMimeType: string; maxOutputTokens: number };
    };
    expect(sent.generationConfig.temperature).toBeLessThanOrEqual(0.2);
    expect(sent.generationConfig.responseMimeType).toBe("application/json");
    expect(sent.generationConfig.maxOutputTokens).toBeLessThanOrEqual(8_192);
  });

  it("supports the bearer auth switch without guessing", async () => {
    let seen: Record<string, string> = {};
    const fetchMock = async (_url: string, init: RequestInit): Promise<Response> => {
      seen = init.headers as Record<string, string>;
      return response(body(candidate));
    };
    await generateExtraction(
      { prompt: "x", model: "gemini-2.5-flash" },
      options({ authMode: "bearer", fetch: fetchMock as unknown as typeof globalThis.fetch }),
    );
    expect(seen.authorization).toBe("Bearer test-key-value");
    expect(seen).not.toHaveProperty("x-goog-api-key");
  });

  it("retries 429 and 5xx with backoff, then succeeds", async () => {
    const sleeps: number[] = [];
    let attempt = 0;
    const fetchMock = async (): Promise<Response> => {
      attempt += 1;
      return attempt < 3 ? response("provider body with secret", 503, { "retry-after": "0" }) : response(body(candidate));
    };
    const result = await generateExtraction(
      { prompt: "x", model: "gemini-2.5-flash" },
      options({ fetch: fetchMock as unknown as typeof globalThis.fetch, sleep: async (ms) => { sleeps.push(ms); } }),
    );
    expect(attempt).toBe(3);
    expect(sleeps).toHaveLength(2);
    expect(result.candidate.issuer).toBe("RBI");
  });

  it("stops on 400/401/403 and invalid output without echoing the provider body", async () => {
    for (const status of [400, 401, 403]) {
      let calls = 0;
      const fetchMock = async (): Promise<Response> => {
        calls += 1;
        return response("key=secret&detail=internal", status);
      };
      await expect(
        generateExtraction(
          { prompt: "x", model: "gemini-2.5-flash" },
          options({ fetch: fetchMock as unknown as typeof globalThis.fetch }),
        ),
      ).rejects.toMatchObject({
        ingestionCode: "EXTRACTION_FAILED",
        message: expect.not.stringContaining("secret"),
      });
      expect(calls).toBe(1);
    }

    for (const payload of ["not json", JSON.stringify({ candidates: [] }), JSON.stringify({ ...candidate, invented: true })]) {
      await expect(
        generateExtraction(
          { prompt: "x", model: "gemini-2.5-flash" },
          options({ fetch: (async () => response(body(payload))) as unknown as typeof globalThis.fetch }),
        ),
      ).rejects.toMatchObject({ ingestionCode: "EXTRACTION_FAILED" });
    }
  });

  it("exhausts retries and maps network failures to a safe code", async () => {
    const fetchMock = async (): Promise<Response> => {
      throw new Error("connect detail with token=secret");
    };
    await expect(
      generateExtraction(
        { prompt: "x", model: "gemini-2.5-flash" },
        options({ fetch: fetchMock as unknown as typeof globalThis.fetch }),
      ),
    ).rejects.toMatchObject({ ingestionCode: "EXTRACTION_FAILED", message: expect.not.stringContaining("secret") });
  });

  it("uses Retry-After seconds or date, capped", () => {
    expect(retryDelayMs("2", 0, () => 0)).toBe(2_000);
    expect(retryDelayMs("", 0, () => 0)).toBeGreaterThan(0);
    expect(retryDelayMs("not-a-date", 0, () => 0)).toBeGreaterThan(0);
    expect(retryDelayMs("999999", 0, () => 0)).toBe(30_000);
  });
});
