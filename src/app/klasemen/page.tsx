import Link from "next/link";
import type { Metadata } from "next";
import { dataOr, serverApiGet } from "@/components/server-api";
import { getId, STYLE_LABELS, styleLabel } from "@/components/api";
import type { Fighter, LeaderboardEntry } from "@/components/types";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Klasemen",
  description:
    "Leaderboard fighter Street Fight Hub — turnamen (kemenangan) dan kasual (rating Elo).",
};

export default async function KlasemenPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "kasual" ? "kasual" : "turnamen";

  if (tab === "kasual") {
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
            Klasemen kasual game — diurutkan dari rating Elo (awal 1000, naik
            kalau menang). Terpisah dari rekor turnamen.
          </p>
        </header>
        <nav aria-label="Jenis klasemen" className="flex flex-wrap gap-2">
          <Link
            href="/klasemen"
            className="flex min-h-[44px] items-center rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-paper-dim hover:bg-white/10 hover:text-paper"
          >
            Turnamen
          </Link>
          <Link
            href="/klasemen?tab=kasual"
            aria-current="true"
            className="flex min-h-[44px] items-center rounded-full border border-amber-brand bg-amber-brand px-4 text-sm font-bold text-on-amber"
          >
            Kasual (Rating)
          </Link>
        </nav>
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
            <div className="hidden grid-cols-[3rem_1fr_8rem_5rem_4rem_4rem_4rem] gap-2 border-b border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-wider text-paper-mute md:grid">
              <span>#</span>
              <span>Fighter</span>
              <span>Gaya</span>
              <span className="text-center">Rating</span>
              <span className="text-center">M</span>
              <span className="text-center">K</span>
              <span className="text-center">S</span>
            </div>
            <ol>
              {entries.map((e) => {
                const record = e.casualRecord ?? { wins: 0, losses: 0, draws: 0, kos: 0 };
                return (
                  <li key={e.fighterId}>
                    <Link
                      href={`/fighter/${e.fighterId}`}
                      className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-white/5 md:grid-cols-[3rem_1fr_8rem_5rem_4rem_4rem_4rem] md:px-5"
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
                      <span className="text-center font-display text-lg tabular-nums text-amber-brand md:hidden">
                        {e.rating}
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

  const style = sp.style ?? "";
  const query = style
    ? `/api/fighters?sort=wins&style=${encodeURIComponent(style)}`
    : "/api/fighters?sort=wins";
  const res = await serverApiGet<{ fighters: Fighter[] }>(query);
  const fighters = dataOr(res, { fighters: [] }).fighters;

  const filters = [{ value: "", label: "Semua Gaya" }].concat(
    Object.entries(STYLE_LABELS).map(([value, label]) => ({ value, label })),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Klasemen
        </h1>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Diurutkan dari kemenangan terbanyak, lalu KO terbanyak, lalu
          kekalahan tersedikit.
        </p>
      </header>

      <nav aria-label="Jenis klasemen" className="flex flex-wrap gap-2">
        <Link
          href="/klasemen"
          aria-current="true"
          className="flex min-h-[44px] items-center rounded-full border border-amber-brand bg-amber-brand px-4 text-sm font-bold text-on-amber"
        >
          Turnamen
        </Link>
        <Link
          href="/klasemen?tab=kasual"
          className="flex min-h-[44px] items-center rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-paper-dim hover:bg-white/10 hover:text-paper"
        >
          Kasual (Rating)
        </Link>
      </nav>

      <nav aria-label="Filter gaya bertarung" className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = f.value === style;
          const href = f.value
            ? `/klasemen?style=${encodeURIComponent(f.value)}`
            : "/klasemen";
          return (
            <Link
              key={f.value || "all"}
              href={href}
              aria-current={active ? "true" : undefined}
              className={`flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                active
                  ? "border-amber-brand bg-amber-brand font-bold text-on-amber"
                  : "border-white/20 bg-white/5 text-paper-dim hover:bg-white/10 hover:text-paper"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {res === null ? (
        <EmptyState
          title="Klasemen Belum Bisa Dimuat"
          description="Server atau database mungkin belum siap. Coba muat ulang halaman ini sebentar lagi."
        />
      ) : fighters.length === 0 ? (
        <EmptyState
          title="Belum Ada Fighter"
          description="Belum ada fighter untuk filter ini. Jadilah yang pertama naik ring!"
        />
      ) : (
        <div className="glass overflow-hidden p-0">
          {/* Header tabel — desktop */}
          <div className="hidden grid-cols-[3rem_1fr_8rem_4rem_4rem_4rem_4rem] gap-2 border-b border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-wider text-paper-mute md:grid">
            <span>#</span>
            <span>Fighter</span>
            <span>Gaya</span>
            <span className="text-center">M</span>
            <span className="text-center">K</span>
            <span className="text-center">S</span>
            <span className="text-center">KO</span>
          </div>
          <ol>
            {fighters.map((f, i) => {
              const record = f.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };
              return (
                <li key={getId(f) || i}>
                  <Link
                    href={`/fighter/${getId(f)}`}
                    className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-white/5 md:grid-cols-[3rem_1fr_8rem_4rem_4rem_4rem_4rem] md:px-5"
                  >
                    <span className="font-display text-xl text-amber-brand">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg uppercase leading-tight tracking-wide">
                        {f.displayName}
                      </span>
                      <span className="block truncate text-xs text-paper-mute">
                        @{f.igUsername}
                      </span>
                      <span className="mt-1 inline-block md:hidden">
                        <Badge tone="outline">
                          {styleLabel(f.style, f.styleOther)}
                        </Badge>
                      </span>
                    </span>
                    <span className="hidden text-sm text-paper-dim md:block">
                      {styleLabel(f.style, f.styleOther)}
                    </span>
                    <span className="text-center font-display text-lg tabular-nums md:hidden">
                      {record.wins}M • {record.kos}KO
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
