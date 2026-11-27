import { describe, expect, it } from "vitest";
import { criticNotes, verifyCitation } from "./verify";

describe("citation verification", () => {
  const source =
    "Critical and cyber security incidents shall be reported to the IRDAI within six hours of detection.";

  it("accepts an exact substring", () => {
    const check = verifyCitation(source, "within six hours of detection");
    expect(check.verified).toBe(true);
    expect(check.reason).toContain("exact substring");
  });

  it("rejects a paraphrase", () => {
    const check = verifyCitation(source, "within 6 hours of being detected");
    expect(check.verified).toBe(false);
    expect(check.reason).toContain("not an exact substring");
  });

  it("rejects quotes shorter than the verification floor", () => {
    const check = verifyCitation(source, "six hours");
    expect(check.verified).toBe(false);
    expect(check.reason).toContain("too short");
  });

  it("trims whitespace before comparing", () => {
    expect(verifyCitation(`  ${source}  `, `  ${source}  `).verified).toBe(true);
  });

  it("produces critic notes for mapped and unmapped findings", () => {
    expect(criticNotes({ verified: true, reason: "OK." }, true)).toBe(
      "OK. Internal mapping found.",
    );
    expect(criticNotes({ verified: false, reason: "Mismatch." }, false)).toContain(
      "No internal mapping",
    );
  });
});
