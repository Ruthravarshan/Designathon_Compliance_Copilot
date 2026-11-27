import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import {
  assertRobotsAllowed,
  createRobotsCache,
  defaultTransport,
  fetchUrl,
  isBlockedAddress,
  isHostAllowed,
  parseHttpUrl,
  parseRobots,
  robotsAllows,
  userAgentFor,
  type FetchOptions,
  type FetchTransport,
  type ResolvedAddress,
  type TransportResult,
} from "./fetch";
import { IngestionError } from "./errors";

const publicIp: ResolvedAddress = { address: "93.184.216.34", family: 4 };
const options = (overrides: Partial<FetchOptions> = {}): FetchOptions => ({
  allowedDomains: ["regulator.example"],
  userAgent: "PolicyPulse/2.0 (test)",
  resolve: async () => [publicIp],
  transport: async () => ({ status: 200, headers: {}, bytes: new Uint8Array([1, 2, 3]) }),
  now: () => 1_000,
  ...overrides,
});

function result(
  status: number,
  headers: Record<string, string> = {},
  text = "ok",
): TransportResult {
  return { status, headers, bytes: new TextEncoder().encode(text) };
}

describe("host allowlist and URL validation", () => {
  it("matches exact hosts and wildcard subdomains only", () => {
    expect(isHostAllowed("regulator.example", ["regulator.example"])).toBe(true);
    expect(isHostAllowed("docs.regulator.example", ["*.regulator.example"])).toBe(true);
    expect(isHostAllowed("regulator.example", ["*.regulator.example"])).toBe(false);
    expect(isHostAllowed("evilregulator.example", ["regulator.example"])).toBe(false);
    expect(isHostAllowed("regulator.example.evil.test", ["regulator.example"])).toBe(false);
    expect(isHostAllowed("REGULATOR.EXAMPLE.", ["regulator.example"])).toBe(true);
  });

  it("rejects invalid, credentialed, nonstandard and literal-IP URLs", () => {
    expect(() => parseHttpUrl("ftp://regulator.example/a.pdf", false)).toThrow(IngestionError);
    expect(() => parseHttpUrl("http://regulator.example/a.pdf", false)).toThrow(IngestionError);
    expect(() => parseHttpUrl("https://user:pass@regulator.example/a.pdf", true)).toThrow(
      IngestionError,
    );
    expect(() => parseHttpUrl("https://regulator.example:8443/a.pdf", true)).toThrow(
      IngestionError,
    );
    expect(() => parseHttpUrl("https://127.0.0.1/a.pdf", true)).toThrow(IngestionError);
    expect(() => parseHttpUrl("x".repeat(3000), true)).toThrow(IngestionError);
    expect(parseHttpUrl("https://regulator.example/a.pdf", false).hostname).toBe(
      "regulator.example",
    );
  });
});

