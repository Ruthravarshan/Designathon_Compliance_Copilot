import { describe, expect, it } from "vitest";
import {
  createHostLimiter,
  discoverPdfs,
  fetchListing,
  isPdfUrl,
  type DiscoverOptions,
} from "./discover";
import type { FetchTransport, ResolvedAddress, TransportResult } from "./fetch";

const publicIp: ResolvedAddress = { address: "93.184.216.34", family: 4 };
const base = new URL("https://regulator.example/circulars/index.html");
const options = (overrides: Partial<DiscoverOptions> = {}): DiscoverOptions => ({
  allowedDomains: ["regulator.example"],
  userAgent: "PolicyPulse/2.0 (test)",
  resolve: async () => [publicIp],
  transport: async () => ({ status: 200, headers: {}, bytes: new Uint8Array() }),
  now: () => 1_000,
  ...overrides,
});

function htmlResponse(body: string, contentType = "text/html"): TransportResult {
  return {
    status: 200,
    headers: { "content-type": contentType },
    bytes: new TextEncoder().encode(body),
  };
}

describe("PDF link detection", () => {
  it("accepts only concrete PDF targets", () => {
    expect(isPdfUrl(new URL("https://regulator.example/a.PDF"))).toBe(true);
    expect(isPdfUrl(new URL("https://regulator.example/download?file=report.pdf"))).toBe(true);
    expect(isPdfUrl(new URL("https://regulator.example/get?format=pdf"))).toBe(true);
    expect(isPdfUrl(new URL("https://regulator.example/download?file=report.pdf.exe"))).toBe(false);
    expect(isPdfUrl(new URL("https://regulator.example/a.html"))).toBe(false);
    expect(isPdfUrl(new URL("https://regulator.example/a.pdf#page=2"))).toBe(true);
  });
});

