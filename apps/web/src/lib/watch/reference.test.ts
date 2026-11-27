import { describe, expect, it } from "vitest";
import { deriveReference, documentKeyFor } from "./reference";

describe("deriveReference", () => {
  it("is stable for the same URL and extracts an id", () => {
    const url = "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12562";
    const first = deriveReference("RBI", url);
    const second = deriveReference("RBI", url);
    expect(first).toBe(second);
    expect(first.startsWith("RBI-12562-")).toBe(true);
    expect(first.length).toBeLessThanOrEqual(60);
    expect(first).toMatch(/^[A-Za-z0-9/._-]+$/);
  });

  it("derives from the last path segment for PDFs", () => {
    const reference = deriveReference(
      "SEBI",
      "https://www.sebi.gov.in/sebi_data/attachdocs/abc.pdf",
    );
    expect(reference.startsWith("SEBI-ABC-")).toBe(true);
  });

  it("differs for different URLs and tolerates malformed input", () => {
    expect(deriveReference("RBI", "https://a.example/x?id=1")).not.toBe(
      deriveReference("RBI", "https://a.example/x?id=2"),
    );
    expect(deriveReference("RBI", "not-a-url").startsWith("RBI-")).toBe(true);
  });
});

describe("documentKeyFor", () => {
  it("slugifies for the pipeline key", () => {
    expect(documentKeyFor("RBI-12562-AB12CD")).toBe("rbi-12562-ab12cd");
  });
});
