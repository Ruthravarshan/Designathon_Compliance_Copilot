import { describe, expect, it, vi } from "vitest";
import { IngestionError } from "./errors";
import { hasPdfMagic, normalizePageText, parsePdf } from "./pdf";
import { makeTestPdf } from "./__fixtures__/pdf";

const longText = (page: number): string =>
  `Circular ${page}: The bank shall complete a vulnerability assessment every six months and report the results to the board within thirty days of completion.`;

describe("PDF guard and parsing", () => {
  it("detects the real PDF magic and rejects other bytes", () => {
    expect(hasPdfMagic(makeTestPdf(["first page"]))).toBe(true);
    expect(hasPdfMagic(new TextEncoder().encode("<html>not a pdf</html>"))).toBe(false);
    expect(hasPdfMagic(new Uint8Array([0x25, 0x50]))).toBe(false);
  });

  it("normalizes whitespace without inventing text", () => {
    expect(normalizePageText("  a\r\nb\u0000\n\n\n\nc  ")).toBe("a\nb\n\nc");
  });

  it("rejects non-PDF bytes before any parser call", async () => {
    const extract = vi.fn(async () => ({ totalPages: 1, text: ["forged"] }));
    await expect(
      parsePdf(new TextEncoder().encode("not a pdf"), { extract }),
    ).rejects.toMatchObject({ ingestionCode: "INVALID_PDF" });
    expect(extract).not.toHaveBeenCalled();
  });

  it("rejects encrypted and empty PDFs with safe codes", async () => {
    const pdf = makeTestPdf(["a"]);
    await expect(
      parsePdf(pdf, { meta: async () => ({ info: { EncryptFilterName: "Standard" } }) }),
    ).rejects.toMatchObject({ ingestionCode: "ENCRYPTED_PDF" });
    await expect(
      parsePdf(pdf, {
        extract: async () => {
          throw new Error("password required: internal secret");
        },
      }),
    ).rejects.toMatchObject({ ingestionCode: "ENCRYPTED_PDF", message: expect.not.stringContaining("secret") });
    await expect(
      parsePdf(pdf, { extract: async () => ({ totalPages: 0, text: [] }) }),
    ).rejects.toMatchObject({ ingestionCode: "INVALID_PDF" });
  });

  it("keeps 1-based page numbers and caps pages and characters", async () => {
    const parsed = await parsePdf(makeTestPdf(["a"]), {
      extract: async () => ({ totalPages: 5, text: [longText(1), longText(2), longText(3), "", ""] }),
      maxPages: 3,
      maxChars: 200,
      minCharsPerPage: 40,
    });
    expect(parsed.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3]);
    expect(parsed.pageCount).toBe(5);
    expect(parsed.pages[0]?.text.length).toBeLessThanOrEqual(200);
    expect(parsed.pages.reduce((sum, page) => sum + page.text.length, 0)).toBeLessThanOrEqual(200);
    expect(parsed.needsReview).toBe(true);
    expect(parsed.reasonCode).toBe("PAGE_LIMIT");
  });

  it("flags a missing text layer for review and never synthesizes a quote", async () => {
    const parsed = await parsePdf(makeTestPdf(["a"]), {
      extract: async () => ({ totalPages: 2, text: ["", "short"] }),
    });
    expect(parsed.needsReview).toBe(true);
    expect(parsed.reasonCode).toBe("NO_TEXT_LAYER");
    expect(parsed.pages.every((page) => typeof page.text === "string")).toBe(true);
  });

  it("parses a real generated PDF into exact page text without consuming the caller's bytes", async () => {
    const pdf = makeTestPdf([longText(1), longText(2)]);
    const parsed = await parsePdf(pdf);
    expect(pdf.length).toBeGreaterThan(0);
    expect(parsed.pageCount).toBe(2);
    expect(parsed.needsReview).toBe(false);
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages[0]?.pageNumber).toBe(1);
    expect(parsed.pages[0]?.text).toContain("vulnerability assessment every six months");
    expect(parsed.pages[1]?.text).toContain("Circular 2");
  });

  it("uses the exact code when the parser reports an encrypted document", async () => {
    const error = new IngestionError("ENCRYPTED_PDF", "The PDF is encrypted and cannot be verified.");
    await expect(
      parsePdf(makeTestPdf(["a"]), {
        meta: async () => {
          throw error;
        },
      }),
    ).rejects.toMatchObject({ ingestionCode: "ENCRYPTED_PDF" });
  });
});
