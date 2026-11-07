import GlassCard from "./GlassCard";

/** Chip statistik besar (rekor, angka turnamen, dsb). */
export default function StatChip({
  label,
  value,
  sub,
  tone = "amber",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "amber" | "red" | "cyan" | "paper";
}) {
  const toneCls =
    tone === "amber"
      ? "text-amber-brand"
      : tone === "red"
        ? "text-red-brand"
        : tone === "cyan"
          ? "text-cyan-accent"
          : "text-paper";
  return (
    <GlassCard className="px-4 py-3 text-center">
      <div className={`font-display text-3xl leading-none ${toneCls}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-paper-dim">
        {label}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-paper-mute">{sub}</div> : null}
    </GlassCard>
  );
}
