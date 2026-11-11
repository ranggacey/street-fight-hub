import Link from "next/link";
import type { Metadata } from "next";
import { dataOr, serverApiGet } from "@/components/server-api";
import { styleLabel } from "@/components/api";
import type { LeaderboardEntry } from "@/components/types";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Klasemen",
  description:
    "Klasemen tunggal Street Fight Hub — satu ranking untuk semua fighter, diurutkan dari rating Elo, lalu kemenangan, KO, dan kekalahan. Satu rekor, satu rating, semua mode.",
};

/**
 * Klasemen — SATU ranking (keputusan 2026-11-11). Tidak ada tab
 * "Turnamen vs Kasual", tidak ada filter gaya, tidak ada pembagian
 * kelas berat. Satu daftar, urutan tunggal dari /api/leaderboard:
 * rating desc, wins desc, kos desc, losses asc.
 */
export default async function KlasemenPage() {
  const res = await serverApiGet<{ entries: LeaderboardEntry[] }>(
    "/api/leaderboard",
  );
  const entries = dataOr(res, { entries: [] }).entries;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Klasemen
        </h1>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Satu ranking untuk semua fighter — kasual, turnamen, dan gelar
          dihitung jadi satu. Diurutkan dari rating Elo (awal 1000, naik
          kalau menang, turun kalau kalah), lalu kemenangan terbanyak, KO
          terbanyak, dan kekalahan tersedikit. Gaya bertarung hanya
          keterangan, bukan filter.
        </p>
      </header>

      {res === null ? (
        <EmptyState
          title="Klasemen Belum Bisa Dimuat"
          description="Server atau database mungkin belum siap. Coba muat ulang halaman ini sebentar lagi."
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Belum Ada Fighter"
          description="Belum ada fighter. Jadilah yang pertama naik ring!"
        />
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
            {entries.map((e) => {
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
