import type { SourceClause } from "../compliance/types";
import { pdfPagesToClauses, textToClauses } from "./clauses";
import { htmlToText } from "./html";

export interface ExtractedDocument {
  text: string;
  pageCount: number;
  clauses: SourceClause[];
  kind: "html" | "pdf" | "text";
}

// A whole regulator PDF (100+ pages) must stay retrievable; 40 clauses only
// covered the cover pages and made big documents answer from their title.
const MAX_PDF_CLAUSES = 600;
const MAX_TEXT_CLAUSES = 120;

export function looksLikePdf(contentType: string, bytes: Uint8Array): boolean {
  return contentType.includes("pdf") || Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-";
}

export function looksLikeHtml(contentType: string, bytes: Uint8Array): boolean {
  if (contentType.includes("html") || contentType.includes("xml")) {
    return true;
  }
  const head = Buffer.from(bytes.subarray(0, 200)).toString("utf8").toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html");
}

function normalizePdfPage(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocument> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const result = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(result.text) ? result.text : [result.text];
  const normalizedPages = pages.map((page, index) => ({
    pageNumber: index + 1,
    text: normalizePdfPage(page),
  }));
  const text = normalizedPages.map((page) => page.text).join("\n\n");

  return {
    text,
    pageCount: normalizedPages.length,
    clauses: pdfPagesToClauses(normalizedPages, MAX_PDF_CLAUSES),
    kind: "pdf",
  };
}

function extractHtml(html: string): ExtractedDocument {
  const text = htmlToText(html);
  return { text, pageCount: 1, clauses: textToClauses(text, { max: MAX_TEXT_CLAUSES }), kind: "html" };
}

function extractPlainText(value: string): ExtractedDocument {
  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return { text, pageCount: 1, clauses: textToClauses(text, { max: MAX_TEXT_CLAUSES }), kind: "text" };
}

/** Decode raw bytes into text and citable clauses. */
export async function extractDocument(input: {
  contentType: string;
  bytes: Uint8Array;
}): Promise<ExtractedDocument> {
  if (looksLikePdf(input.contentType, input.bytes)) {
    return extractPdf(input.bytes);
  }
  const utf8 = Buffer.from(input.bytes).toString("utf8");
  if (looksLikeHtml(input.contentType, input.bytes)) {
    return extractHtml(utf8);
  }
  return extractPlainText(utf8);
}

/** Raw HTML for listing pages where we need anchors, not text. */
export function decodeHtml(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("utf8");
}
