import { describe, expect, it } from "vitest";
import { deriveSummary, deriveTitle, htmlToText } from "./html";

describe("htmlToText", () => {
  it("drops script/style/nav and keeps paragraph text with entities decoded", () => {
    const html = `
      <html><head><title>t</title><style>.x{}</style></head>
      <body>
        <nav>Menu</nav>
        <div id="mainsection">
          <p>These Directions shall apply &amp; take effect.</p>
          <script>alert(1)</script>
          <p>Reports must be filed within 72 hours.</p>
        </div>
        <footer>Footer</footer>
      </body></html>`;

    const text = htmlToText(html);
    expect(text).toContain("These Directions shall apply & take effect.");
    expect(text).toContain("Reports must be filed within 72 hours.");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("Menu");
  });
});

describe("deriveTitle", () => {
  it("uses a specific h1", () => {
    const html = "<h1>Reserve Bank of India (IT Governance) Directions, 2023</h1>";
    expect(deriveTitle(html, "fallback")).toBe(
      "Reserve Bank of India (IT Governance) Directions, 2023",
    );
  });

  it("skips generic headings and uses a keyword bold line", () => {
    const html = `
      <h1>Master Directions</h1>
      <b>Cyber Security Framework for Banks, 2026</b>`;
    expect(deriveTitle(html, "fallback")).toBe("Cyber Security Framework for Banks, 2026");
  });

  it("falls back to <title> then the provided fallback", () => {
    expect(deriveTitle("<title>Data Protection Circular | RBI</title>", "fallback")).toBe(
      "Data Protection Circular",
    );
    expect(deriveTitle("<h1>Home</h1>", "fallback title")).toBe("fallback title");
  });
});

describe("deriveSummary", () => {
  it("takes a couple of sentences", () => {
    const summary = deriveSummary(
      "The Reserve Bank issued directions. They take effect from April 1, 2024. Reporting is required.",
    );
    expect(summary.startsWith("The Reserve Bank issued directions.")).toBe(true);
  });

  it("truncates very long text and handles empty input", () => {
    const long = "word ".repeat(500);
    expect(deriveSummary(long, 60).endsWith("…")).toBe(true);
    expect(deriveSummary("")).toBe("");
  });
});
