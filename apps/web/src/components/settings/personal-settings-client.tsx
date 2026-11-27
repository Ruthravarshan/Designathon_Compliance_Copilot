"use client";

import { useState } from "react";
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
  const [signedOutState] = useState(false);

  async function handleSignOut() {
    await fetch("/api/auth/signout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    router.push("/signin");
    router.refresh();
  }

  if (signedOutState) {
    return null;
  }

  return (
    <PersonalSettingsView
      actor={{
        name: actor.name,
        email: actor.email,
        role: actor.role,
        authMethodLabel: "Authenticated workspace session",
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
