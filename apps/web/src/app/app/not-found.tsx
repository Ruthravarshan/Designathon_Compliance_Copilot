import Link from "next/link";
import { FileMagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { LinkButton } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-[640px] py-16">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-support/15 dark:text-support">
        <FileMagnifyingGlass size={20} weight="bold" aria-hidden="true" />
      </span>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">404</p>
      <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em]">
        That record is not in this workspace.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The finding or circular may have been removed, or the link points at another tenant. Every
        lookup is scoped to the workspace on your signed session.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <LinkButton href="/app/findings">Back to findings</LinkButton>
        <Link href="/app/circulars" className="text-sm font-medium text-muted hover:text-fg">
          Browse circulars
        </Link>
      </div>
    </div>
  );
}
