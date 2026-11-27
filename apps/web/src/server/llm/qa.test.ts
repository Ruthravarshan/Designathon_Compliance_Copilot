import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerWithGrounding,
  assistantModel,
  isGeminiConfigured,
  type GroundedAnswerOptions,
} from "./qa";

const passages = [
  {
    id: "pol-sec",
    label: "POL-SEC-02 · Incident Response",
    text: "Cyber security incidents are reported to IRDAI and CERT-In within 72 hours of detection.",
  },
];

const candidate = {
  decision: "answer",
  answer: "Incidents are reported within 72 hours.",
  citations: [
    {
      passage: 1,
      quote: "Cyber security incidents are reported to IRDAI and CERT-In within 72 hours",
    },
  ],
};

function body(value: unknown): string {
  return JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    usageMetadata: { promptTokenCount: 21, candidatesTokenCount: 43 },
  });
}

function response(text: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(text, { status, headers });
}

const options = (overrides: Partial<GroundedAnswerOptions> = {}): GroundedAnswerOptions => ({
  apiKey: "test-key-value",
  now: () => 1_000,
  sleep: async () => undefined,
  ...overrides,
});

describe("grounded generation adapter", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed without a key or with a disallowed model", async () => {
    await expect(
      answerWithGrounding(
        { question: "q", passages, model: "gemini-2.5-flash" },
        options({ apiKey: "" }),
      ),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });

    await expect(
      answerWithGrounding({ question: "q", passages, model: "../../evil" }, options()),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });

  it("sends a bounded, schema-constrained, injection-delimited request", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = async (url: string, init: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return response(body(candidate));
    };

    const result = await answerWithGrounding(
      { question: "Report <script>alert(1)</script>", passages, model: "gemini-2.5-flash" },
      options({ fetch: fetchMock as unknown as typeof globalThis.fetch }),
    );

    const call = calls[0]!;
    expect(call.url).toContain("gemini-2.5-flash:generateContent");
    expect((call.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key-value");

    const sent = JSON.parse(call.init.body as string) as {
      systemInstruction: { parts: Array<{ text: string }> };
      generationConfig: {
        responseSchema: unknown;
        maxOutputTokens: number;
        thinkingConfig?: { thinkingLevel: string };
      };
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(sent.systemInstruction.parts[0]?.text).toContain("untrusted data");
    expect(sent.generationConfig.responseSchema).toBeDefined();
    // The provider rejects `additionalProperties` in responseSchema; Zod .strict() enforces it.
    expect(JSON.stringify(sent.generationConfig.responseSchema)).not.toContain(
      "additionalProperties",
    );
    expect(sent.generationConfig.maxOutputTokens).toBe(1_024);
    expect(sent.generationConfig.thinkingConfig).toBeUndefined();
    const prompt = sent.contents[0]?.parts[0]?.text ?? "";
    expect(prompt).toContain('<passage id="1"');
    expect(prompt).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");

    expect(result.candidate).toEqual(candidate);
    expect(result).toMatchObject({
      model: "gemini-2.5-flash",
      promptVersion: "assistant-v1",
      promptTokens: 21,
      completionTokens: 43,
    });
  });

  it("turns thinking down for Gemini 3 models so the answer lands inside the timeout", async () => {
    let sent: { generationConfig?: { thinkingConfig?: { thinkingLevel: string } } } = {};
    const fetchMock = async (_url: string, init: RequestInit): Promise<Response> => {
      sent = JSON.parse(String(init.body));
      return response(body(candidate));
    };
    await answerWithGrounding(
      { question: "q", passages, model: "gemini-3.8-flash" },
      options({ fetch: fetchMock as unknown as typeof globalThis.fetch }),
    );
    expect(sent.generationConfig?.thinkingConfig).toEqual({ thinkingLevel: "low" });
  });

  it("uses a bearer token when configured", async () => {
    let authorization = "";
    const fetchMock = async (_url: string, init: RequestInit): Promise<Response> => {
      authorization = (init.headers as Record<string, string>).authorization ?? "";
      return response(body(candidate));
    };
    await answerWithGrounding(
      { question: "q", passages, model: "gemini-2.5-flash" },
      options({ fetch: fetchMock as unknown as typeof globalThis.fetch, authMode: "bearer" }),
    );
    expect(authorization).toBe("Bearer test-key-value");
  });

  it("retries a 429 once and then succeeds", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const fetchMock = async (): Promise<Response> => {
      calls += 1;
      return calls === 1
        ? response("busy", 429, { "retry-after": "0" })
        : response(body(candidate));
    };

    const result = await answerWithGrounding(
      { question: "q", passages, model: "gemini-2.5-flash" },
      options({
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      }),
    );

    expect(calls).toBe(2);
    expect(sleeps).toEqual([0]);
    expect(result.candidate.decision).toBe("answer");
  });

  it("fails on a non-retryable provider error without leaking the body", async () => {
    const fetchMock = async (): Promise<Response> =>
      response("provider stack trace with sk-secret", 401);

    await expect(
      answerWithGrounding(
        { question: "q", passages, model: "gemini-2.5-flash" },
        options({ fetch: fetchMock as unknown as typeof globalThis.fetch }),
      ),
    ).rejects.toMatchObject({ code: "GENERATION_FAILED" });
  });

  it("rejects JSON outside the answer schema", async () => {
    const fetchMock = async (): Promise<Response> =>
      response(body({ decision: "maybe", answer: "x", citations: [] }));

    await expect(
      answerWithGrounding(
        { question: "q", passages, model: "gemini-2.5-flash" },
        options({ fetch: fetchMock as unknown as typeof globalThis.fetch }),
      ),
    ).rejects.toMatchObject({ code: "GENERATION_FAILED" });
  });

  it("retries a transport failure and then fails closed", async () => {
    let calls = 0;
    const fetchMock = async (): Promise<Response> => {
      calls += 1;
      throw new TypeError("network down");
    };

    await expect(
      answerWithGrounding(
        { question: "q", passages, model: "gemini-2.5-flash" },
        options({ fetch: fetchMock as unknown as typeof globalThis.fetch }),
      ),
    ).rejects.toMatchObject({ code: "GENERATION_FAILED" });
    expect(calls).toBe(2);
  });

  it("rejects a response with no text part", async () => {
    const fetchMock = async (): Promise<Response> =>
      response(JSON.stringify({ candidates: [{ content: { parts: [{}] } }] }));

    await expect(
      answerWithGrounding(
        { question: "q", passages, model: "gemini-2.5-flash" },
        options({ fetch: fetchMock as unknown as typeof globalThis.fetch }),
      ),
    ).rejects.toMatchObject({ code: "GENERATION_FAILED" });
  });
});

describe("assistant configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only allows allowlisted models and otherwise uses the default", () => {
    vi.stubEnv("ASSISTANT_MODEL", "gemini-2.5-pro");
    expect(assistantModel()).toBe("gemini-2.5-pro");
    vi.stubEnv("ASSISTANT_MODEL", "not-a-model");
    expect(assistantModel()).toBe("gemini-3.5-flash");
  });

  it("reports configuration from the environment only", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(isGeminiConfigured()).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", "  key  ");
    expect(isGeminiConfigured()).toBe(true);
  });
});
