import { describe, expect, it } from "vitest";
import {
  hostAllowed,
  isDisallowedHostname,
  isPrivateIp,
  normalizeUrl,
  parseHttpUrl,
  resolveUrl,
} from "./urls";

describe("isPrivateIp", () => {
  it("flags private, loopback, link-local, and metadata ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
      "[::1]",
      "[fd00::1]",
      "::127.0.0.1",
      "64:ff9b::a00:1",
      "2002:0a00:0001::",
      "ff02::1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("52.95.1.1")).toBe(false);
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("isDisallowedHostname", () => {
  it("blocks localhost, internal suffixes, and private literals", () => {
    expect(isDisallowedHostname("localhost")).toBe(true);
    expect(isDisallowedHostname("api.local")).toBe(true);
    expect(isDisallowedHostname("metadata.google.internal")).toBe(true);
    expect(isDisallowedHostname("127.0.0.1")).toBe(true);
  });

  it("allows normal public hostnames", () => {
    expect(isDisallowedHostname("www.rbi.org.in")).toBe(false);
  });
});

describe("parseHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(parseHttpUrl("https://www.rbi.org.in/a.pdf")?.hostname).toBe("www.rbi.org.in");
  });

  it("rejects other schemes, credentials, internal hosts, and non-default ports", () => {
    expect(parseHttpUrl("ftp://example.com")).toBeNull();
    expect(parseHttpUrl("https://user:pass@example.com")).toBeNull();
    expect(parseHttpUrl("http://localhost/x")).toBeNull();
    expect(parseHttpUrl("not a url")).toBeNull();
    expect(parseHttpUrl("http://[::127.0.0.1]/x")).toBeNull();
    expect(parseHttpUrl("https://example.com:6379/x")).toBeNull();
    expect(parseHttpUrl("https://example.com/x")?.hostname).toBe("example.com");
  });
});

describe("hostAllowed", () => {
  it("matches exact and subdomains only", () => {
    const url = new URL("https://rbidocs.rbi.org.in/x.pdf");
    expect(hostAllowed(url, ["rbi.org.in"])).toBe(true);
    expect(hostAllowed(url, ["rbi.org.in", "sebi.gov.in"])).toBe(true);
    expect(hostAllowed(url, ["sebi.gov.in"])).toBe(false);
    expect(hostAllowed(url, [])).toBe(false);
  });
});

describe("normalizeUrl", () => {
  it("drops fragments and default ports and lowercases the host", () => {
    expect(normalizeUrl("https://RBI.org.in:443/a?b=1#frag")).toBe("https://rbi.org.in/a?b=1");
    expect(normalizeUrl("http://example.com:80/x")).toBe("http://example.com/x");
  });

  it("returns an empty string for unsafe URLs", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBe("");
  });
});

describe("resolveUrl", () => {
  it("resolves relative links and rejects unsafe ones", () => {
    expect(resolveUrl("https://www.rbi.org.in/list", "/scripts/a.aspx?id=1")).toBe(
      "https://www.rbi.org.in/scripts/a.aspx?id=1",
    );
    expect(resolveUrl("https://www.rbi.org.in/list", "javascript:void(0)")).toBeNull();
    expect(resolveUrl("https://www.rbi.org.in/list", "#top")).toBeNull();
  });
});
