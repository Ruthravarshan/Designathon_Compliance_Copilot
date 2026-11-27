import { describe, expect, it } from "vitest";
import { getStorageProvider } from "./index";
import type { StorageConnection } from "./types";

const connection = (provider: StorageConnection["provider"]): StorageConnection => ({
  id: "conn-1",
  workspaceId: "ws-1",
  provider,
  config: { bucket: "circulars", siteId: "site", driveId: "drive" },
  isDefault: true,
});

describe("provider selection", () => {
  it("selects exactly the configured provider", () => {
    expect(getStorageProvider(connection("SHAREPOINT")).kind).toBe("SHAREPOINT");
    expect(getStorageProvider(connection("SUPABASE_STORAGE")).kind).toBe("SUPABASE_STORAGE");
  });

  it("does not silently fall back for unconfigured providers", () => {
    expect(() => getStorageProvider(connection("GOOGLE_DRIVE"))).toThrow(
      "Google Drive storage is not configured.",
    );
  });
});
