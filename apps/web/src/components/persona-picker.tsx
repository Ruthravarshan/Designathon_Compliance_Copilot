"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, SpinnerGap } from "@phosphor-icons/react";
import type { PersonaSeed } from "@/server/compliance/corpus";

interface ApiError {
  error?: { message?: string; requestId?: string };
}

export function PersonaPicker({ personas }: { personas: PersonaSeed[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(persona: PersonaSeed) {
    setPending(persona.key);
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
      setPending(null);
    }
  }

  return (
    <div>
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-3">
        {personas.map((persona) => {
          const isPending = pending === persona.key;
          const disabled = pending !== null;

          return (
            <button
              key={persona.key}
              type="button"
              onClick={() => choose(persona)}
              disabled={disabled}
              className="group flex w-full items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition-[border-color,box-shadow,transform] hover:border-brand/40 hover:shadow-[0_12px_30px_-24px_rgba(4,13,67,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{persona.name}</span>
                  <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    {persona.role}
                  </span>
                  {persona.workspaceSlug !== "hexa-demo" ? (
                    <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-brand">
                      Isolation tenant
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs text-muted">{persona.title}</span>
                <span className="mt-2 block text-xs leading-relaxed text-muted/90">
                  {persona.blurb}
                </span>
              </span>
              <span className="mt-0.5 shrink-0 text-muted transition-colors group-hover:text-brand">
                {isPending ? (
                  <SpinnerGap size={18} weight="bold" className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight size={18} weight="bold" aria-hidden="true" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
