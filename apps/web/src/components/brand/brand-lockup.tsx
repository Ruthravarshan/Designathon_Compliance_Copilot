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
    <span className={cn("inline-flex items-baseline gap-1.5 select-none", className)}>
      <span className="text-[18px] font-semibold tracking-[-0.025em] text-brand">{appName}</span>
      {!compact ? (
        <span className="text-[14px] font-normal tracking-[-0.01em] text-muted">by Hexaware</span>
      ) : null}
    </span>
  );
}
