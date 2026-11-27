export type StorageKind = "SHAREPOINT" | "SUPABASE_STORAGE" | "GOOGLE_DRIVE";

export interface StorageConnectionConfig {
  siteId?: string;
  driveId?: string;
  folder?: string;
  bucket?: string;
  pathPrefix?: string;
}

/** Non-secret connection settings only. Secrets stay in env, never in this row. */
export interface StorageConnection {
  id: string;
  workspaceId: string;
  provider: StorageKind;
  config: StorageConnectionConfig;
  isDefault: boolean;
}

export interface StorageUploadInput {
  workspaceId: string;
  path: string;
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}

export interface StoredObject {
  itemId: string;
  webUrl: string;
  path: string;
  checksum: string;
}

export interface StorageReadInput {
  itemId: string;
  range?: { start: number; end: number };
}

export interface StorageReadResult {
  body: ReadableStream;
  contentType: string;
  contentLength?: number;
  status: 200 | 206;
  contentRange?: string;
}

export interface StorageProvider {
  kind: StorageKind;
  healthCheck(): Promise<{ ok: true } | { ok: false; code: string }>;
  upload(input: StorageUploadInput): Promise<StoredObject>;
  read(input: StorageReadInput): Promise<StorageReadResult>;
}
