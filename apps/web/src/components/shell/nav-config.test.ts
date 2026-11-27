import { describe, expect, it } from "vitest";
import { buildNavGroups } from "./nav-config";

function flattenIds(permissions: readonly string[]): string[] {
  return buildNavGroups(new Set(permissions)).flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

describe("buildNavGroups", () => {
  it("shows only overview when no extra permissions are granted", () => {
    expect(flattenIds([])).toEqual(["overview"]);
  });

  it("hides compliance, audit, and admin from default EMPLOYEE capabilities", () => {
    const ids = flattenIds(["circular:read", "policy:read", "assignment:read", "assignment:ack"]);
    expect(ids).toEqual(["overview", "circulars", "policies", "assignments"]);
    expect(ids).not.toContain("compliance");
    expect(ids).not.toContain("audit");
    expect(ids).not.toContain("admin-team");
  });

  it("reveals compliance when compliance:view_own override is granted", () => {
    const ids = flattenIds(["circular:read", "assignment:read", "compliance:view_own"]);
    expect(ids).toContain("compliance");
  });

  it("shows compliance and audit for AUDITOR without admin links", () => {
    const ids = flattenIds(["circular:read", "policy:read", "compliance:view_all", "audit:read"]);
    expect(ids).toEqual(["overview", "circulars", "policies", "compliance", "audit"]);
  });

  it("shows full admin navigation when management capabilities are present", () => {
    const ids = flattenIds([
      "circular:read",
      "policy:read",
      "assignment:read",
      "compliance:view_all",
      "member:manage",
      "role:manage",
      "source:manage",
      "storage:manage",
      "settings:manage",
      "audit:read",
    ]);
    expect(ids).toEqual([
      "overview",
      "circulars",
      "policies",
      "assignments",
      "compliance",
      "admin-team",
      "admin-departments",
      "admin-roles",
      "admin-ingestion",
      "admin-connections",
      "admin-settings",
      "audit",
    ]);
  });

  it("shows Connections when only settings:manage is present", () => {
    const ids = flattenIds(["settings:manage"]);
    expect(ids).toContain("admin-connections");
    expect(ids).toContain("admin-settings");
  });
});
