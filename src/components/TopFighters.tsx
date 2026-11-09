"use client";

import { useEffect, useState } from "react";
import { clientApi, getId } from "./api";
import type { Fighter, LeaderboardEntry } from "./types";
import FighterCard from "./FighterCard";

/**
 * Top 5 home: data awal dirender server (cepat, SEO), lalu komponen ini
 * menyegarkan sendiri dari /api/leaderboard saat tampil dan setiap kali
 * tab kembali terlihat.
 *
 * Kenapa perlu: jalur data server SUDAH live (home HTML hasil curl
 * menampilkan rating/rekor terbaru; /api/leaderboard ber-cache max 15
 * detik). Yang basi adalah tab browser yang dipulihkan (back-forward
 * cache / tab lama di HP) — halaman hasil render lama tampil tanpa
 * request baru. Refresh saat tab terlihat lagi membuat angka kembali
 * benar dalam sedetik. Gagal fetch = tetap pakai data server, bukan
 * error.
 */
export function toTopFighter(e: LeaderboardEntry): Fighter {
  const record = e.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };
  return {
    _id: e.fighterId,
    displayName: e.displayName ?? "-",
    igUsername: e.igUsername ?? "",
    style: (e.style ?? "tinju") as Fighter["style"],
    record,
    rating: e.rating ?? 1000,
    status: "active" as const,
  };
}

export default function TopFighters({
  initial,
}: {
  initial: LeaderboardEntry[];
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initial);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const res = await clientApi<{ entries: LeaderboardEntry[] }>(
        "/api/leaderboard",
      );
      if (!alive || !res.ok) return;
      const next = res.data.entries.slice(0, 5);
      if (next.length > 0) setEntries(next);
    };
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const topFighters = entries.map(toTopFighter);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {topFighters.map((f, i) => (
        <FighterCard key={getId(f) || i} fighter={f} rank={i + 1} showRating />
      ))}
    </div>
  );
}
