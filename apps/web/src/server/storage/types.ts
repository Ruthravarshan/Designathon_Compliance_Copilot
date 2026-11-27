export type StorageKind = "SHAREPOINT" | "SUPABASE_STORAGE" | "GOOGLE_DRIVE";
export type StorageConnectionStatus = "UNVERIFIED" | "CONNECTED" | "ERROR";

export interface StorageConnectionConfig {
  siteId?: string;
  driveId?: string;
  /** OneDrive/SharePoint owner UPN; the drive is resolved at runtime. */
  driveOwner?: string;
  folder?: string;
  /** Item id of the target folder, e.g. resolved from a shared folder link. */
  folderItemId?: string;
  /** Shared folder link the owner pasted; resolved through Graph /shares. */
  folderUrl?: string;
  /** Google Drive folder id; derived from the folder link when omitted. */
  folderId?: string;
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
  isFallback?: boolean;
  status?: StorageConnectionStatus;
  lastErrorCode?: string | null;
  lastCheckedAt?: string | null;
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

export interface StorageEntry {
  id: string;
  name: string;
  kind: "file" | "folder";
  size?: number;
  contentType?: string;
  modifiedAt?: string;
  webUrl?: string;
  path?: string;
}

export interface StorageListInput {
  folderId?: string;
  folderPath?: string;
  pageToken?: string;
  limit?: number;
}

export interface StorageListResult {
  entries: StorageEntry[];
  nextPageToken?: string;
}

export interface StorageStat {
  id: string;
  name: string;
  size?: number;
  modifiedAt?: string;
  webUrl?: string;
}

export interface StorageProvider {
  kind: StorageKind;
  healthCheck(): Promise<{ ok: true } | { ok: false; code: string }>;
  upload(input: StorageUploadInput): Promise<StoredObject>;
  read(input: StorageReadInput): Promise<StorageReadResult>;
  /** Browse a folder; providers that cannot list omit this. */
  list?(input: StorageListInput): Promise<StorageListResult>;
  /** Current metadata for one item; used by the storage change sync. */
  stat?(itemId: string): Promise<StorageStat | null>;
}
