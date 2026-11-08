"use client";

import { useState } from "react";
import { getId, styleColor, styleLabel } from "@/components/api";
import type { Fighter } from "@/components/types";
import Badge from "@/components/Badge";
import CheckMark from "@/components/CheckMark";

/**
 * Daftar lawan di /tantangan langkah 01, dengan pagination 6 fighter per
 * halaman (client-side dari data yang sudah di-fetch — urutan/sorting tetap
 * seperti dari API). Pilihan lawan (selectedId) disimpan di parent
 * (TantanganClient, state targetId) sehingga bertahan saat pindah halaman;
 * kalau fighter terpilih ada di halaman lain, chip "Lawan terpilih" di atas
 * daftar menampilkannya + tombol "Lihat" melompat ke halamannya.
 */

export const OPPONENTS_PER_PAGE = 6;

/** Nomor halaman yang ditampilkan: semua kalau <= 7, kalau tidak jendela 1 … kini±1 … akhir. */
export function pageWindow(totalPages: number, current: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

type OpponentPickerProps = {
  /** Fighter lain (sudah terurut seperti dari API). */
  fighters: Fighter[];
  /** id fighter yang sedang dipilih ("" = belum ada). */
  selectedId: string;
  onSelect: (id: string) => void;
  /** Halaman awal — hanya untuk tes (render statis tidak bisa klik). */
  initialPage?: number;
};

export default function OpponentPicker({
  fighters,
  selectedId,
  onSelect,
  initialPage = 1,
}: OpponentPickerProps) {
  const [page, setPage] = useState(initialPage);
  const totalPages = Math.max(1, Math.ceil(fighters.length / OPPONENTS_PER_PAGE));
  // Clamp turunan (bukan effect): daftar bisa menyusut setelah load ulang.
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * OPPONENTS_PER_PAGE;
  const pageFighters = fighters.slice(start, start + OPPONENTS_PER_PAGE);
  const selected =
    fighters.find((f) => getId(f) === selectedId) ?? null;
  const selectedOnPage = pageFighters.some((f) => getId(f) === selectedId);
  const selectedPage = selected
    ? Math.floor(fighters.findIndex((f) => getId(f) === selectedId) / OPPONENTS_PER_PAGE) + 1
    : 0;

  if (fighters.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-paper-dim">
        Belum ada fighter lain yang bisa ditantang.
      </p>
    );
  }

  return (
    <div>
      {selected && !selectedOnPage ? (
        <p className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-brand/50 bg-amber-brand/10 px-3 py-2 text-sm text-paper">
          <span className="min-w-0">
            Lawan terpilih:{" "}
            <strong className="font-display uppercase tracking-wide">
              {selected.displayName}
            </strong>{" "}
            <span className="text-paper-dim">(halaman {selectedPage})</span>
          </span>
          <button
            type="button"
            onClick={() => setPage(selectedPage)}
            className="min-h-[44px] shrink-0 rounded-lg px-3 font-semibold text-amber-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/60"
          >
            Lihat
          </button>
        </p>
      ) : null}

      <div role="radiogroup" aria-label="Pilih lawan" className="space-y-2">
        {pageFighters.map((f) => {
          const id = getId(f);
          const isSelected = selectedId === id;
          const body =
            f.colors?.body && f.colors.body !== "none"
              ? f.colors.body
              : styleColor(f.style);
          const rec = f.casualRecord ?? f.record;
          return (
            <label
              key={id}
              className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors duration-150 focus-within:ring-2 focus-within:ring-amber-brand/60 ${
                isSelected
                  ? "border-amber-brand bg-amber-brand/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <input
                type="radio"
                name="target"
                value={id}
                checked={isSelected}
                onChange={() => onSelect(id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="h-10 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: styleColor(f.style) }}
              />
              <span
                aria-hidden="true"
                className="h-9 w-9 shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: body }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg uppercase leading-tight tracking-wide text-paper">
                  {f.displayName}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-paper-dim">
                  <Badge tone="outline">{styleLabel(f.style, f.styleOther)}</Badge>
                  <span className="truncate">
                    @{f.igUsername} • Menang {rec.wins} • Kalah {rec.losses}
                  </span>
                </span>
              </span>
              <CheckMark checked={isSelected} />
            </label>
          );
        })}
      </div>

      <nav
        aria-label="Halaman daftar lawan"
        className="mt-3 flex flex-wrap items-center justify-between gap-2"
      >
        <p className="text-sm text-paper-dim" aria-live="polite">
          Halaman {safePage} dari {totalPages} • {fighters.length} fighter
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage(safePage - 1)}
            disabled={safePage <= 1}
            aria-label="Halaman sebelumnya"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/15 bg-white/5 px-2 text-sm font-semibold text-paper transition-colors duration-150 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹
          </button>
          {pageWindow(totalPages, safePage).map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                aria-hidden="true"
                className="flex min-h-[44px] min-w-[28px] items-center justify-center text-sm text-paper-mute"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                disabled={p === safePage}
                aria-label={`Halaman ${p}`}
                aria-current={p === safePage ? "page" : undefined}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border px-2 text-sm font-semibold transition-colors duration-150 ${
                  p === safePage
                    ? "border-amber-brand bg-amber-brand/15 text-amber-brand"
                    : "border-white/15 bg-white/5 text-paper hover:border-white/25"
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => setPage(safePage + 1)}
            disabled={safePage >= totalPages}
            aria-label="Halaman berikutnya"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/15 bg-white/5 px-2 text-sm font-semibold text-paper transition-colors duration-150 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </nav>
    </div>
  );
}
