import { IngestionError } from "./errors";
import type { IngestionJobPayload, IngestionStatus, RunStep } from "./types";
import type { StorageConnection } from "@/server/storage/types";

/** Normalized reads of Qoder's v2 models. No provider text or secrets live here. */
export interface SourceRecord {
  id: string;
  workspaceId: string;
  issuer: string | null;
  allowedDomains: readonly string[];
  enabled: boolean;
  allowHttp: boolean;
  listingUrl: string | null;
  storageConnectionId: string | null;
}

export interface SettingsRecord {
  workspaceId: string;
  supportEmail: string | null;
  maxUploadBytes: number | null;
  llmEnabled: boolean;
  llmModel: string | null;
}

export interface RunCounts {
  documents: number;
  findings: number;
  failed: number;
  skipped: number;
}

export interface RunRecord {
  id: string;
  workspaceId: string;
  status: IngestionStatus;
  mode: "url" | "listing";
  sourceId: string | null;
  requestedByUserId: string;
  steps: RunStep[];
  counts: RunCounts;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobRecord {
  id: string;
  workspaceId: string;
  runId: string;
  mode: "url" | "listing";
  status: IngestionStatus;
  attempts: number;
  maxAttempts: number;
  lockedAt: Date | null;
  nextAttemptAt: Date;
  lastErrorCode: string | null;
  documentId: string | null;
  payload: IngestionJobPayload;
}

export interface CreateJobInput {
  workspaceId: string;
  runId: string;
  userId: string;
  mode: "url" | "listing";
  sourceId?: string;
  maxAttempts?: number;
  payload: IngestionJobPayload;
}

export interface JobPatch {
  status?: IngestionStatus;
  attempts?: number;
  lockedAt?: Date | null;
  nextAttemptAt?: Date;
  lastErrorCode?: string | null;
  documentId?: string | null;
}

export interface LlmCallInput {
  workspaceId: string;
  jobId: string;
  model: string;
  promptVersion: string;
  status: "VERIFIED" | "FALLBACK" | "FAILED";
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  code?: string;
}

export interface IngestionRepository {
  getSource(workspaceId: string, sourceId: string): Promise<SourceRecord | null>;
  getSettings(workspaceId: string): Promise<SettingsRecord | null>;
  getConnection(workspaceId: string, connectionId?: string): Promise<StorageConnection | null>;
  findFileByChecksum(workspaceId: string, checksum: string): Promise<{ documentId: string } | null>;
  getRun(runId: string): Promise<RunRecord | null>;
  createRun(input: {
    workspaceId: string;
    userId: string;
    mode: "url" | "listing";
    sourceId?: string;
  }): Promise<RunRecord>;
  updateRun(runId: string, patch: { status?: IngestionStatus; steps?: RunStep[]; counts?: RunCounts }): Promise<void>;
  createJob(input: CreateJobInput): Promise<JobRecord>;
  claimJob(input: { limit: number; now: Date }): Promise<JobRecord[]>;
  updateJob(jobId: string, patch: JobPatch): Promise<void>;
  recordLlmCall(input: LlmCallInput): Promise<void>;
  markDuplicate(workspaceId: string, checksum: string, documentId: string, file: {
    itemId: string;
    webUrl: string;
    path: string;
    filename: string;
    bytes: number;
    pages: number;
    storageConnectionId: string;
  }): Promise<void>;
}

export interface PersistInput {
  workspaceId: string;
  userId: string;
  runId: string;
  sourceId?: string;
  sourceUrl: string;
  issuer: string | null;
  reference: string | null;
  title: string | null;
  publishedAt?: string | null;
  effectiveAt?: string | null;
  pages: { pageNumber: number; text: string }[];
  extraction: import("./types").VerifiedExtraction;
  file: {
    itemId: string;
    webUrl: string;
    path: string;
    checksum: string;
    filename: string;
    bytes: number;
    pages: number;
  };
  storageConnectionId: string;
  ai: { status: "VERIFIED" | "FALLBACK" | "NEEDS_REVIEW"; model?: string; promptVersion?: string };
}

export type CircularPersistence = (input: PersistInput) => Promise<{
  documentId: string;
  needsReview: boolean;
  findingCount: number;
}>;

export interface IngestionRuntime {
  repository: IngestionRepository;
  persist: CircularPersistence;
}

/**
 * Qoder lands the v2 Prisma models and `persistIngestedCircular`, then registers
 * adapters here (once, at server bootstrap). Until then both defaults fail
 * closed: no run, job, document, citation or success is fabricated.
 */
function notWired(what: string): never {
  throw new IngestionError(
    "INTEGRATION_NOT_CONFIGURED",
    `${what} is not wired to the workspace database yet.`,
  );
}

const unconfiguredRepository: IngestionRepository = {
  async getSource() {
    return notWired("Ingestion persistence");
  },
  async getSettings() {
    return notWired("Ingestion persistence");
  },
  async getConnection() {
    return notWired("Ingestion persistence");
  },
  async findFileByChecksum() {
    return notWired("Ingestion persistence");
  },
  async getRun() {
    return notWired("Ingestion persistence");
  },
  async createRun() {
    return notWired("Ingestion persistence");
  },
  async updateRun() {
    return notWired("Ingestion persistence");
  },
  async createJob() {
    return notWired("Ingestion persistence");
  },
  async claimJob() {
    return notWired("Ingestion persistence");
  },
  async updateJob() {
    return notWired("Ingestion persistence");
  },
  async recordLlmCall() {
    return notWired("Ingestion persistence");
  },
  async markDuplicate() {
    return notWired("Ingestion persistence");
  },
};

const unconfiguredPersist: CircularPersistence = async () => notWired("Document persistence");

let registered: Partial<IngestionRuntime> = {};

export function setIngestionRuntime(value: Partial<IngestionRuntime>): void {
  registered = { ...registered, ...value };
}

export function resetIngestionRuntime(): void {
  registered = {};
}

export function getRuntime(): IngestionRuntime {
  return {
    repository: registered.repository ?? unconfiguredRepository,
    persist: registered.persist ?? unconfiguredPersist,
  };
}
