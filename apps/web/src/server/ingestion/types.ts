import type { ObligationType } from "@/lib/compliance/types";
import type { IngestionErrorCode } from "./errors";

export type IngestionMode = "url" | "listing";

export type IngestionStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";

export type StepKey = "fetch" | "store" | "extract" | "verify" | "publish";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface RunStep {
  key: StepKey;
  status: StepStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  code?: IngestionErrorCode;
}

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export interface ParsedPdf {
  pages: PdfPage[];
  pageCount: number;
  needsReview: boolean;
  reasonCode?: "NO_TEXT_LAYER" | "PAGE_LIMIT";
}

export interface StoredFile {
  itemId: string;
  webUrl: string;
  path: string;
  checksum: string;
  filename: string;
  bytes: number;
  pages: number;
  storageConnectionId: string;
}

export interface VerifiedQuote {
  quote: string;
  pageNumber: number;
  sectionLabel?: string;
  citationVerified: boolean;
}

export interface ExtractedObligation {
  type: ObligationType | null;
  plainLanguage: string;
  actionRequired: string;
  applicableTo: string | null;
  quotes: VerifiedQuote[];
  citationVerified: boolean;
}

export interface VerifiedExtraction {
  title: string | null;
  issuer: string | null;
  reference: string | null;
  summary: string | null;
  publishedAt: string | null;
  effectiveAt: string | null;
  obligations: ExtractedObligation[];
  policyAreas: string[];
  riskSuggestion: string | null;
  citationVerified: boolean;
  needsReview: boolean;
}

export type AiStatus = "VERIFIED" | "FALLBACK" | "NEEDS_REVIEW";

export interface IngestionJobPayload {
  workspaceId: string;
  userId: string;
  runId: string;
  mode: IngestionMode;
  sourceId?: string;
  url?: string;
  storageItemId?: string;
  storageConnectionId?: string;
  checksum?: string;
  filename?: string;
  size?: number;
  bytes?: Uint8Array;
}
