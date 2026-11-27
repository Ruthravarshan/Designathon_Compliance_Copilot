import { describe, expect, it } from "vitest";
import { getStorageProvider } from "./index";
import type { StorageConnection } from "./types";

const connection = (provider: StorageConnection["provider"]): StorageConnection => ({
  id: "conn-1",
  workspaceId: "ws-1",
  provider,
  config: { bucket: "circulars", siteId: "site", driveId: "drive", folderId: "folder" },
  isDefault: true,
});

describe("provider selection", () => {
  it("selects exactly the configured provider", () => {
    expect(getStorageProvider(connection("SHAREPOINT")).kind).toBe("SHAREPOINT");
    expect(getStorageProvider(connection("SUPABASE_STORAGE")).kind).toBe("SUPABASE_STORAGE");
    expect(getStorageProvider(connection("GOOGLE_DRIVE")).kind).toBe("GOOGLE_DRIVE");
  });
});