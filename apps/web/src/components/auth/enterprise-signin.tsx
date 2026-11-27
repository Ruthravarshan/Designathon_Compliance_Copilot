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
  X,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RoleBadge } from "@/components/ui/status-badge";
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

const WORKSPACE_LABELS: Record<string, string> = {
  "hexa-demo": "PolicyPulse Workspace",
  "northwind-assurance": "Northwind Assurance",
};

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
  const [quickExpanded, setQuickExpanded] = useState(true);
  const [samlExpanded, setSamlExpanded] = useState(false);
  const [workDomain, setWorkDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ssoNotice, setSsoNotice] = useState<string | null>(
    initialProvider === "google" || initialProvider === "microsoft"
      ? `${initialProvider === "google" ? "Google Workspace" : "Microsoft Entra"} SSO activates when OAuth credentials are configured in deployment.${demoEnabled ? " Select a role under Quick role access below to enter immediately." : ""}`
      : null,
  );

  const anyPending = pendingPersona !== null || pendingProvider !== null;

  async function handleSsoClick(provider: "google" | "microsoft" | "saml") {
    if (anyPending) {
      return;
    }
    setError(null);
    setPendingProvider(provider);

    await new Promise((resolve) => setTimeout(resolve, 200));
    setPendingProvider(null);
    setQuickExpanded(true);

    if (provider === "google") {
      setSsoNotice(
        googleConfigured && supabaseConfigured
          ? "Redirecting to Google Workspace OAuth..."
          : "Google Workspace OAuth is not bound in this environment. Configure OAuth credentials in deployment, or choose a role under Quick role access below.",
      );
      return;
    }

    if (provider === "microsoft") {
      setSsoNotice(
        supabaseConfigured
          ? "Redirecting to Microsoft Entra ID..."
          : "Microsoft Entra ID is not bound in this environment. Configure Entra credentials in deployment, or choose a role under Quick role access below.",
      );
      return;
    }

    if (!workDomain.trim() || !workDomain.includes(".")) {
      setError("Enter a valid organization domain (for example: company.com).");
      return;
    }

    setSsoNotice(
      `No SAML identity provider is bound to "${workDomain.trim()}". Contact your workspace owner or use Quick role access below.`,
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
        setError(body.error?.message ?? "Sign-in failed. Try another role.");
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
    <div className="w-full max-w-[480px] space-y-5">
      <div>
        <h1 className="text-[26px] leading-[32px] font-semibold tracking-[-0.025em] text-fg">
          Sign in to PolicyPulse
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Authenticate with your organization SSO or choose a role-scoped account.
        </p>
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
          className="flex items-start justify-between gap-2.5 rounded-2xl border border-brand/30 bg-brand/10 p-4 text-xs leading-relaxed text-fg dark:border-support/35 dark:bg-support/10"
        >
          <div className="flex items-start gap-2.5">
            <Info
              size={17}
              weight="bold"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-brand dark:text-support"
            />
            <p>{ssoNotice}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setSsoNotice(null)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={13} weight="bold" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Enterprise SSO */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Enterprise Single Sign-On
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted">
            <ShieldCheck
              size={12}
              weight="bold"
              aria-hidden="true"
              className="text-brand dark:text-support"
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
            <span>Continue with Microsoft</span>
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
            <span>Organization SAML / domain SSO</span>
            {samlExpanded ? (
              <CaretUp size={12} weight="bold" aria-hidden="true" />
            ) : (
              <CaretDown size={12} weight="bold" aria-hidden="true" />
            )}
          </button>

          {samlExpanded ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSsoClick("saml");
              }}
              className="mt-3 flex flex-col gap-2 sm:flex-row"
            >
              <label htmlFor="sso-domain" className="sr-only">
                Organization domain
              </label>
              <input
                id="sso-domain"
                type="text"
                value={workDomain}
                disabled={anyPending}
                onChange={(event) => setWorkDomain(event.target.value)}
                placeholder="company.com"
                className="min-h-11 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none disabled:opacity-60 sm:min-h-10"
              />
              <Button
                type="submit"
                variant="primary"
                pending={pendingProvider === "saml"}
                pendingLabel="Checking..."
                disabled={anyPending}
                className="h-11 px-4 sm:h-10"
              >
                Continue
              </Button>
            </form>
          ) : null}
        </div>
      </Card>

      {demoEnabled ? (
        <>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              or quick role access
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Card id="quick-access" className="overflow-hidden">
            <button
              type="button"
              aria-expanded={quickExpanded}
              disabled={anyPending}
              onClick={() => setQuickExpanded((prev) => !prev)}
              className="flex min-h-12 w-full items-center justify-between gap-3 bg-surface-2/50 px-4 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <UserCheck
                  size={17}
                  weight="bold"
                  aria-hidden="true"
                  className="text-brand dark:text-support"
                />
                <div>
                  <span className="block text-sm font-semibold text-fg">Quick role sign-in</span>
                  <span className="block text-xs text-muted">
                    Select a role to evaluate permissions and tenant isolation
                  </span>
                </div>
              </div>
              {quickExpanded ? (
                <CaretUp size={15} weight="bold" aria-hidden="true" className="text-muted" />
              ) : (
                <CaretDown size={15} weight="bold" aria-hidden="true" className="text-muted" />
              )}
            </button>

            {quickExpanded ? (
              <ul className="divide-y divide-line border-t border-line">
                {personas.map((persona) => {
                  const isPending = pendingPersona === persona.key;
                  const workspaceLabel =
                    WORKSPACE_LABELS[persona.workspaceSlug] ?? "Enterprise Workspace";
                  const isSecondaryTenant = persona.workspaceSlug === "northwind-assurance";

                  return (
                    <li key={persona.key}>
                      <button
                        type="button"
                        disabled={anyPending}
                        onClick={() => void choosePersona(persona)}
                        className="group flex min-h-14 w-full flex-col items-start justify-between gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-2/80 disabled:cursor-not-allowed disabled:opacity-55 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
                          <Avatar name={persona.name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="truncate text-sm font-semibold text-fg">
                                {persona.name}
                              </span>
                              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                                · {isSecondaryTenant ? workspaceLabel : "Primary tenant"}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted">{persona.title}</p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5 pl-11 sm:pl-0">
                          <RoleBadge role={persona.role} />
                          {isPending ? (
                            <CircleNotch
                              size={16}
                              weight="bold"
                              aria-hidden="true"
                              className="animate-spin text-brand motion-reduce:animate-none dark:text-support"
                            />
                          ) : (
                            <ArrowRight
                              size={14}
                              weight="bold"
                              aria-hidden="true"
                              className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand dark:group-hover:text-support"
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
      ) : null}
    </div>
  );
}
