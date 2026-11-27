import { cn } from "@/lib/cn";

function isSafeLogoUrl(url: string | null | undefined): url is string {
  if (!url) {
    return false;
  }
  const trimmed = url.trim();
  return trimmed.startsWith("/") || trimmed.startsWith("https://") || trimmed.startsWith("http://");
}

export function BrandLockup({
  appName = "PolicyPulse",
  logoUrl,
  compact = false,
  className,
}: {
  appName?: string;
  logoUrl?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const safeLogo = isSafeLogoUrl(logoUrl) ? logoUrl.trim() : null;

  if (safeLogo) {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        {/* Official Hexaware / workspace-configured lockup */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={safeLogo}
          alt={appName}
          className="h-7 w-auto min-w-[90px] max-w-[160px] object-contain"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span
        aria-hidden="true"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-ink"
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-4">
          <path
            d="M2.5 10.5h3l2-5 3 9 2-4.5h5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-[17px] font-semibold tracking-[-0.025em] text-fg">{appName}</span>
        {!compact ? (
          <span className="hidden text-[12px] font-normal tracking-[-0.01em] text-muted sm:inline">
            by Hexaware
          </span>
        ) : null}
      </span>
    </span>
  );
}