describe("bounded discovery", () => {
  it("keeps unique same-host PDF links with a shared retrieval time", () => {
    const html = `
      <a href="/a.pdf">A</a>
      <a href="B.PDF">B</a>
      <a href="/download?file=c.pdf">C</a>
      <a href="/a.pdf">duplicate</a>
      <a href="/page.html">not a pdf</a>
      <a href="javascript:alert(1)">script</a>
      <a href="https://elsewhere.example/x.pdf">outside</a>
      <a href="https://user:pass@regulator.example/x.pdf">credentials</a>
      <a href="http://regulator.example/insecure.pdf">downgrade</a>
    `;
    const result = discoverPdfs(html, base, options());
    expect(result.pdfs.map((item) => item.url.pathname)).toEqual([
      "/a.pdf",
      "/circulars/B.PDF",
      "/download",
    ]);
    expect(result.pdfs[2]?.url.searchParams.get("file")).toBe("c.pdf");
    expect(result.pdfs.every((item) => item.url.hash === "")).toBe(true);
    expect(result.pdfs[0]?.retrievedAt.toISOString()).toBe(new Date(1_000).toISOString());
    expect(result.skipped).toBeGreaterThan(0);
  });

  it("caps candidates and documents and reports truncation", () => {
    const html = Array.from(
      { length: 80 },
      (_unused, index) => `<a href="/doc-${index}.pdf">x</a>`,
    ).join("");
    const result = discoverPdfs(html, base, options({ maxCandidates: 10, maxDocuments: 3 }));
    expect(result.candidates).toBe(10);
    expect(result.pdfs).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });

  it("can include other allowlisted hosts when explicitly opted in", () => {
    const html = '<a href="https://docs.regulator.example/a.pdf">A</a>';
    const wildcard = options({ allowedDomains: ["*.regulator.example"] });
    expect(discoverPdfs(html, base, wildcard).pdfs).toHaveLength(0);
    expect(discoverPdfs(html, base, { ...wildcard, sameHostOnly: false }).pdfs).toHaveLength(1);
  });

  it("does not follow a redirect to a non-HTML listing or fetch a fake PDF", async () => {
    const transport: FetchTransport = async (input) =>
      input.url.pathname === "/robots.txt"
        ? { status: 200, headers: {}, bytes: new TextEncoder().encode("User-agent: *") }
        : htmlResponse("<a href='/a.pdf'>A</a>", "application/pdf");
    await expect(fetchListing(base, options({ transport }))).rejects.toMatchObject({
      ingestionCode: "UNSUPPORTED_CONTENT",
    });
  });

  it("fetches robots once and fails truthfully on no PDFs or disallow", async () => {
    const calls: string[] = [];
    const transport: FetchTransport = async (input) => {
      calls.push(input.url.pathname);
      if (input.url.pathname === "/robots.txt") {
        return {
          status: 200,
          headers: {},
          bytes: new TextEncoder().encode("User-agent: *\nDisallow:"),
        };
      }
      return htmlResponse("<html><body>No documents here</body></html>");
    };
    await expect(fetchListing(base, options({ transport }))).rejects.toMatchObject({
      ingestionCode: "NO_DOCUMENTS_FOUND",
    });
    expect(calls).toEqual(["/robots.txt", "/circulars/index.html"]);

    const denied: FetchTransport = async (input) =>
      input.url.pathname === "/robots.txt"
        ? htmlResponse("User-agent: *\nDisallow: /circulars")
        : htmlResponse("<a href='/a.pdf'>A</a>");
    await expect(fetchListing(base, options({ transport: denied }))).rejects.toMatchObject({
      ingestionCode: "ROBOTS_DISALLOWED",
    });
  });

  it("returns the PDF links from a real listing response", async () => {
    const transport: FetchTransport = async (input) =>
      input.url.pathname === "/robots.txt"
        ? htmlResponse("User-agent: *")
        : htmlResponse('<ul><li><a href="/2026/circular-one.pdf">One</a></li></ul>');
    const result = await fetchListing(base, options({ transport }));
    expect(result.pdfs).toHaveLength(1);
    expect(result.pdfs[0]?.url.toString()).toBe("https://regulator.example/2026/circular-one.pdf");
  });
});

describe("per-host crawl limiter", () => {
  it("allows at most two in flight and at least 300ms between starts", async () => {
    let time = 0;
    const starts: number[] = [];
    const sleeps: number[] = [];
    let inFlight = 0;
    let peak = 0;
    const limiter = createHostLimiter({
      now: () => time,
      sleep: async (ms) => {
        sleeps.push(ms);
        time += ms;
      },
    });

    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const task = async (): Promise<void> => {
      starts.push(time);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await gate;
      inFlight -= 1;
    };

    const all = Promise.all([
      limiter.run(base, task),
      limiter.run(base, task),
      limiter.run(base, task),
      limiter.run(base, task),
    ]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(starts).toEqual([0, 300]);
    expect(peak).toBe(2);
    release();
    await all;
    expect(starts).toEqual([0, 300, 600, 900]);
    expect(sleeps).toEqual([300, 300, 300]);
  });

  it("schedules different hosts independently", async () => {
    let time = 0;
    const starts: string[] = [];
    const limiter = createHostLimiter({
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
    });
    const other = new URL("https://other.regulator.example/a.pdf");
    await Promise.all([
      limiter.run(base, async () => {
        starts.push(base.host);
      }),
      limiter.run(other, async () => {
        starts.push(other.host);
      }),
    ]);
    expect(starts).toEqual([base.host, other.host]);
  });

  it("surfaces a task failure to the caller and frees the slot", async () => {
    const limiter = createHostLimiter({ sleep: async () => undefined });
    await expect(
      limiter.run(base, async () => {
        throw new Error("provider detail must not escape");
      }),
    ).rejects.toThrow("provider detail must not escape");
    await expect(limiter.run(base, async () => 7)).resolves.toBe(7);
  });
});