describe("SSRF address guard", () => {
  it("blocks private, loopback, link-local, metadata and multicast IPv4", () => {
    for (const address of [
      "0.0.0.0",
      "10.1.2.3",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "100.64.0.1",
      "198.18.0.1",
      "224.0.0.1",
      "255.255.255.255",
      "192.0.0.1",
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it("blocks loopback, unique-local, link-local, multicast and mapped IPv6", () => {
    for (const address of [
      "::",
      "::1",
      "fc00::1",
      "fd12::1",
      "fe80::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "64:ff9b::a00:1",
      "2002:0a00:1::1",
      "2001:db8::1",
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedAddress("93.184.216.34")).toBe(false);
    expect(isBlockedAddress("not-an-ip")).toBe(true);
  });

  it("rejects a host whose DNS resolves only to private addresses", async () => {
    await expect(
      fetchUrl(
        "https://regulator.example/a.pdf",
        options({
          resolve: async () => [{ address: "169.254.169.254", family: 4 }],
        }),
      ),
    ).rejects.toMatchObject({ ingestionCode: "PRIVATE_ADDRESS_BLOCKED" });
  });

  it("connects using the resolved address, not a second DNS lookup", async () => {
    const transport = vi.fn(async () => result(200));
    const seen: ResolvedAddress[] = [];
    await fetchUrl(
      "https://regulator.example/a.pdf",
      options({
        transport: async (input) => {
          seen.push(input.address);
          return transport();
        },
      }),
    );
    expect(seen).toEqual([publicIp]);
  });
});

describe("fetch bounds and redirects", () => {
  it("re-checks allowlist on redirect and blocks a private target", async () => {
    const transport: FetchTransport = async (input) => {
      if (input.url.pathname === "/start") {
        return result(302, { location: "https://169.254.169.254/latest/meta-data" });
      }
      return result(200);
    };
    await expect(
      fetchUrl("https://regulator.example/start", options({ transport })),
    ).rejects.toMatchObject({ ingestionCode: "HOST_NOT_ALLOWED" });
  });

  it("rejects a redirect outside the allowlist and a scheme downgrade", async () => {
    const outside: FetchTransport = async () =>
      result(302, { location: "https://elsewhere.example/a.pdf" });
    await expect(
      fetchUrl("https://regulator.example/start", options({ transport: outside })),
    ).rejects.toMatchObject({ ingestionCode: "HOST_NOT_ALLOWED" });

    const downgrade: FetchTransport = async () =>
      result(302, { location: "http://regulator.example/a.pdf" });
    await expect(
      fetchUrl(
        "https://regulator.example/start",
        options({ transport: downgrade, allowHttp: false }),
      ),
    ).rejects.toMatchObject({ ingestionCode: "UNSUPPORTED_SCHEME" });
  });

  it("caps redirects at five hops", async () => {
    const transport: FetchTransport = async () => result(302, { location: "/next" });
    await expect(
      fetchUrl("https://regulator.example/start", options({ transport })),
    ).rejects.toMatchObject({ ingestionCode: "TOO_MANY_REDIRECTS" });
  });

  it("follows a relative redirect and returns content metadata", async () => {
    const transport: FetchTransport = async (input) =>
      input.url.pathname === "/start"
        ? result(302, { location: "/doc.pdf" })
        : result(200, { "content-type": "application/pdf; charset=binary" }, "pdf");
    const fetched = await fetchUrl("https://regulator.example/start", options({ transport }));
    expect(fetched.url.pathname).toBe("/doc.pdf");
    expect(fetched.contentType).toBe("application/pdf");
    expect(fetched.retrievedAt.toISOString()).toBe(new Date(1_000).toISOString());
  });

  it("maps unsuccessful and redirect-without-target responses to safe codes", async () => {
    await expect(
      fetchUrl(
        "https://regulator.example/a",
        options({ transport: async () => result(404, {}, "secret body") }),
      ),
    ).rejects.toMatchObject({
      ingestionCode: "FETCH_FAILED",
      message: expect.not.stringContaining("secret"),
    });
    await expect(
      fetchUrl("https://regulator.example/a", options({ transport: async () => result(302) })),
    ).rejects.toMatchObject({ ingestionCode: "FETCH_FAILED" });
  });
});

describe("default transport", () => {
  it("aborts a response larger than maxBytes", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/octet-stream" });
      response.end(Buffer.alloc(256, 7));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const url = new URL(`http://127.0.0.1:${port}/big`);
      await expect(
        defaultTransport({
          url,
          address: { address: "127.0.0.1", family: 4 },
          headers: { "user-agent": "PolicyPulse/2.0 (test)" },
          timeoutMs: 2_000,
          maxBytes: 32,
        }),
      ).rejects.toMatchObject({ ingestionCode: "RESPONSE_TOO_LARGE" });
    } finally {
      server.close();
    }
  });
});

describe("robots and user agent", () => {
  it("parses only wildcard groups and uses the longest match", () => {
    const rules = parseRobots(
      [
        "User-agent: bot",
        "Disallow: /private",
        "",
        "User-agent: *",
        "Disallow: /",
        "Allow: /public",
        "Disallow:",
      ].join("\n"),
    );
    expect(rules).toHaveLength(2);
    expect(robotsAllows("/public/a.pdf", rules)).toBe(true);
    expect(robotsAllows("/private/a.pdf", rules)).toBe(false);
  });

  it("fetches robots once per origin and honours Disallow", async () => {
    const transport = vi.fn(async (input: { url: URL }) =>
      input.url.pathname === "/robots.txt"
        ? result(200, {}, "User-agent: *\nDisallow: /private")
        : result(200),
    );
    const cache = createRobotsCache(() => 1_000);
    const base = options({ transport, robotsCache: cache });
    await assertRobotsAllowed("https://regulator.example/public/a.pdf", base);
    await expect(
      assertRobotsAllowed("https://regulator.example/private/a.pdf", base),
    ).rejects.toMatchObject({ ingestionCode: "ROBOTS_DISALLOWED" });
    expect(transport).toHaveBeenCalledTimes(1);
    await expect(
      assertRobotsAllowed("https://regulator.example/private/a.pdf", base),
    ).rejects.toMatchObject({ ingestionCode: "ROBOTS_DISALLOWED" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("treats 401/403 robots as disallowed and a missing robots file as allowed", async () => {
    const denied = options({ transport: async () => result(403) });
    await expect(
      assertRobotsAllowed("https://regulator.example/a.pdf", denied),
    ).rejects.toMatchObject({
      ingestionCode: "ROBOTS_DISALLOWED",
    });
    const missing = options({ transport: async () => result(404) });
    await expect(
      assertRobotsAllowed("https://regulator.example/a.pdf", missing),
    ).resolves.toBeUndefined();
  });

  it("expires cached robots rules and bounds the cache", async () => {
    let time = 0;
    const cache = createRobotsCache(() => time);
    cache.set("https://a.example", { rules: [], fetchedAt: 0 });
    expect(cache.get("https://a.example")).not.toBeNull();
    time = 15 * 60_000 + 1;
    expect(cache.get("https://a.example")).toBeNull();
    for (let index = 0; index < 70; index += 1) {
      cache.set(`https://host${index}.example`, { rules: [], fetchedAt: time });
    }
    expect(cache.get("https://host69.example")).not.toBeNull();
  });

  it("builds a safe user agent and rejects CRLF/invalid support emails", () => {
    expect(userAgentFor("support@hexaware.com")).toContain("support@hexaware.com");
    expect(() => userAgentFor("bad\r\nheader@hexaware.com")).toThrow(IngestionError);
    expect(() => userAgentFor("not-an-email")).toThrow(IngestionError);
  });
});
