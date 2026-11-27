import { extractText, getMeta } from "unpdf";
import { IngestionError } from "./errors";
import type { ParsedPdf, PdfPage } from "./types";

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const DEFAULT_MAX_PAGES = 80;
const DEFAULT_MAX_CHARS = 200_000;
const DEFAULT_MIN_CHARS_PER_PAGE = 40;

type ExtractFn = (
  data: Uint8Array,
  options?: { mergePages?: boolean },
) => Promise<{ totalPages: number; text: string[] | string }>;
type MetaFn = (data: Uint8Array) => Promise<{ info: { EncryptFilterName?: string | null } }>;

export interface PdfOptions {
  extract?: ExtractFn;
  meta?: MetaFn;
  maxPages?: number;
  maxChars?: number;
  minCharsPerPage?: number;
}

export function hasPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) {
    return false;
  }
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

export function normalizePageText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapParseError(error: unknown): IngestionError {
  const message = error instanceof Error ? error.message : "";
  if (/password|encrypt|owner password/i.test(message)) {
    return new IngestionError("ENCRYPTED_PDF", "The PDF is encrypted and cannot be verified.");
  }
  return new IngestionError("INVALID_PDF", "The PDF could not be parsed.");
}

/** Parses per-page text only after a magic-byte check. No OCR and no synthesized text. */
export async function parsePdf(bytes: Uint8Array, options: PdfOptions = {}): Promise<ParsedPdf> {
  if (!hasPdfMagic(bytes)) {
    throw new IngestionError("INVALID_PDF", "The file is not a PDF.");
  }

  const extract = options.extract ?? extractText;
  const meta = options.meta ?? getMeta;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const minChars = options.minCharsPerPage ?? DEFAULT_MIN_CHARS_PER_PAGE;

  // unpdf's PDF.js worker detaches the buffer it is given. Pass a copy to each
  // call so the caller's original bytes stay intact for upload and re-reads.
  try {
    const metadata = await meta(new Uint8Array(bytes));
    if (metadata.info.EncryptFilterName) {
      throw new IngestionError("ENCRYPTED_PDF", "The PDF is encrypted and cannot be verified.");
    }
  } catch (error) {
    if (error instanceof IngestionError) {
      throw error;
    }
    throw mapParseError(error);
  }

  let extracted: { totalPages: number; text: string[] | string };
  try {
    extracted = await extract(new Uint8Array(bytes), { mergePages: false });
  } catch (error) {
    throw mapParseError(error);
  }

  if (extracted.totalPages < 1 || !Array.isArray(extracted.text) || extracted.text.length < 1) {
    throw new IngestionError("INVALID_PDF", "The PDF has no extractable pages.");
  }

  let remaining = maxChars;
  let capped = extracted.totalPages > maxPages;
  const pages: PdfPage[] = [];
  for (let index = 0; index < Math.min(extracted.text.length, maxPages); index += 1) {
    const text = normalizePageText(extracted.text[index] ?? "");
    if (text.length > remaining) {
      capped = true;
    }
    const kept = text.slice(0, Math.max(0, remaining));
    remaining = Math.max(0, remaining - kept.length);
    pages.push({ pageNumber: index + 1, text: kept });
  }

  if (pages.length === 0) {
    throw new IngestionError("INVALID_PDF", "The PDF has no extractable pages.");
  }
  const readable = pages.filter((page) => page.text.length >= minChars).length;
  const noTextLayer = readable < Math.ceil(pages.length / 2);
  return {
    pages,
    pageCount: extracted.totalPages,
    needsReview: noTextLayer || capped,
    ...(noTextLayer ? { reasonCode: "NO_TEXT_LAYER" as const } : {}),
    ...(!noTextLayer && capped ? { reasonCode: "PAGE_LIMIT" as const } : {}),
  };
}
