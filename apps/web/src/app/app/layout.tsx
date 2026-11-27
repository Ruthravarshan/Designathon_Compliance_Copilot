import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkbenchShell, type WorkbenchNavItem } from "@/components/shell/workbench-shell";
import { parseThemeCookie, THEME_COOKIE_NAME } from "@/components/theme/theme";
import { actorCan, getActor } from "@/server/auth/actor";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }

  const cookieStore = await cookies();
  const initialTheme = parseThemeCookie(cookieStore.get(THEME_COOKIE_NAME)?.value, "light");

  const navItems: WorkbenchNavItem[] = [
    { href: "/app", label: "Overview", group: "Workbench", icon: "overview", exact: true },
    ...(actorCan(actor, "document:read")
      ? [
          {
            href: "/app/circulars",
            label: "Circulars",
            group: "Workbench" as const,
            icon: "circulars" as const,
          },
        ]
      : []),
    ...(actorCan(actor, "finding:read")
      ? [
          {
            href: "/app/findings",
            label: "Findings",
            group: "Workbench" as const,
            icon: "findings" as const,
          },
        ]
      : []),
    ...(actorCan(actor, "policy:read")
      ? [
          {
            href: "/app/policies",
            label: "Policies",
            group: "Workbench" as const,
            icon: "policies" as const,
          },
        ]
      : []),
    ...(actorCan(actor, "watch:read")
      ? [
          {
            href: "/app/watch",
            label: "Watchdog",
            group: "Workbench" as const,
            icon: "watch" as const,
          },
        ]
      : []),
    ...(actorCan(actor, "assistant:ask")
      ? [
          {
            href: "/app/assistant",
            label: "Policy Q&A",
            group: "Workbench" as const,
            icon: "assistant" as const,
          },
        ]
      : []),
    ...(actorCan(actor, "document:read")
      ? [
          {
            href: "/app/data",
            label: "Data discovery",
            group: "Workbench" as const,
            icon: "data" as const,
          },
        ]
      : []),
    {
      href: "/app/architecture",
      label: "Architecture",
      group: "Governance",
      icon: "architecture",
    },
    ...(actorCan(actor, "audit:read")
      ? [
          {
            href: "/app/audit",
            label: "Audit trail",
            group: "Governance" as const,
            icon: "audit" as const,
          },
        ]
      : []),
    ...(actorCan(actor, "email:send")
      ? [
          {
            href: "/app/settings/email",
            label: "Email settings",
            group: "Governance" as const,
            icon: "email" as const,
          },
        ]
      : []),
  ];

  return (
    <WorkbenchShell
      actor={{
        name: actor.name,
        email: actor.email,
        role: actor.role,
        workspaceName: actor.workspaceName,
        workspaceSlug: actor.workspaceSlug,
      }}
      navItems={navItems}
      initialTheme={initialTheme}
    >
      {children}
    </WorkbenchShell>
  );
}
