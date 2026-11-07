"use client";

import { useEffect, useState } from "react";
import { formatWIB, timeLeft } from "./api";

/** Hitung mundur ke target (zona Asia/Jakarta), update tiap detik. */
export default function Countdown({
  target,
  label = "Pendaftaran ditutup dalam",
  endedLabel = "Pendaftaran sudah ditutup",
}: {
  target: string;
  label?: string;
  endedLabel?: string;
}) {
  const [left, setLeft] = useState(() => timeLeft(target));

  useEffect(() => {
    const t = setInterval(() => setLeft(timeLeft(target)), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (left.past) {
    return (
      <div className="glass px-4 py-3">
        <p className="text-sm font-semibold text-red-400">{endedLabel}</p>
        <p className="mt-0.5 text-xs text-paper-mute">
          Batas waktu: {formatWIB(target)}
        </p>
      </div>
    );
  }

  const cells: { value: number; unit: string }[] = [
    { value: left.days, unit: "Hari" },
    { value: left.hours, unit: "Jam" },
    { value: left.minutes, unit: "Menit" },
    { value: left.seconds, unit: "Detik" },
  ];

  return (
    <div className="glass px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-paper-dim">
        {label}
      </p>
      <div
        className="mt-2 flex items-stretch gap-2"
        role="timer"
        aria-label={`${left.days} hari ${left.hours} jam ${left.minutes} menit ${left.seconds} detik lagi`}
      >
        {cells.map((c) => (
          <div
            key={c.unit}
            className="min-w-[64px] flex-1 rounded-xl border border-white/10 bg-ink-950/60 px-2 py-2 text-center"
          >
            <div className="font-display text-2xl leading-none text-amber-brand tabular-nums sm:text-3xl">
              {String(c.value).padStart(2, "0")}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-paper-mute">
              {c.unit}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-paper-mute">
        Batas waktu: {formatWIB(target)}
      </p>
    </div>
  );
}
