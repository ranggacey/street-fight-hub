"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FighterSummary, MatchItem } from "./types";
import {
  asFighter,
  getId,
  METHOD_LABELS,
  normalizeBracket,
  ROUND_LABELS,
  ROUND_ORDER,
} from "./api";
import { elbowPath, sortMatchesForTree } from "@/lib/bracket";
import Badge from "./Badge";
import EmptyState from "./EmptyState";

function MatchRow({ match }: { match: MatchItem }) {
  const id = getId(match);
  const a = asFighter(match.fighterA ?? match.fighterAId);
  const b = asFighter(match.fighterB ?? match.fighterBId);
  const winnerId = typeof match.winnerId === "string" ? match.winnerId : "";
  const aWon = !!a && winnerId !== "" && getId(a) === winnerId;
  const bWon = !!b && winnerId !== "" && getId(b) === winnerId;
  const decided = match.status === "decided" || match.status === "video_done";
  const score = match.score;

  const name = (f: typeof a) => f?.displayName ?? "TBD";

  const row = (f: typeof a, won: boolean, isByeSlot: boolean) => (
    <div
      className={`flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-3 py-2 ${
        won ? "bg-amber-brand/15 font-bold text-amber-brand" : "text-paper-dim"
      }`}
    >
      <span className="min-w-0 truncate text-sm">
        {isByeSlot ? (
          <span className="italic text-paper-mute">Bye</span>
        ) : (
          name(f)
        )}
        {won ? <span className="ml-2 text-xs">★ MENANG</span> : null}
      </span>
      {score && f ? (
        <span className="shrink-0 font-display text-base tabular-nums text-paper">
          {f === a ? score.a : score.b}
        </span>
      ) : null}
    </div>
  );

  const inner = (
    <div className="glass space-y-1.5 p-3">
      {row(a, aWon, false)}
      {row(b, bWon, match.isBye === true)}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {match.isBye ? (
          <Badge tone="neutral">Bye — Lolos Otomatis</Badge>
        ) : decided && match.method ? (
          <Badge tone={match.method === "KO" ? "red" : "amber"}>
            {METHOD_LABELS[match.method] ?? match.method}
          </Badge>
        ) : (
          <Badge tone="outline">Terjadwal</Badge>
        )}
        {match.method === "KO" && match.koTimeSec != null ? (
          <Badge tone="outline">KO {match.koTimeSec} dtk</Badge>
        ) : null}
        {match.method === "draw" ? (
          <Badge tone="cyan">Draw — Undian Ulang</Badge>
        ) : null}
        {match.reelUrl ? (
          <Badge tone="cyan">Ada Video</Badge>
        ) : null}
      </div>
    </div>
  );

  if (id) {
    return (
      <Link href={`/pertandingan/${id}`} className="block transition-transform duration-150 hover:scale-[1.01]">
        {inner}
      </Link>
    );
  }
  return inner;
}

/**
 * Bracket pohon (tree): kolom per ronde dihubungkan garis siku, seperti
 * bagan turnamen di atas kertas — pemenang maju ke match berikutnya,
 * ujungnya kolom Juara. Mobile: geser horizontal.
 *
 * Pemetaan pohon mengikuti advanceWinners (lib/draw.ts): pemenang match
 * ke-i ronde ini dipasangkan ke match ke-floor(i/2) ronde berikut, dengan
 * urutan match = createdAt (sama seperti API bracket).
 * Garis digambar SVG overlay dari posisi kartu yang diukur (useEffect +
 * ResizeObserver), jadi tetap nyambung walau tinggi kartu beda-beda.
 */
