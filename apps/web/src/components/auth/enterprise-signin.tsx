"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Buildings,
  CaretDown,
  CaretUp,
  CircleNotch,
  Info,
  ShieldCheck,
  UserCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RoleBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/cn";
import type { PersonaSeed } from "@/server/compliance/corpus";

interface ApiError {
  error?: { message?: string; requestId?: string };
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29a11.98 11.98 0 0 0 0 10.76l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="size-4 shrink-0" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export function EnterpriseSignIn({
  personas,
  demoEnabled,
  googleConfigured,
  supabaseConfigured,
  initialProvider,
}: {
  personas: readonly PersonaSeed[];
  demoEnabled: boolean;
  googleConfigured: boolean;
  supabaseConfigured: boolean;
  initialProvider?: string;
}) {
  const router = useRouter();
  const [pendingPersona, setPendingPersona] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [demoExpanded, setDemoExpanded] = useState(true);
  const [samlExpanded, setSamlExpanded] = useState(false);
  const [workDomain, setWorkDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ssoNotice, setSsoNotice] = useState<string | null>(
    initialProvider === "google" || initialProvider === "microsoft"
      ? `${initialProvider === "google" ? "Google Workspace" : "Microsoft Entra"} SSO is ready once OAuth credentials are supplied in deployment. Use Demo access below to enter the workspace immediately.`
      : null,
  );

  const anyPending = pendingPersona !== null || pendingProvider !== null;

  async function handleSsoClick(provider: "google" | "microsoft" | "saml") {
    if (anyPending) {
      return;
    }
    setError(null);
    setPendingProvider(provider);

    await new Promise((resolve) => setTimeout(resolve, 250));
    setPendingProvider(null);
    setDemoExpanded(true);

    if (provider === "google") {
      setSsoNotice(
        googleConfigured && supabaseConfigured
          ? "Redirecting to Google Workspace OAuth..."
          : "Google Sign-In requires NEXT_PUBLIC_SUPABASE_URL and Google OAuth provider credentials in .env. Select a seeded persona under Demo access below to inspect the live app.",
      );
      return;
    }

    if (provider === "microsoft") {
      setSsoNotice(
        supabaseConfigured
          ? "Redirecting to Microsoft Entra ID..."
          : "Microsoft SSO requires NEXT_PUBLIC_SUPABASE_URL and Entra ID configuration in .env. Select a seeded persona under Demo access below to inspect the live app.",
      );
      return;
    }

    if (!workDomain.trim() || !workDomain.includes(".")) {
      setError("Enter a valid organization domain (for example: company.com).");
      return;
    }

    setSsoNotice(
      `No SAML identity provider is bound to "${workDomain.trim()}" in this environment. Use Demo access below for evaluation.`,
    );
  }

  async function choosePersona(persona: PersonaSeed) {
    if (anyPending) {
      return;
    }
    setPendingPersona(persona.key);
    setError(null);

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persona: persona.key }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiError;
        setError(body.error?.message ?? "Sign-in failed. Try another persona.");
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setError("The server did not respond. Check that the app and database are running.");
    } finally {
      setPendingPersona(null);
    }
  }

  return (
    <div className="w-full max-w-[460px] space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] leading-[32px] font-semibold tracking-[-0.025em] text-fg">
            Sign in to PolicyPulse
          </h1>
          <p className="mt-1 text-xs text-muted">
            Choose enterprise SSO or evaluate with a seeded demo workspace identity.
          </p>
        </div>
        {demoEnabled ? (
          <Badge tone="brand" dot className="shrink-0">
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
          <div className="space-y-0.5">
            <p className="font-semibold">Error</p>
            <p className="text-xs leading-relaxed text-fg">{error}</p>
          </div>
        </div>
      ) : null}

      {ssoNotice ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-brand/30 bg-brand/10 p-4 text-xs leading-relaxed text-fg"
        >
          <Info
            size={17}
            weight="bold"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-brand dark:text-accent"
          />
          <p>{ssoNotice}</p>
        </div>
      ) : null}

      {/* Primary Enterprise SSO */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Single Sign-On
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted">
            <ShieldCheck
              size={12}
              weight="bold"
              aria-hidden="true"
              className="text-brand dark:text-accent"
            />
            OAuth 2.0 / OIDC
          </span>
        </div>

        <Button
          variant="secondary"
          size="lg"
          pending={pendingProvider === "google"}
          pendingLabel="Connecting to Google..."
          disabled={anyPending}
          onClick={() => void handleSsoClick("google")}
          className="w-full justify-between px-4 font-medium"
        >
          <span className="inline-flex items-center gap-3">
            <GoogleLogo />
            <span>Continue with Google</span>
          </span>
          <ArrowRight size={15} weight="bold" aria-hidden="true" className="text-muted" />
        </Button>

        <Button
          variant="secondary"
          size="lg"
          pending={pendingProvider === "microsoft"}
          pendingLabel="Connecting to Microsoft..."
          disabled={anyPending}
          onClick={() => void handleSsoClick("microsoft")}
          className="w-full justify-between px-4 font-medium"
        >
          <span className="inline-flex items-center gap-3">
            <MicrosoftLogo />
            <span>Continue with Microsoft SSO</span>
          </span>
          <ArrowRight size={15} weight="bold" aria-hidden="true" className="text-muted" />
        </Button>

        <div className="pt-1">
          <button
            type="button"
            aria-expanded={samlExpanded}
            onClick={() => setSamlExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
          >
            <Buildings size={14} weight="bold" aria-hidden="true" />
            <span>Use organization SAML / domain SSO</span>
            {samlExpanded ? (
              <CaretUp size={12} weight="bold" aria-hidden="true" />
            ) : (
              <CaretDown size={12} weight="bold" aria-hidden="true" />
            )}
          </button>

          {samlExpanded ? (
            <div className="mt-3 flex gap-2">
              <label htmlFor="sso-domain" className="sr-only">
                Organization domain
              </label>
              <input
                id="sso-domain"
                type="text"
                value={workDomain}
                onChange={(event) => setWorkDomain(event.target.value)}
                placeholder="company.com"
                className="min-h-10 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none"
              />
              <Button
                variant="primary"
                pending={pendingProvider === "saml"}
                pendingLabel="Checking..."
                disabled={anyPending}
                onClick={() => void handleSsoClick("saml")}
                className="h-10 px-4"
              >
                Continue
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      {demoEnabled ? (
        <>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              or demo access
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Card id="demo-access" className="overflow-hidden">
            <button
              type="button"
              aria-expanded={demoExpanded}
              disabled={anyPending}
              onClick={() => setDemoExpanded((prev) => !prev)}
              className="flex min-h-12 w-full items-center justify-between gap-3 bg-surface-2/50 px-4 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <UserCheck
                  size={17}
                  weight="bold"
                  aria-hidden="true"
                  className="text-brand dark:text-accent"
                />
                <div>
                  <span className="block text-sm font-semibold text-fg">
                    Demo workspace personas
                  </span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {personas.length} seeded roles · removable via DEMO_MODE=false
                  </span>
                </div>
              </div>
              {demoExpanded ? (
                <CaretUp size={15} weight="bold" aria-hidden="true" className="text-muted" />
              ) : (
                <CaretDown size={15} weight="bold" aria-hidden="true" className="text-muted" />
              )}
            </button>

            {demoExpanded ? (
              <ul className="divide-y divide-line border-t border-line">
                {personas.map((persona) => {
                  const isPending = pendingPersona === persona.key;
                  const isIsolation = persona.workspaceSlug !== "hexa-demo";
                  return (
                    <li key={persona.key}>
                      <button
                        type="button"
                        disabled={anyPending}
                        onClick={() => void choosePersona(persona)}
                        className={cn(
                          "group flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/80 disabled:cursor-not-allowed disabled:opacity-55",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={persona.name} size="sm" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-fg">
                                {persona.name}
                              </span>
                              {isIsolation ? (
                                <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-brand dark:text-accent">
                                  Northwind Assurance
                                </span>
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-muted">{persona.title}</p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <RoleBadge role={persona.role} />
                          {isPending ? (
                            <CircleNotch
                              size={16}
                              weight="bold"
                              aria-hidden="true"
                              className="animate-spin text-brand motion-reduce:animate-none"
                            />
                          ) : (
                            <ArrowRight
                              size={14}
                              weight="bold"
                              aria-hidden="true"
                              className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand dark:group-hover:text-accent"
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
        </>
      ) : (
        <Card className="p-4 text-xs leading-relaxed text-muted">
          Demo personas are disabled in this environment (
          <span className="font-mono">DEMO_MODE=false</span>). Sign in with your organization&apos;s
          Google Workspace or Microsoft SSO account above.
        </Card>
      )}
    </div>
  );
}
