import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover",
  secondary: "border border-line bg-surface text-fg hover:border-muted/60 hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-brand-ink hover:opacity-90",
} as const;

const sizes = {
  default: "h-11 px-5 text-sm sm:h-10",
  sm: "h-11 px-4 text-xs sm:h-9",
  lg: "h-12 px-6 text-sm",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  pendingLabel?: string;
}

export function Button({
  variant = "primary",
  size = "default",
  pending = false,
  pendingLabel,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || pending);

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,border-color,color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {pending ? (
        <>
          <CircleNotch
            size={15}
            weight="bold"
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          <span>{pendingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
  pending?: boolean;
}

export function IconButton({
  label,
  variant = "secondary",
  pending = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={Boolean(disabled || pending)}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full transition-[background-color,border-color,color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 sm:size-10",
        variants[variant],
        className,
      )}
      {...props}
    >
      {pending ? (
        <CircleNotch
          size={16}
          weight="bold"
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        children
      )}
    </button>
  );
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function LinkButton({
  href,
  variant = "primary",
  size = "default",
  className,
  children,
  ...props
}: LinkButtonProps) {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");

  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,border-color,color] duration-150",
    variants[variant],
    sizes[size],
    className,
  );

  if (isExternal) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
