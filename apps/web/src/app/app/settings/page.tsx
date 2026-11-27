import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, EnvelopeSimple, HardDrives } from "@phosphor-icons/react/dist/ssr";
import { PersonalSettingsClient } from "@/components/settings/personal-settings-client";
import { parseThemeCookie, THEME_COOKIE_NAME } from "@/components/theme/theme";
import { Card } from "@/components/ui/card";
import { env } from "@/lib/env";
import { actorCan, getActor } from "@/server/auth/actor";

export const metadata: Metadata = { title: "Personal settings" };
export const dynamic = "force-dynamic";

export default async function PersonalSettingsPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/signin");
  }

  const cookieStore = await cookies();
  const initialTheme = parseThemeCookie(cookieStore.get(THEME_COOKIE_NAME)?.value, "light");
  const canManageEmail = actorCan(actor, "email:send");
  const canManageStorage = actorCan(actor, "storage:manage");

  return (
    <div className="space-y-6">
      <PersonalSettingsClient
        actor={{
          name: actor.name,
          email: actor.email,
          role: actor.role,
          isDemo: env.DEMO_MODE_ENABLED,
        }}
        initialTheme={initialTheme}
      />

      {canManageEmail || canManageStorage ? (
        <div className="mx-auto grid max-w-[640px] gap-4">
          {canManageEmail ? (
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand dark:text-accent">
                  <EnvelopeSimple size={18} weight="bold" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">Workspace sending mailbox</p>
                  <p className="text-xs text-muted">
                    Configure Gmail OAuth and test remediation email delivery.
                  </p>
                </div>
              </div>
              <Link
                href="/app/settings/email"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-xs font-medium text-fg transition-colors hover:border-muted/60 hover:bg-surface-2"
              >
                Open email settings
                <ArrowRight size={13} weight="bold" aria-hidden="true" />
              </Link>
            </Card>
          ) : null}

          {canManageStorage ? (
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand dark:text-accent">
                  <HardDrives size={18} weight="bold" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">Circular storage location</p>
                  <p className="text-xs text-muted">
                    Set the SharePoint primary and the Google Drive or Supabase fallback.
                  </p>
                </div>
              </div>
              <Link
                href="/app/settings/storage"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-xs font-medium text-fg transition-colors hover:border-muted/60 hover:bg-surface-2"
              >
                Open storage settings
                <ArrowRight size={13} weight="bold" aria-hidden="true" />
              </Link>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
