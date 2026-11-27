"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      router.push("/signin");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-medium text-muted transition-colors hover:border-muted/50 hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing out" : "Sign out"}
      <ArrowRight size={12} weight="bold" aria-hidden="true" />
    </button>
  );
}
