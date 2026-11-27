"use client";

import { useState } from "react";
import {
  ArrowRight,
  CaretDown,
  CaretUp,
  CircleNotch,
  UserCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { ThemeMode } from "@/components/theme/theme";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RoleBadge } from "@/components/ui/status-badge";

export interface PublicDemoPersona {
  id: string;
  name: string;
  role: string;
  title?: string | null;
  workspaceName: string;
}

export interface PublicBrandingView {
  appName: string;
  logoUrl?: string | null;
  theme: ThemeMode;
  supportEmail?: string | null;
  providers: {
    google: boolean;
    microsoft: boolean;
  };
  demo: {
    enabled: boolean;
    personas: readonly PublicDemoPersona[];
  };
  guest: {
    enabled: boolean;
    href?: string | null;
  };
}

export function SignInView({
  branding,
  initialError,
  onOAuthSignIn,
  onDemoSignIn,
}: {
  branding: PublicBrandingView;
  initialError?: string | null;
  onOAuthSignIn?: (provider: "google" | "microsoft") => void | Promise<void>;
  onDemoSignIn?: (personaId: string) => void | Promise<void>;
}) {
  const [pendingProvider, setPendingProvider] = useState<"google" | "microsoft" | null>(null);
  const [pendingPersonaId, setPendingPersonaId] = useState<string | null>(null);
  const [demoExpanded, setDemoExpanded] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const hasSso = branding.providers.google || branding.providers.microsoft;
  const hasDemo = branding.demo.enabled;
  const hasGuest = branding.guest.enabled;
  const hasAnyMethod = hasSso || hasDemo || hasGuest;
  const anyPending = pendingProvider !== null || pendingPersonaId !== null;

  const sortedPersonas = [...branding.demo.personas].sort((a, b) => a.name.localeCompare(b.name));

  const handleOAuth = async (provider: "google" | "microsoft") => {
    if (!onOAuthSignIn || anyPending) {
      return;
    }
    setError(null);
    setPendingProvider(provider);
    try {
      await onOAuthSignIn(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in could not start. Try again.");
    } finally {
      setPendingProvider(null);
    }
  };

  const handleDemo = async (personaId: string) => {
    if (!onDemoSignIn || anyPending) {
      return;
    }
    setError(null);
    setPendingPersonaId(personaId);
    try {
      await onDemoSignIn(personaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sign-in failed. Try again.");
    } finally {
      setPendingPersonaId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas text-fg lg:grid lg:grid-cols-[46%_54%]">
      {/* Brand field (left pane >= 900px, header band on mobile) */}
      <section className="flex flex-col justify-between border-b border-line bg-surface px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <BrandLockup appName={branding.appName} logoUrl={branding.logoUrl} />
          <ThemeToggle initialMode={branding.theme} />
        </div>

        <div className="my-10 max-w-[38ch] lg:my-0">
          <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.025em] text-fg sm:text-[32px] sm:leading-[38px]">
            Regulatory change, reviewed and on record.
          </h1>
          {branding.supportEmail ? (
            <p className="mt-4 text-sm text-muted">
              Workspace support:{" "}
              <a
                href={`mailto:${branding.supportEmail}`}
                className="font-medium text-fg underline underline-offset-4 hover:text-brand"
              >
                {branding.supportEmail}
              </a>
            </p>
          ) : null}
        </div>

        <p className="hidden text-xs text-muted lg:block">
          Access is controlled by your workspace owner.
        </p>
      </section>

      {/* Sign-in form pane */}
      <main id="main" className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[440px] space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[18px] leading-[24px] font-semibold text-fg">Sign in</h2>
            {hasDemo ? (
              <Badge tone="brand" dot>
                Demo
              </Badge>
            ) : null}
          </div>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-danger/35 bg-danger/10 p-4 text-sm text-fg"
            >
              <WarningCircle
                size={18}
                weight="fill"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-danger"
              />
              <div className="space-y-1">
                <p className="font-semibold">Error</p>
                <p className="text-xs leading-relaxed text-fg">{error}</p>
              </div>
            </div>
          ) : null}

          {!hasAnyMethod ? (
            <Card className="p-6">
              <p className="text-sm font-semibold text-fg">No sign-in method is enabled</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Ask your workspace owner to enable Google SSO, Microsoft SSO, demo access, or guest
                access.
                {branding.supportEmail ? ` Contact ${branding.supportEmail}.` : ""}
              </p>
            </Card>
          ) : (
            <div className="space-y-5">
              {hasSso ? (
                <div className="space-y-3">
                  {branding.providers.google ? (
                    <Button
                      variant="primary"
                      size="lg"
                      pending={pendingProvider === "google"}
                      pendingLabel="Continuing with Google..."
                      disabled={anyPending}
                      onClick={() => void handleOAuth("google")}
                      className="w-full justify-between px-5"
                    >
                      <span>Continue with Google</span>
                      <ArrowRight size={16} weight="bold" aria-hidden="true" />
                    </Button>
                  ) : null}

                  {branding.providers.microsoft ? (
                    <Button
                      variant="secondary"
                      size="lg"
                      pending={pendingProvider === "microsoft"}
                      pendingLabel="Continuing with Microsoft..."
                      disabled={anyPending}
                      onClick={() => void handleOAuth("microsoft")}
                      className="w-full justify-between px-5"
                    >
                      <span>Continue with Microsoft</span>
                      <ArrowRight size={16} weight="bold" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {hasSso && (hasDemo || hasGuest) ? (
                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    or
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              ) : null}

              {hasDemo ? (
                <Card className="overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={demoExpanded}
                    disabled={anyPending}
                    onClick={() => setDemoExpanded((prev) => !prev)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserCheck
                        size={17}
                        weight="bold"
                        aria-hidden="true"
                        className="text-brand"
                      />
                      <div>
                        <span className="block text-sm font-semibold text-fg">Demo access</span>
                        <span className="block text-xs text-muted">
                          {sortedPersonas.length} seeded personas
                        </span>
                      </div>
                    </div>
                    {demoExpanded ? (
                      <CaretUp size={15} weight="bold" aria-hidden="true" className="text-muted" />
                    ) : (
                      <CaretDown
                        size={15}
                        weight="bold"
                        aria-hidden="true"
                        className="text-muted"
                      />
                    )}
                  </button>

                  {demoExpanded ? (
                    <ul className="divide-y divide-line border-t border-line">
                      {sortedPersonas.map((persona) => {
                        const rowPending = pendingPersonaId === persona.id;
                        return (
                          <li key={persona.id}>
                            <button
                              type="button"
                              disabled={anyPending}
                              onClick={() => void handleDemo(persona.id)}
                              className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-fg">
                                  {persona.name}
                                </p>
                                <p className="truncate text-xs text-muted">
                                  {persona.title ? `${persona.title} · ` : ""}
                                  {persona.workspaceName}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <RoleBadge role={persona.role} />
                                {rowPending ? (
                                  <CircleNotch
                                    size={15}
                                    weight="bold"
                                    aria-hidden="true"
                                    className="animate-spin text-brand motion-reduce:animate-none"
                                  />
                                ) : (
                                  <ArrowRight
                                    size={14}
                                    weight="bold"
                                    aria-hidden="true"
                                    className="text-muted"
                                  />
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </Card>
              ) : null}

              {hasGuest ? (
                branding.guest.href ? (
                  <LinkButton
                    href={branding.guest.href}
                    variant="secondary"
                    size="lg"
                    className="w-full justify-between px-5"
                  >
                    <span>Continue as guest</span>
                    <ArrowRight size={16} weight="bold" aria-hidden="true" />
                  </LinkButton>
                ) : (
                  <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
                    Guest access is enabled, but no workspace guest link is configured yet.
                  </p>
                )
              ) : null}
            </div>
          )}

          <p className="text-xs text-muted lg:hidden">
            Access is controlled by your workspace owner.
            {branding.supportEmail ? ` Support: ${branding.supportEmail}` : ""}
          </p>
        </div>
      </main>
    </div>
  );
}
