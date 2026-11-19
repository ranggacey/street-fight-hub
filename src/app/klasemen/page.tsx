import type { Metadata } from "next";
import { dataOr, serverApiGet } from "@/components/server-api";
import type { LeaderboardEntry } from "@/components/types";
import EmptyState from "@/components/EmptyState";
import KlasemenList from "@/components/KlasemenList";

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
 * rating desc, wins desc, kos desc, losses asc. Tabel + kolom
 * pencarian dirender KlasemenList (client component).
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
        <KlasemenList entries={entries} />
      )}
    </div>
  );
}
