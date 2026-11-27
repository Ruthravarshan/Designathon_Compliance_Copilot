export interface NavLinkSpec {
  id: string;
  href: string;
  label: string;
  exact?: boolean;
}

export interface NavGroupSpec {
  id: string;
  label: string;
  items: readonly NavLinkSpec[];
}

function hasAny(permissions: ReadonlySet<string>, candidates: readonly string[]): boolean {
  return candidates.some((permission) => permissions.has(permission));
}

/**
 * Derive sidebar and mobile drawer groups strictly from resolved RBAC capabilities.
 * Never inspect role strings here; employee/guest/custom overrides flow automatically.
 */
export function buildNavGroups(permissions: ReadonlySet<string>): NavGroupSpec[] {
  const groups: NavGroupSpec[] = [
    {
      id: "overview",
      label: "Overview",
      items: [{ id: "overview", href: "/app", label: "Overview", exact: true }],
    },
  ];

  const policyItems: NavLinkSpec[] = [];
  if (permissions.has("circular:read")) {
    policyItems.push({ id: "circulars", href: "/app/circulars", label: "Circulars" });
  }
  if (permissions.has("policy:read")) {
    policyItems.push({ id: "policies", href: "/app/policies", label: "Policy changes" });
  }
  if (policyItems.length > 0) {
    groups.push({ id: "policies", label: "Policies", items: policyItems });
  }

  if (permissions.has("assignment:read")) {
    groups.push({
      id: "my-work",
      label: "My work",
      items: [{ id: "assignments", href: "/app/assignments", label: "Assignments" }],
    });
  }

  if (hasAny(permissions, ["compliance:view_all", "compliance:view_team", "compliance:view_own"])) {
    groups.push({
      id: "compliance",
      label: "Compliance",
      items: [{ id: "compliance", href: "/app/compliance", label: "Compliance register" }],
    });
  }

  const adminItems: NavLinkSpec[] = [];
  if (permissions.has("member:manage")) {
    adminItems.push({ id: "admin-team", href: "/app/admin/team", label: "Team" });
    adminItems.push({
      id: "admin-departments",
      href: "/app/admin/departments",
      label: "Departments",
    });
  }
  if (permissions.has("role:manage")) {
    adminItems.push({ id: "admin-roles", href: "/app/admin/roles", label: "Roles" });
  }
  if (permissions.has("source:manage")) {
    adminItems.push({ id: "admin-ingestion", href: "/app/admin/ingestion", label: "Ingestion" });
  }
  if (hasAny(permissions, ["storage:manage", "settings:manage"])) {
    adminItems.push({
      id: "admin-connections",
      href: "/app/admin/connections",
      label: "Connections",
    });
  }
  if (permissions.has("settings:manage")) {
    adminItems.push({ id: "admin-settings", href: "/app/admin/settings", label: "Settings" });
  }
  if (adminItems.length > 0) {
    groups.push({ id: "admin", label: "Admin", items: adminItems });
  }

  if (permissions.has("audit:read")) {
    groups.push({
      id: "audit",
      label: "Audit",
      items: [{ id: "audit", href: "/app/audit", label: "Audit trail" }],
    });
  }

  return groups;
}