export default function BracketView({
  bracket,
  champion,
}: {
  bracket: MatchItem[] | Record<string, MatchItem[]> | null | undefined;
  champion?: FighterSummary | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const roundMatches = useMemo(() => {
    const matches = normalizeBracket(bracket);
    const byRound = new Map<string, MatchItem[]>();
    for (const m of matches) {
      const list = byRound.get(m.round) ?? [];
      list.push(m);
      byRound.set(m.round, list);
    }
    const rounds = ROUND_ORDER.filter((r) => byRound.has(r));
    // Ronde di luar urutan standar tetap ditampilkan di akhir.
    for (const r of byRound.keys()) {
      if (!rounds.includes(r as (typeof ROUND_ORDER)[number])) {
        rounds.push(r as (typeof ROUND_ORDER)[number]);
      }
    }
    return rounds.map((r) => ({
      round: r,
      matches: sortMatchesForTree(byRound.get(r) ?? []),
    }));
  }, [bracket]);

  const isEmpty = roundMatches.every((r) => r.matches.length === 0);

  // Juara: dari prop (detail turnamen, lengkap dgn IG) atau fallback dari
  // pemenang match final (winnerId ter-populate displayName).
  const championName = useMemo(() => {
    if (champion) return champion;
    const last = roundMatches[roundMatches.length - 1];
    const finalMatch = last?.matches[0];
    if (!finalMatch) return null;
    const w = asFighter(
      (finalMatch.winnerId as unknown as FighterSummary | string | null) ?? null,
    );
    return w ?? null;
  }, [champion, roundMatches]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    // Posisi node diambil lewat data-bracket-node (bukan callback ref —
    // react-hooks/refs melarang akses ref saat render).
    const nodes = new Map<string, { x: number; y: number; right: number }>();
    for (const el of container.querySelectorAll<HTMLElement>("[data-bracket-node]")) {
      const key = el.getAttribute("data-bracket-node");
      if (!key) continue;
      const r = el.getBoundingClientRect();
      nodes.set(key, {
        x: r.left - cRect.left + container.scrollLeft,
        y: r.top + r.height / 2 - cRect.top + container.scrollTop,
        right: r.right - cRect.left + container.scrollLeft,
      });
    }
    const point = (key: string, edge: "left" | "right") => {
      const n = nodes.get(key);
      if (!n) return null;
      return { x: edge === "right" ? n.right : n.x, y: n.y };
    };
    const next: string[] = [];
    roundMatches.forEach((col, ri) => {
      col.matches.forEach((_m, mi) => {
        const from = point(`${ri}:${mi}`, "right");
        if (!from) return;
        const isLastRound = ri === roundMatches.length - 1;
        const to = isLastRound
          ? point("champion", "left")
          : point(`${ri + 1}:${Math.floor(mi / 2)}`, "left");
        if (!to) return;
        next.push(elbowPath(from.x, from.y, to.x, to.y));
      });
    });
    setPaths((prev) => {
      if (prev.length === next.length && prev.every((p, i) => p === next[i])) {
        return prev;
      }
      return next;
    });
    setSvgSize((prev) => {
      const w = container.scrollWidth;
      const h = container.scrollHeight;
      if (prev.w === w && prev.h === h) return prev;
      return { w, h };
    });
  }, [roundMatches]);

  useEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    // Ukur ulang setelah font dimuat (tinggi kartu bisa berubah).
    document.fonts?.ready.then(() => measure()).catch(() => {});
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  if (isEmpty) {
    return (
      <EmptyState
        title="Bracket Belum Dibuat"
        description="Bracket akan muncul setelah admin menutup pendaftaran dan membuat bracket turnamen ini."
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-auto pb-4"
      aria-label="Bracket turnamen"
    >
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={svgSize.w}
        height={svgSize.h}
        aria-hidden="true"
      >
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="rgba(245, 166, 35, 0.55)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="relative z-10 flex gap-14">
        {roundMatches.map((col, ri) => (
          <section
            key={col.round}
            className="flex w-[280px] shrink-0 snap-start flex-col sm:w-[300px]"
            aria-label={ROUND_LABELS[col.round] ?? col.round}
          >
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg uppercase tracking-wide">
              <span className="rounded-md bg-amber-brand px-2 py-0.5 text-sm text-on-amber">
                {col.round}
              </span>
              <span className="text-paper">{ROUND_LABELS[col.round] ?? col.round}</span>
              <span className="text-sm text-paper-mute">({col.matches.length})</span>
            </h3>
            <div className="flex flex-1 flex-col justify-around gap-3 py-1">
              {col.matches.map((m, mi) => (
                <div
                  key={getId(m) || `${col.round}-${mi}`}
                  data-bracket-node={`${ri}:${mi}`}
                >
                  <MatchRow match={m} />
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Kolom juara — ujung pohon */}
        <section
          className="flex w-[280px] shrink-0 snap-start flex-col sm:w-[300px]"
          aria-label="Juara"
        >
          <h3 className="mb-3 flex items-center gap-2 font-display text-lg uppercase tracking-wide">
            <span className="rounded-md bg-amber-brand px-2 py-0.5 text-sm text-on-amber">
              🏆
            </span>
            <span className="text-paper">Juara</span>
          </h3>
          <div className="flex flex-1 flex-col justify-around py-1">
            <div data-bracket-node="champion">
              <div className="glass border-amber-brand/50 p-4 text-center">
                {championName ? (
                  <>
                    <p className="font-display text-2xl uppercase leading-tight tracking-wide text-amber-brand">
                      {championName.displayName}
                    </p>
                    {championName.igUsername ? (
                      <p className="mt-1 text-xs text-paper-mute">
                        @{championName.igUsername}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-paper-mute">
                    Juara belum ditentukan — final belum diundi.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
