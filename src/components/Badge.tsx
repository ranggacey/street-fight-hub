import type { ReactNode } from "react";

export type BadgeTone =
  | "amber"
  | "red"
  | "cyan"
  | "green"
  | "neutral"
  | "outline";

const TONES: Record<BadgeTone, string> = {
  amber:
    "bg-amber-brand text-on-amber border border-amber-brand font-bold",
  red: "bg-red-brand text-white border border-red-brand font-bold",
  cyan: "bg-cyan-accent text-ink-950 border border-cyan-accent font-bold",
  green: "bg-emerald-400 text-ink-950 border border-emerald-400 font-bold",
  neutral:
    "bg-white/10 text-paper border border-white/20 font-semibold",
  outline:
    "bg-transparent text-paper-dim border border-white/25 font-semibold",
};

/** Stiker/badge kecil uppercase. */
export default function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-[24px] items-center rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
