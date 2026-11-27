import { cn } from "@/lib/cn";

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return (parts[0] ?? "?").slice(0, 2).toUpperCase();
  }
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts[parts.length - 1]?.charAt(0) ?? "";
  return `${first}${last}`.toUpperCase();
}

const sizes = {
  sm: "size-8 text-xs",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
} as const;

export function Avatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const safeSrc =
    avatarUrl && (avatarUrl.startsWith("https://") || avatarUrl.startsWith("/")) ? avatarUrl : null;

  if (safeSrc) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={safeSrc}
        alt={name}
        className={cn(
          "shrink-0 rounded-full border border-line object-cover",
          sizes[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-brand/25 bg-brand/10 font-mono font-semibold text-brand select-none",
        sizes[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
