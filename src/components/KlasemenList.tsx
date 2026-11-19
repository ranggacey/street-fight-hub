"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { styleLabel } from "@/components/api";
import type { LeaderboardEntry } from "@/components/types";
import Badge from "@/components/Badge";

/**
 * KlasemenList — tabel klasemen + kolom pencarian (client-side).
 *
 * Urutan TETAP dari server (/api/leaderboard: rating desc, wins desc,
 * kos desc, losses asc); pencarian hanya menyembunyikan baris yang
 * tidak cocok (nama + @username + gaya), tidak mengurutkan ulang dan
 * tidak mengubah API. Keputusan 2026-11-11 tetap berlaku: SATU ranking,
 * tanpa tab, tanpa filter gaya, tanpa pembagian kelas berat — pencarian
 * di sini bukan filter kategori, melainkan cara cepat menemukan satu
 * fighter di daftar panjang.
 */
export default function KlasemenList({
  entries,
}: {
  entries: LeaderboardEntry[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("id");
    if (!q) return entries;
    return entries.filter(
      (e) =>
        (e.displayName ?? "").toLocaleLowerCase("id").includes(q) ||
        (e.igUsername ?? "").toLocaleLowerCase("id").includes(q) ||
        styleLabel(e.style).toLocaleLowerCase("id").includes(q) ||
        (e.style ?? "").toLocaleLowerCase("id").includes(q),
    );
  }, [entries, query]);

  return (
    <div>
      {/* Pencarian fighter — jelas terlihat di atas tabel. */}
      <div className="mb-3">
        <label htmlFor="klasemen-search" className="sr-only">
          Cari fighter di klasemen
        </label>
        <input
          id="klasemen-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari fighter… (nama, gaya, username)"
          className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/5 px-3.5 text-sm text-paper placeholder:text-paper-mute focus:border-amber-brand focus:outline-none focus:ring-2 focus:ring-amber-brand/40"
        />
        {query.trim() !== "" && (
          <p className="mt-2 text-xs text-paper-dim" aria-live="polite">
            {filtered.length === 0
              ? `Tidak ada fighter yang cocok dengan “${query.trim()}”.`
              : `${filtered.length} dari ${entries.length} fighter cocok dengan “${query.trim()}”.`}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-paper-dim">
          Tidak ada fighter yang cocok — coba kata kunci lain.
        </p>
      ) : (
        <div className="glass overflow-hidden p-0">
          <div className="hidden grid-cols-[3rem_1fr_8rem_5rem_4rem_4rem_4rem_4rem] gap-2 border-b border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-wider text-paper-mute md:grid">
            <span>#</span>
            <span>Fighter</span>
            <span>Gaya</span>
            <span className="text-center">Rating</span>
            <span className="text-center">M</span>
            <span className="text-center">K</span>
            <span className="text-center">S</span>
            <span className="text-center">KO</span>
          </div>
          <ol>
            {filtered.map((e) => {
              const record = e.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };
              return (
                <li key={e.fighterId}>
                  <Link
                    href={`/fighter/${e.fighterId}`}
                    className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-white/5 md:grid-cols-[3rem_1fr_8rem_5rem_4rem_4rem_4rem_4rem] md:px-5"
                  >
                    <span className="font-display text-xl text-amber-brand">
                      {e.rank}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg uppercase leading-tight tracking-wide">
                        {e.displayName}
                      </span>
                      <span className="block truncate text-xs text-paper-mute">
                        @{e.igUsername}
                      </span>
                      <span className="mt-1 inline-block md:hidden">
                        <Badge tone="outline">{styleLabel(e.style)}</Badge>
                      </span>
                    </span>
                    <span className="hidden text-sm text-paper-dim md:block">
                      {styleLabel(e.style)}
                    </span>
                    <span className="flex flex-col items-end text-right md:hidden">
                      <span className="font-display text-lg tabular-nums text-amber-brand">
                        {e.rating}
                      </span>
                      <span className="font-display text-xs tabular-nums text-paper-dim">
                        {record.wins}M {record.losses}K {record.draws}S •{" "}
                        {record.kos}KO
                      </span>
                    </span>
                    <span className="hidden text-center font-display text-lg tabular-nums text-amber-brand md:block">
                      {e.rating}
                    </span>
                    <span className="hidden text-center font-display text-lg tabular-nums text-paper md:block">
                      {record.wins}
                    </span>
                    <span className="hidden text-center font-display text-lg tabular-nums text-paper-dim md:block">
                      {record.losses}
                    </span>
                    <span className="hidden text-center font-display text-lg tabular-nums text-paper-dim md:block">
                      {record.draws}
                    </span>
                    <span className="hidden text-center font-display text-lg tabular-nums text-red-brand md:block">
                      {record.kos}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
