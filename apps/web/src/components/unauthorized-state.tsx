import Link from "next/link";
import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";

export function UnauthorizedState({
  title = "This view is outside your role.",
  body = "Your workspace role does not include permission for this area. Switch persona or ask the workspace owner for access.",
  signedInAs,
}: {
  title?: string;
  body?: string;
  signedInAs?: string;
}) {
  return (
    <div className="mx-auto max-w-[640px] py-16">
      <Card className="p-8">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <LockSimple size={20} weight="bold" aria-hidden="true" />
        </span>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">403</p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-0.02em]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
        {signedInAs ? (
          <p className="mt-4 font-mono text-[11px] text-muted">Signed in as {signedInAs}</p>
        ) : null}
        <div className="mt-7 flex flex-wrap gap-3">
          <LinkButton href="/app">Back to overview</LinkButton>
          <Link
            href="/signin"
            className="inline-flex h-11 items-center text-sm font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Switch persona
          </Link>
        </div>
      </Card>
    </div>
  );
}
