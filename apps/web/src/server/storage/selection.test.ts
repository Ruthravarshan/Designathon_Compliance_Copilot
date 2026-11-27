import { describe, expect, it } from "vitest";
import { orderedStorageConnections, selectStorageConnections } from "./selection";
import type { StorageConnection } from "./types";

const connection = (
  id: string,
  provider: StorageConnection["provider"],
  flags: { isDefault?: boolean; isFallback?: boolean } = {},
): StorageConnection => ({
  id,
  workspaceId: "ws-1",
  provider,
  config: {},
  isDefault: flags.isDefault ?? false,
  isFallback: flags.isFallback ?? false,
});

describe("storage connection roles", () => {
  it("uses the explicit default as primary and the explicit fallback as backup", () => {
    const roles = selectStorageConnections([
      connection("drive", "GOOGLE_DRIVE", { isFallback: true }),
      connection("sp", "SHAREPOINT", { isDefault: true }),
    ]);
    expect(roles.primary?.id).toBe("sp");
    expect(roles.fallback?.id).toBe("drive");
  });

  it("falls back to other connections when no roles are flagged", () => {
    const roles = selectStorageConnections([
      connection("sp", "SHAREPOINT"),
      connection("bucket", "SUPABASE_STORAGE"),
    ]);
    expect(roles.primary?.id).toBe("sp");
    expect(roles.fallback?.id).toBe("bucket");
  });

  it("returns empty roles for no connections", () => {
    expect(selectStorageConnections([])).toEqual({ primary: null, fallback: null });
  });

  it("orders primary, fallback, then the rest without duplicates", () => {
    const ordered = orderedStorageConnections([
      connection("bucket", "SUPABASE_STORAGE"),
      connection("drive", "GOOGLE_DRIVE", { isFallback: true }),
      connection("sp", "SHAREPOINT", { isDefault: true }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["sp", "drive", "bucket"]);
  });
});