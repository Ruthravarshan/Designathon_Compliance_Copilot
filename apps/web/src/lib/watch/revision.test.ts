import { describe, expect, it } from "vitest";
import { summarizeRevision } from "./revision";

describe("summarizeRevision", () => {
  it("reports no changes for identical text", () => {
    const summary = summarizeRevision("the same text", "the same text");
    expect(summary.added).toBe(0);
    expect(summary.removed).toBe(0);
    expect(summary.summary).toBe("No textual changes detected.");
  });

  it("counts added and removed words", () => {
    const summary = summarizeRevision(
      "Reports must be filed within 72 hours.",
      "Reports must be filed within 24 hours and acknowledged.",
    );
    expect(summary.removed).toBeGreaterThan(0);
    expect(summary.added).toBeGreaterThan(0);
    expect(summary.summary).toMatch(/added and .* removed/);
  });

  it("caps the stored diff tokens", () => {
    const before = Array.from({ length: 500 }, (_, index) => `a${index}`).join(" ");
    const after = Array.from({ length: 500 }, (_, index) => `b${index}`).join(" ");
    const summary = summarizeRevision(before, after);
    expect(summary.diff.length).toBeLessThanOrEqual(240);
  });
});
