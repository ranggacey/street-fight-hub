import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "danger" | "ghost" | "glass" | "cyan";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-amber-brand text-on-amber font-bold shadow-[0_6px_24px_rgba(245,166,35,0.35)] hover:bg-[#ffb63d]",
  danger: "bg-red-brand font-bold text-white hover:bg-[#f05248]",
  ghost:
    "border border-white/25 font-semibold text-paper hover:bg-white/10",
  glass: "glass font-semibold text-paper hover:bg-white/10",
  cyan: "bg-cyan-accent font-bold text-ink-950 hover:bg-[#5ee0f5]",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[40px] px-3 py-1.5 text-sm",
  md: "min-h-[44px] px-5 py-2.5 text-sm sm:text-base",
  lg: "min-h-[52px] px-7 py-3 text-base sm:text-lg",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
