import type { ReactNode } from "react";
import GlassCard from "./GlassCard";

/** State kosong / belum ada data. */
export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <GlassCard className="border-dashed px-6 py-10 text-center">
      <div
        aria-hidden="true"
        className="sticker mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-brand bg-amber-brand/15 font-display text-2xl text-amber-brand"
      >
        VS
      </div>
      <h3 className="font-display text-xl uppercase tracking-wide text-paper">
        {title}
      </h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-paper-dim">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </GlassCard>
  );
}
