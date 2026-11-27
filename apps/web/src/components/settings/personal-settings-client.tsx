"use client";

import { useRouter } from "next/navigation";
import { PersonalSettingsView } from "@/components/settings/personal-settings-view";
import type { ThemeMode } from "@/components/theme/theme";

export function PersonalSettingsClient({
  actor,
  initialTheme,
}: {
  actor: {
    name: string;
    email: string;
    role: string;
    isDemo: boolean;
  };
  initialTheme: ThemeMode;
}) {
  const router = useRouter();

  async function handleSignOut(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        return { ok: false, error: body.error?.message ?? "Sign out failed. Try again." };
      }
    } catch {
      return { ok: false, error: "Check your connection and try again." };
    }

    router.push("/signin");
    router.refresh();
    return { ok: true };
  }

  return (
    <PersonalSettingsView
      actor={{
        name: actor.name,
        email: actor.email,
        role: actor.role,
        authMethodLabel: actor.isDemo
          ? "Evaluation session · HMAC signed cookie"
          : "Authenticated workspace session",
        isDemo: actor.isDemo,
        isGuest: false,
        canEditName: false,
        canEditTitle: false,
      }}
      initialTheme={initialTheme}
      emailCategories={[]}
      onSignOut={handleSignOut}
    />
  );
}
