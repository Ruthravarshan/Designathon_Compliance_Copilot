import { createHash } from "node:crypto";
import type { StorageConnection, StorageProvider, StoredObject } from "@/server/storage/types";
import type {
  CircularPersistence,
  CreateJobInput,
  IngestionRepository,
  JobPatch,
  JobRecord,
  LlmCallInput,
  PersistInput,
  RunRecord,
  SettingsRecord,
  SourceRecord,
} from "../runtime";

export interface MemoryState {
  sources: Map<string, SourceRecord>;
  settings: Map<string, SettingsRecord>;
  connections: Map<string, StorageConnection>;
  runs: Map<string, RunRecord>;
  jobs: Map<string, JobRecord>;
  files: Map<string, { documentId: string }>;
  llmCalls: LlmCallInput[];
  persistCalls: PersistInput[];
}

export interface MemoryRuntime {
  state: MemoryState;
  repository: IngestionRepository;
  provider: StorageProvider;
  persist: CircularPersistence;
  objects: Map<string, Uint8Array>;
}

const WORKSPACE = "ws-1";
const CONNECTION_ID = "conn-1";

/** Test-only adapters. No product data, citations or storage success is fabricated. */
export function createMemoryRuntime(options: {
  workspaceId?: string;
  supportEmail?: string;
  llmEnabled?: boolean;
  llmModel?: string | null;
  allowedDomains?: readonly string[];
  maxUploadBytes?: number;
} = {}): MemoryRuntime {
  const workspaceId = options.workspaceId ?? WORKSPACE;
  const connection: StorageConnection = {
    id: CONNECTION_ID,
    workspaceId,
    provider: "SUPABASE_STORAGE",
    config: { bucket: "test-circulars" },
    isDefault: true,
  };
  const source: SourceRecord = {
    id: "source-1",
    workspaceId,
    issuer: "Test Regulator",
    allowedDomains: options.allowedDomains ?? ["regulator.example"],
    enabled: true,
    allowHttp: false,
    listingUrl: null,
    storageConnectionId: CONNECTION_ID,
  };
  const settings: SettingsRecord = {
    workspaceId,
    supportEmail: options.supportEmail ?? "support@hexaware.com",
    maxUploadBytes: options.maxUploadBytes ?? 20 * 1024 * 1024,
    llmEnabled: options.llmEnabled ?? false,
    llmModel: options.llmModel ?? null,
  };
  const state: MemoryState = {
    sources: new Map([[source.id, source]]),
    settings: new Map([[workspaceId, settings]]),
    connections: new Map([[connection.id, connection]]),
    runs: new Map(),
    jobs: new Map(),
    files: new Map(),
    llmCalls: [],
    persistCalls: [],
  };
  const objects = new Map<string, Uint8Array>();
  let counter = 0;
  const nextId = (prefix: string): string => {
    counter += 1;
    return `${prefix}-${counter}`;
  };

  const provider: StorageProvider = {
    kind: "SUPABASE_STORAGE",
    async healthCheck() {
      return { ok: true };
    },
    async upload(input) {
      const checksum = createHash("sha256").update(input.bytes).digest("hex");
      objects.set(input.path, new Uint8Array(input.bytes));
      const stored: StoredObject = {
        itemId: input.path,
        webUrl: `https://storage.test/${input.path}`,
        path: input.path,
        checksum,
      };
      return stored;
    },
    async read(input) {
      const bytes = objects.get(input.itemId);
      if (!bytes) {
        throw new Error("object missing");
      }
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
      return { body, contentType: "application/pdf", status: 200 as const };
    },
  };

  const repository: IngestionRepository = {
    async getSource(ws, id) {
      const found = state.sources.get(id);
      return found && found.workspaceId === ws ? found : null;
    },
    async getSettings(ws) {
      return state.settings.get(ws) ?? null;
    },
    async getConnection(ws, id) {
      const found = id ? state.connections.get(id) : [...state.connections.values()].find((item) => item.isDefault);
      return found && found.workspaceId === ws ? found : null;
    },
    async findFileByChecksum(ws, checksum) {
      return state.files.get(`${ws}:${checksum}`) ?? null;
    },
    async getRun(id) {
      return state.runs.get(id) ?? null;
    },
    async createRun(input) {
      const at = new Date();
      const run: RunRecord = {
        id: nextId("run"),
        workspaceId: input.workspaceId,
        status: "QUEUED",
        mode: input.mode,
        sourceId: input.sourceId ?? null,
        requestedByUserId: input.userId,
        steps: [],
        counts: { documents: 0, findings: 0, failed: 0, skipped: 0 },
        createdAt: at,
        updatedAt: at,
      };
      state.runs.set(run.id, run);
      return run;
    },
    async updateRun(id, patch) {
      const run = state.runs.get(id);
      if (!run) {
        throw new Error("run missing");
      }
      state.runs.set(id, {
        ...run,
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.steps !== undefined ? { steps: patch.steps } : {}),
        ...(patch.counts !== undefined ? { counts: patch.counts } : {}),
        updatedAt: new Date(),
      });
    },
    async createJob(input: CreateJobInput) {
      const job: JobRecord = {
        id: nextId("job"),
        workspaceId: input.workspaceId,
        runId: input.runId,
        mode: input.mode,
        status: "QUEUED",
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 3,
        lockedAt: null,
        nextAttemptAt: new Date(0),
        lastErrorCode: null,
        documentId: null,
        payload: input.payload,
      };
      state.jobs.set(job.id, job);
      return job;
    },
    async claimJob(input) {
      const claimed: JobRecord[] = [];
      for (const job of state.jobs.values()) {
        const ready =
          (job.status === "QUEUED" && job.nextAttemptAt.getTime() <= input.now.getTime()) ||
          (job.status === "RUNNING" && job.lockedAt !== null && input.now.getTime() - job.lockedAt.getTime() >= 10 * 60_000);
        if (ready && claimed.length < input.limit) {
          const next: JobRecord = { ...job, status: "RUNNING", lockedAt: input.now };
          state.jobs.set(job.id, next);
          claimed.push(next);
        }
      }
      return claimed;
    },
    async updateJob(id, patch: JobPatch) {
      const job = state.jobs.get(id);
      if (!job) {
        throw new Error("job missing");
      }
      state.jobs.set(id, { ...job, ...patch });
    },
    async recordLlmCall(input) {
      state.llmCalls.push(input);
    },
    async markDuplicate(ws, checksum, documentId) {
      state.files.set(`${ws}:${checksum}`, { documentId });
    },
  };

  const persist: CircularPersistence = async (input) => {
    state.persistCalls.push(input);
    const documentId = nextId("doc");
    await repository.markDuplicate(input.workspaceId, input.file.checksum, documentId, {
      itemId: input.file.itemId,
      webUrl: input.file.webUrl,
      path: input.file.path,
      filename: input.file.filename,
      bytes: input.file.bytes,
      pages: input.file.pages,
      storageConnectionId: input.storageConnectionId,
    });
    return { documentId, needsReview: input.extraction.needsReview, findingCount: input.extraction.obligations.length };
  };

  return { state, repository, provider, persist, objects };
}
