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

  async function handleSignOut() {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } catch {
      // Redirect even if network call fails.
    } finally {
      router.push("/signin");
      router.refresh();
    }
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
