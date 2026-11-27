import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle, LockKey, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { HeroTelemetry } from "@/components/landing/hero-telemetry";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActor } from "@/server/auth/actor";
import { permissionsFor } from "@/server/auth/rbac";

export const metadata: Metadata = { title: "System architecture" };
export const dynamic = "force-dynamic";

const GUARDRAILS = [
  {
    title: "Exact substring citations",
    body: "Every extracted obligation must verify as an exact substring (minimum 12 characters) inside the stored source clause. Unverified quotes are flagged before review.",
  },
  {
    title: "Deterministic confidence rubric",
    body: "Confidence is calculated transparently: 40% citation verification, 35% internal policy/control mapping score, and 25% rule certainty.",
  },
  {
    title: "Human sign-off gate",
    body: "Officers explicitly approve, approve with edits, or reject each drafted redline. The system never auto-publishes changes to the corporate policy register.",
  },
  {
    title: "Server-enforced multi-tenancy",
    body: "Every query and mutation scopes to the HMAC-verified session workspaceId. Client-supplied tenant IDs or roles are ignored.",
  },
] as const;

export default async function ArchitecturePage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }

  const activePermissions = permissionsFor(actor.role);

  return (
    <div className="space-y-6">
      <PageHeader
        meta={
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Governance / System Architecture
          </span>
        }
        title="Verification architecture"
        subtitle="Internal pipeline specification, session & tenant boundary, and active RBAC permissions for your signed-in workspace."
        action={<Badge tone="brand">{actor.role} view</Badge>}
      />

      {/* Interactive Pipeline & Redline Verification Diagram */}
      <HeroTelemetry />

      {/* Session & Tenant Boundary + Active Capabilities */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LockKey
                size={17}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-support"
              />
              <h2 className="text-sm font-semibold text-fg">Session &amp; tenant boundary</h2>
            </div>
            <Badge tone="outline">Verified</Badge>
          </div>

          <svg
            viewBox="0 0 420 84"
            className="mt-4 h-auto w-full"
            role="img"
            aria-label="Session verification flow from identity provider to server-scoped tenant workspace"
          >
            <path d="M 96 42 H 170" className="stroke-line" strokeWidth="1.5" fill="none" />
            <path
              d="M 96 42 H 170"
              className="pp-signal-line stroke-brand dark:stroke-support"
              strokeWidth="1.5"
              fill="none"
            />
            <path d="M 250 42 H 324" className="stroke-line" strokeWidth="1.5" fill="none" />
            <path
              d="M 250 42 H 324"
              className="pp-signal-line stroke-brand dark:stroke-support"
              strokeWidth="1.5"
              fill="none"
            />

            <rect
              x="8"
              y="18"
              width="88"
              height="48"
              rx="12"
              className="fill-surface-2 stroke-line"
              strokeWidth="1.5"
            />
            <text x="52" y="39" textAnchor="middle" className="fill-fg text-[11px] font-semibold">
              Identity
            </text>
            <text x="52" y="54" textAnchor="middle" className="fill-muted font-mono text-[9px]">
              HMAC cookie
            </text>

            <rect
              x="170"
              y="18"
              width="80"
              height="48"
              rx="12"
              className="fill-brand stroke-brand"
              strokeWidth="1.5"
            />
            <text
              x="210"
              y="39"
              textAnchor="middle"
              className="fill-brand-ink text-[11px] font-semibold"
            >
              RBAC
            </text>
            <text
              x="210"
              y="54"
              textAnchor="middle"
              className="fill-brand-ink/80 font-mono text-[9px]"
            >
              {actor.role}
            </text>

            <rect
              x="324"
              y="18"
              width="88"
              height="48"
              rx="12"
              className="fill-surface-2 stroke-line"
              strokeWidth="1.5"
            />
            <text x="368" y="39" textAnchor="middle" className="fill-fg text-[11px] font-semibold">
              Tenant
            </text>
            <text x="368" y="54" textAnchor="middle" className="fill-muted font-mono text-[9px]">
              {actor.workspaceSlug}
            </text>
          </svg>

          <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Active workspace
              </dt>
              <dd className="mt-1 font-medium text-fg">{actor.workspaceName}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Signed-in actor
              </dt>
              <dd className="mt-1 font-medium text-fg">
                {actor.name} · {actor.role}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck
                size={17}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-support"
              />
              <h2 className="text-sm font-semibold text-fg">Resolved capability set</h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {activePermissions.length} permissions
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {activePermissions.map((permission) => (
              <span
                key={permission}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[10px] text-fg"
              >
                <CheckCircle
                  size={10}
                  weight="bold"
                  aria-hidden="true"
                  className="text-brand dark:text-support"
                />
                {permission}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Engine Guardrails */}
      <div className="grid gap-4 sm:grid-cols-2">
        {GUARDRAILS.map((item) => (
          <Card key={item.title} className="p-5">
            <h3 className="text-sm font-semibold text-fg">{item.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">{item.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
