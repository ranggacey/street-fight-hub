"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  clientApi,
  formatWIB,
  MAP_LABELS,
  moveLabel,
  styleLabel,
} from "@/components/api";
import type { Fighter, GameFight } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import Button, { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import StatChip from "@/components/StatChip";

// Arena kini disajikan SAME-ORIGIN oleh Hub sendiri (public/arena/,
// di-embed dari /arena/index.html) — bukan lagi dari domain Vercel Arena
// terpisah. Project Vercel lama (stickman-fight-arena-zeta) masih ada
// tapi TIDAK dipakai lagi oleh Hub. Origin postMessage = origin Hub
// sendiri; EMBED_ALLOWED_ORIGINS di arena (js/app.js) sudah memuat
// origin produksi Hub + localhost:3000.
const ARENA_URL = "/arena/index.html";
const ARENA_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";

type FightDetail = {
  fight: GameFight;
  config: {
    type: string;
    fightId: string;
    fighters: { left: Record<string, unknown>; right: Record<string, unknown> };
    seed: number;
    map: string;
    duration: number;
  };
  fighterA: Fighter;
  fighterB: Fighter;
  winPercentA: number;
  winPercentB: number;
  mySide: "A" | "B" | null;
  canSubmit: boolean;
  fightsRemaining: number | null;
};

/**
 * Bobot lotere hasil — TAMPILAN SAJA, bukan logika lotere.
 * Sumber: bobot lotere engine hasil fight (agen engine, Nov 2026):
 * Decision A 30%, Decision B 30%, KO A 15%, KO B 15%, Draw 10%
 * (total 100% untuk jenis kemenangan). Kalau engine mengubah bobot, angka
 * di sini WAJIB ikut diubah supaya tampilan tetap konsisten dengan hasil
 * undian sebenarnya.
 * Peluang menang: A = 30 + 15 = 45, B = 30 + 15 = 45, seri 10 — bila ada
 * pemenang, peluangnya 45:45 = 50:50.
 */
const OUTCOME_WEIGHTS = {
  decisionA: 30,
  decisionB: 30,
  koA: 15,
  koB: 15,
  draw: 10,
} as const;

type Phase = "loading" | "ready" | "error";

function nameOf(f: Fighter | undefined, fallback: string): string {
  return f?.displayName ?? fallback;
}

/** Pemenang versi Hub: winnerSide "R" = fighterA (kiri/merah), "B" = fighterB (kanan/biru). */
type Verdict = {
  method: "KO" | "decision" | "draw";
  winner: Fighter | null;
  loser: Fighter | null;
};

function resolveVerdict(
  fight: GameFight,
  fighterA: Fighter,
  fighterB: Fighter,
): Verdict | null {
  const r = fight.result;
  if (!r || !r.method) return null;
  if (r.method === "draw" || !r.winnerSide) {
    return { method: "draw", winner: null, loser: null };
  }
  const winner = r.winnerSide === "R" ? fighterA : fighterB;
  const loser = r.winnerSide === "R" ? fighterB : fighterA;
  return { method: r.method, winner, loser };
}

/**
 * Kartu duel ringkas: kedua petarung berdampingan (2 kolom di SEMUA lebar,
 * termasuk 390px) dengan nama DI ATAS info lainnya — nama tidak pernah
 * menumpuk di atas bar atau elemen lain. Kartu ini muat di atas lipatan
 * bersama bagian atas arena, jadi tidak terpotong saat halaman di-scroll.
 */
function FighterDuelCard({
  fighterA,
  fighterB,
}: {
  fighterA: Fighter;
  fighterB: Fighter;
}) {
  const side = (f: Fighter, fallbackColor: string) => {
    const color = f.colors?.body ?? fallbackColor;
    const record = f.record;
    return (
      <div className="min-w-0 px-1 py-1 text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-3.5 w-3.5 rounded-full ring-2 ring-white/30"
          style={{ backgroundColor: color }}
        />
        <p className="break-words font-display text-xl uppercase leading-tight tracking-wide sm:text-2xl">
          {f.displayName}
        </p>
        <p className="mt-1 text-xs font-semibold text-paper-dim">
          {styleLabel(f.style, f.styleOther)}
        </p>
        <p className="mt-1 text-xs text-paper-mute">
          Rating {f.rating ?? 1000} • Rekor {record?.wins ?? 0}M–
          {record?.losses ?? 0}K
          {record?.draws ? `–${record.draws}S` : ""}
        </p>
        {f.signatureMove ? (
          <p
            className="mt-1 truncate text-xs text-paper-mute"
            title={moveLabel(f.signatureMove)}
          >
            Jurus: {moveLabel(f.signatureMove)}
          </p>
        ) : null}
        {f.tempo ? (
          <p className="text-xs capitalize text-paper-mute">
            Tempo: {f.tempo}
          </p>
        ) : null}
      </div>
    );
  };
  return (
    <section aria-label="Petarung yang bertarung">
      <div className="glass grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 py-4 sm:gap-3 sm:px-4">
        {side(fighterA, "#f5a623")}
        <span className="shrink-0 px-1 font-display text-2xl text-amber-brand sm:text-4xl">
          VS<span className="sr-only"> melawan </span>
        </span>
        {side(fighterB, "#e5382e")}
      </div>
    </section>
  );
}

/**
 * Panel peluang hasil pra-fight: breakdown metode sesuai bobot lotere
 * (OUTCOME_WEIGHTS) + peluang menang 50:50. Win% Elo dari API sengaja
 * TIDAK ditampilkan di sini — hasil fight diundi 50:50 dan menampilkan
 * persentase Elo di sampingnya akan bertentangan dengan itu. Rating Elo
 * tetap tampil sebagai angka di kartu petarung di atas.
 */
function OutcomeBreakdown({
  fighterA,
  fighterB,
}: {
  fighterA: Fighter;
  fighterB: Fighter;
}) {
  const nameA = nameOf(fighterA, "Petarung A");
  const nameB = nameOf(fighterB, "Petarung B");
  const rows = [
    {
      label: `Decision — ${nameA}`,
      pct: OUTCOME_WEIGHTS.decisionA,
      bar: "bg-amber-brand",
    },
    {
      label: `Decision — ${nameB}`,
      pct: OUTCOME_WEIGHTS.decisionB,
      bar: "bg-red-brand",
    },
    {
      label: `KO — ${nameA}`,
      pct: OUTCOME_WEIGHTS.koA,
      bar: "bg-amber-brand/70",
    },
    {
      label: `KO — ${nameB}`,
      pct: OUTCOME_WEIGHTS.koB,
      bar: "bg-red-brand/70",
    },
    {
      label: "Draw — Seri",
      pct: OUTCOME_WEIGHTS.draw,
      bar: "bg-cyan-accent",
    },
  ];
  const total = rows.reduce((n, r) => n + r.pct, 0);
  return (
    <section aria-label="Peluang hasil fight">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl uppercase tracking-wide">
            Peluang Hasil
          </h2>
          <Badge tone="amber">Undian • Total {total}%</Badge>
        </div>
        <p className="mt-1 text-sm text-paper-dim">
          Hasil fight diundi dari bobot di bawah — peluang menang {nameA} vs{" "}
          {nameB} adalah 50 : 50.
        </p>

        {/* Peluang menang 50:50 (bila ada pemenang) */}
        <div className="mt-4">
          <div className="flex justify-between gap-2 text-sm font-bold">
            <span className="min-w-0 truncate">{nameA} — 50%</span>
            <span className="min-w-0 truncate text-right">
              50% — {nameB}
            </span>
          </div>
          <div
            className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-white/10"
            role="img"
            aria-label={`Peluang menang ${nameA} 50 persen, ${nameB} 50 persen`}
          >
            <div className="bg-amber-brand" style={{ width: "50%" }} />
            <div className="bg-red-brand" style={{ width: "50%" }} />
          </div>
          <p className="mt-1.5 text-xs text-paper-mute">
            Peluang menang bila ada pemenang (hasil seri tidak dihitung).
          </p>
        </div>

        {/* Breakdown metode kemenangan */}
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-semibold">
                  {r.label}
                </span>
                <span className="shrink-0 font-display text-lg">
                  {r.pct}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full ${r.bar}`}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-paper-mute">
          Dari 100 undian: 45 untuk {nameA} menang (30 decision + 15 KO), 45
          untuk {nameB} menang, 10 seri. Rating Elo tetap tampil di kartu
          petarung di atas — tapi hasil fight diundi 50:50, bukan dari rating.
        </p>
      </GlassCard>
    </section>
  );
}

/**
 * Hero layar juri — hasil akhir BESAR dan menonjol, bukan teks kecil:
 * metode (Menang KO / Menang Angka / Seri), nama pemenang, skor raksasa,
 * dan waktu KO bila ada. Menangani ketiga metode: KO, decision, draw.
 */
function VerdictHero({
  fight,
  fighterA,
  fighterB,
}: {
  fight: GameFight;
  fighterA: Fighter;
  fighterB: Fighter;
}) {
  const verdict = resolveVerdict(fight, fighterA, fighterB);
  if (!verdict) return null;
  const { method, winner, loser } = verdict;
  const isDraw = method === "draw" || !winner;
  const headline = isDraw
    ? "Seri"
    : method === "KO"
      ? "Menang KO"
      : "Menang Angka";
  const headlineCls = isDraw
    ? "text-cyan-accent"
    : method === "KO"
      ? "text-red-brand"
      : "text-amber-brand";
  const score = fight.result?.score ?? null;
  const koTimeSec = fight.result?.koTimeSec ?? null;
  const narrative =
    !isDraw && winner && loser && method === "KO"
      ? `${winner.displayName} menang KO atas ${loser.displayName}${
          koTimeSec != null ? ` di detik ${koTimeSec}` : ""
        }.`
      : !isDraw && winner && loser && score
        ? `${winner.displayName} menang angka ${score.a}–${score.b} atas ${loser.displayName}.`
        : "Fight berakhir seri — kedua petarung sama kuat.";
  return (
    <section aria-labelledby="hasil-heading" className="animate-pop-in">
      <GlassCard
        strong
        className="overflow-hidden px-4 py-6 text-center sm:px-8 sm:py-8"
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge tone={isDraw ? "cyan" : method === "KO" ? "red" : "amber"}>
            Keputusan Juri
          </Badge>
          {fight.isTitleFight ? (
            <Badge tone="red">Perebutan Gelar</Badge>
          ) : null}
        </div>
        <h2
          id="hasil-heading"
          className={`mt-4 font-display text-5xl uppercase leading-none tracking-wide sm:text-7xl ${headlineCls}`}
        >
          {headline}
        </h2>
        {winner ? (
          <p className="mt-3 break-words font-display text-3xl uppercase leading-tight tracking-wide sm:text-5xl">
            {winner.displayName}
          </p>
        ) : (
          <p className="mt-3 break-words font-display text-2xl uppercase leading-tight tracking-wide sm:text-4xl">
            {nameOf(fighterA, "Petarung A")}{" "}
            <span className="text-amber-brand">vs</span>{" "}
            {nameOf(fighterB, "Petarung B")}
          </p>
        )}
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-paper-dim sm:text-base">
          {narrative}
        </p>
        {score ? (
          <div
            className="mt-6 flex items-start justify-center gap-4 sm:gap-6"
            role="img"
            aria-label={`Skor akhir ${score.a} lawan ${score.b}`}
          >
            <div className="min-w-0">
              <p
                className={`font-display text-6xl leading-none sm:text-7xl ${
                  !isDraw && winner === fighterA
                    ? "text-amber-brand"
                    : "text-paper"
                }`}
              >
                {score.a}
              </p>
              <p
                className="mx-auto mt-2 max-w-[150px] truncate text-xs font-semibold uppercase tracking-wide text-paper-dim"
                title={nameOf(fighterA, "Kiri")}
              >
                {nameOf(fighterA, "Kiri")}
              </p>
            </div>
            {/* Pemisah skor sebagai BATANG, bukan glyph '–': glyph dash
                terlalu kecil dibanding angka raksasa (text-6xl/7xl) dan
                melayang di celah lebar (15-0 di layar lama: bintik kecil).
                Batang proporsional: lebar ~0,45x ukuran digit (27px di
                text-6xl, 32px di sm:text-7xl), tebal ~0,12x (7px/9px),
                terpusat vertikal terhadap angka lewat wrapper setinggi
                line-box digit (60px/72px). */}
            <span
              aria-hidden="true"
              className="flex h-[60px] items-center sm:h-[72px]"
            >
              <span className="block h-[7px] w-[27px] rounded-full bg-amber-brand sm:h-[9px] sm:w-[32px]" />
            </span>
            <div className="min-w-0">
              <p
                className={`font-display text-6xl leading-none sm:text-7xl ${
                  !isDraw && winner === fighterB
                    ? "text-amber-brand"
                    : "text-paper"
                }`}
              >
                {score.b}
              </p>
              <p
                className="mx-auto mt-2 max-w-[150px] truncate text-xs font-semibold uppercase tracking-wide text-paper-dim"
                title={nameOf(fighterB, "Kanan")}
              >
                {nameOf(fighterB, "Kanan")}
              </p>
            </div>
          </div>
        ) : null}
        {method === "KO" && koTimeSec != null ? (
          <p className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-red-brand/15 px-4 py-2 text-sm font-bold text-red-400 ring-1 ring-red-brand/40">
            KO di detik {koTimeSec} dari 60 detik
          </p>
        ) : null}
        {method !== "KO" ? (
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-paper-mute">
            Full time • 60 detik
          </p>
        ) : null}
      </GlassCard>
    </section>
  );
}

function Breakdown({
  fight,
  fighterA,
  fighterB,
}: {
  fight: GameFight;
  fighterA: Fighter;
  fighterB: Fighter;
}) {
  const r = fight.result;
  if (!r) return null;
  const s = fight.stats;
  const km = fight.keyMoments;
  const totalDamage = (s?.damageDealtA ?? 0) + (s?.damageDealtB ?? 0);
  const pctA =
    totalDamage > 0
      ? Math.round(((s?.damageDealtA ?? 0) / totalDamage) * 100)
      : 50;
  const hitName = (by: "L" | "R"): string =>
    by === "L" ? nameOf(fighterA, "Kiri") : nameOf(fighterB, "Kanan");

  return (
    <div className="space-y-4">
      {s ? (
        <>
          <div>
            <div className="mb-1 flex justify-between gap-2 text-xs font-semibold text-paper-dim">
              <span className="min-w-0 truncate">
                {nameOf(fighterA, "Kiri")} — damage {s.damageDealtA ?? 0}
              </span>
              <span className="min-w-0 truncate text-right">
                {nameOf(fighterB, "Kanan")} — damage {s.damageDealtB ?? 0}
              </span>
            </div>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-white/10"
              role="img"
              aria-label={`Damage ${pctA}% vs ${100 - pctA}%`}
            >
              <div className="bg-amber-brand" style={{ width: `${pctA}%` }} />
              <div
                className="bg-red-brand"
                style={{ width: `${100 - pctA}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip
              label={`Akurasi ${nameOf(fighterA, "Kiri")}`}
              value={`${Math.round((s.accuracyA ?? 0) * 100)}%`}
              tone="amber"
            />
            <StatChip
              label={`Akurasi ${nameOf(fighterB, "Kanan")}`}
              value={`${Math.round((s.accuracyB ?? 0) * 100)}%`}
              tone="red"
            />
            <StatChip
              label="Pukulan mendarat"
              value={`${s.strikesLandedA ?? 0} : ${s.strikesLandedB ?? 0}`}
              tone="paper"
            />
            <StatChip
              label="Knockdown"
              value={s.knockdowns ?? 0}
              tone="cyan"
            />
          </div>
          <dl className="space-y-1 text-sm text-paper-dim">
            <div className="flex justify-between gap-2">
              <dt>Serangan dilempar</dt>
              <dd className="font-semibold text-paper">
                {s.strikesThrownA ?? 0} : {s.strikesThrownB ?? 0}
              </dd>
            </div>
            {km?.biggestHit ? (
              <div className="flex justify-between gap-2">
                <dt>Pukulan terbesar</dt>
                <dd className="text-right font-semibold text-paper">
                  {moveLabel(km.biggestHit.move)} (
                  {km.biggestHit.damage ?? "?"} dmg)
                  {" — "}
                  {hitName(km.biggestHit.by)}, detik {km.biggestHit.timeSec}
                </dd>
              </div>
            ) : null}
            {km?.finisher ? (
              <div className="flex justify-between gap-2">
                <dt>Finisher</dt>
                <dd className="text-right font-semibold text-paper">
                  {moveLabel(km.finisher.move)} — {hitName(km.finisher.by)},
                  detik {km.finisher.timeSec}
                </dd>
              </div>
            ) : null}
            {km?.leadChange ? (
              <div className="flex justify-between gap-2">
                <dt>Momen balik</dt>
                <dd className="text-right font-semibold text-paper">
                  Detik {km.leadChange.timeSec} — {hitName(km.leadChange.by)}{" "}
                  merebut keunggulan
                </dd>
              </div>
            ) : null}
            {km?.knockdowns && km.knockdowns.length > 0 ? (
              <div className="flex justify-between gap-2">
                <dt>Knockdown</dt>
                <dd className="text-right font-semibold text-paper">
                  {km.knockdowns
                    .map((k) => `${hitName(k.by)} (${k.timeSec}d)`)
                    .join(", ")}
                </dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}
    </div>
  );
}

export default function GameArena({
  fightId,
  exportMode = false,
}: {
  fightId: string;
  /**
   * Mode ekspor video (dari admin "Ekspor Video", ?export=1): kirim
   * autoRecord ke Arena — rekaman MediaRecorder mulai otomatis saat tombol
   * Tarung diklik, video webm terunduh otomatis saat fight selesai.
   * Hasil fight TIDAK dikirim ulang ke server (fight sudah completed).
   */
  exportMode?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [detail, setDetail] = useState<FightDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [dispute, setDispute] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const submittedRef = useRef(false);

  const load = useCallback(async () => {
    const res = await clientApi<FightDetail>(`/api/game-fights/${fightId}`);
    if (!res.ok) {
      setLoadError(res.error.message);
      setPhase("error");
      return;
    }
    setDetail(res.data);
    setPhase("ready");
    if (
      res.data.fight.status === "completed" ||
      res.data.fight.status === "disputed"
    ) {
      submittedRef.current = true;
    }
  }, [fightId]);

  useEffect(() => {
    // Fetch saat mount — pola standar (bukan sinkronisasi state antar render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Bridge postMessage dengan iframe arena (EMBED-CONTRACT).
  useEffect(() => {
    if (phase !== "ready" || !detail) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const postResult = async (payload: Record<string, unknown>) => {
      if (submittedRef.current || submitting) return;
      if (payload.fightId !== fightId) return;
      if (payload.seed !== detail.config.seed) return;
      submittedRef.current = true;
      setSubmitting(true);
      setSubmitError("");
      const res = await clientApi<{
        fight: GameFight;
        verified: boolean;
        disputeReason?: string;
        detail?: string | null;
      }>(`/api/game-fights/${fightId}/result`, {
        method: "POST",
        body: JSON.stringify({
          winner: payload.winner ?? null,
          method: payload.method,
          score: payload.score,
          koTimeSec: payload.koTimeSec ?? null,
          stats: payload.stats,
          keyMoments: payload.keyMoments ?? null,
          posterDataUrl: payload.posterDataUrl ?? null,
          seed: payload.seed,
        }),
      });
      setSubmitting(false);
      if (!res.ok) {
        // 409 (sudah completed) = hasil sudah tercatat — muat ulang saja.
        if (res.error.status === 409) {
          await load();
          return;
        }
        submittedRef.current = false;
        setSubmitError(res.error.message);
        return;
      }
      if (!res.data.verified) {
        setDispute(
          `Hasil dari arena tidak cocok dengan verifikasi server (${res.data.disputeReason ?? "mismatch"}) — fight ditandai disputed, ranking tidak berubah.`,
        );
      }
      await load();
    };

    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== ARENA_ORIGIN) return;
      const d = ev.data as Record<string, unknown> | null;
      if (!d || typeof d !== "object") return;
      if (d.type === "sfa-ready") {
        iframe.contentWindow?.postMessage(
          {
            type: "sfa-config",
            fightId: detail.config.fightId,
            fighters: detail.config.fighters,
            seed: detail.config.seed,
            map: detail.config.map,
            duration: detail.config.duration,
            // Mode ekspor video: Arena merekam otomatis saat Tarung diklik.
            autoRecord: exportMode,
          },
          ARENA_ORIGIN,
        );
      } else if (d.type === "sfa-result") {
        // Mode ekspor video = replay fight yang sudah completed: hasilnya
        // TIDAK dikirim ulang (canSubmit sudah false untuk completed).
        if (exportMode) return;
        // Hanya peserta yang boleh mengirim hasil ke server.
        if (!detail.canSubmit) return;
        void postResult(d);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [phase, detail, fightId, load, submitting, exportMode]);

  if (phase === "loading") {
    return (
      <div
        className="mx-auto w-full max-w-3xl space-y-5"
        role="status"
        aria-label="Memuat…"
      >
        <div className="glass h-10 animate-pulse" />
        <div className="glass h-28 animate-pulse" />
        <div className="glass mx-auto aspect-[9/16] w-full max-w-[420px] animate-pulse" />
      </div>
    );
  }

  if (phase === "error" || !detail) {
    return (
      <EmptyState
        title="Fight Tidak Ditemukan"
        description={loadError || "Fight ini tidak ada atau sudah dihapus."}
        action={<ButtonLink href="/tantangan">Ke Daftar Tantangan</ButtonLink>}
      />
    );
  }

  const { fight, fighterA, fighterB } = detail;
  const done = fight.status === "completed";
  const disputed = fight.status === "disputed";
  const poster = fight.posterDataUrl ?? null;

  const share = async () => {
    const url = `${window.location.origin}/game/${fightId}`;
    const text = `Tonton fight ${nameOf(fighterA, "?")} vs ${nameOf(fighterB, "?")} di Street Fight Hub!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Street Fight Hub", text, url });
        setShareMsg("Tautan dibagikan.");
        return;
      }
      throw new Error("no-share");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareMsg("Tautan disalin ke clipboard.");
      } catch {
        setShareMsg(`Salin tautan ini: ${url}`);
      }
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
      {/* Header ringkas — tanpa H1 nama raksasa dan tanpa seed di sini,
          supaya kartu petarung + arena langsung terlihat di layar HP. */}
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={fight.isTitleFight ? "amber" : "neutral"}>
            {fight.isTitleFight ? "Perebutan Gelar" : "Game Biasa"}
          </Badge>
          <Badge tone={done ? "green" : disputed ? "red" : "cyan"}>
            {done ? "Selesai" : disputed ? "Disputed" : "Belum Dimainkan"}
          </Badge>
          {detail.fightsRemaining !== null ? (
            <Badge tone="outline">
              Sisa tarung hari ini: {detail.fightsRemaining}/5
            </Badge>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-paper-mute">
          {MAP_LABELS[fight.map ?? "ring"] ?? fight.map} • 60 detik
        </p>
      </header>

      {/* Layar juri — hero hasil besar, hanya bila fight selesai. */}
      {done ? (
        <VerdictHero fight={fight} fighterA={fighterA} fighterB={fighterB} />
      ) : null}

      {/* Aksi utama hasil: unduh poster, bagikan, tantang lagi. */}
      {done ? (
        <div className="grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
          {poster ? (
            <a
              href={poster}
              download={`street-fight-${fightId}-poster.jpg`}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber-brand px-5 py-3 text-sm font-bold text-on-amber transition-transform hover:scale-[1.02] sm:w-auto"
            >
              Unduh Poster
            </a>
          ) : null}
          <Button
            variant="ghost"
            onClick={share}
            className="w-full sm:w-auto"
          >
            Bagikan
          </Button>
          <ButtonLink
            href="/tantangan"
            variant="glass"
            className="w-full sm:w-auto"
          >
            Tantang Lagi
          </ButtonLink>
        </div>
      ) : null}
      {done && shareMsg ? (
        <p role="status" className="text-center text-sm text-paper-dim">
          {shareMsg}
        </p>
      ) : null}

      {/* Kartu duel: nama di atas, dua kolom di semua lebar. */}
      <FighterDuelCard fighterA={fighterA} fighterB={fighterB} />

      {/* Peluang hasil pra-fight (breakdown lotere + 50:50). */}
      {!done ? (
        <OutcomeBreakdown fighterA={fighterA} fighterB={fighterB} />
      ) : null}

      {/* Statistik pertarungan (hanya bila selesai). */}
      {done ? (
        <section aria-label="Statistik pertarungan">
          <h2 className="mb-3 font-display text-2xl uppercase tracking-wide">
            Statistik <span className="text-amber-brand">Pertarungan</span>
          </h2>
          <GlassCard>
            <Breakdown
              fight={fight}
              fighterA={fighterA}
              fighterB={fighterB}
            />
          </GlassCard>
        </section>
      ) : null}

      {/* Arena iframe — rasio 9:16 PERSIS (aspect, bukan tinggi tetap) supaya
          layout HUD di dalam arena tampil sesuai desainnya di semua lebar:
          tinggi tetap lama (640px / 720px di sm+) membuat arena terpotong /
          terdistorsi di lebar ≥640px. Seed TIDAK ditampilkan di sekitar
          arena — hanya di catatan kaki hasil di bawah — supaya tidak ada
          teks Hub yang menutupi HUD arena. */}
      <section aria-label="Arena pertarungan" id="arena" className="scroll-mt-20">
        {exportMode ? (
          <div
            className="mb-3 rounded-xl border border-amber-brand/50 bg-amber-brand/10 px-4 py-3 text-center"
            role="status"
          >
            <p className="text-sm font-bold text-amber-brand">
              Mode ekspor video — Merekam otomatis
            </p>
            <p className="mt-1 text-xs leading-relaxed text-paper-dim">
              Tekan tombol Tarung di arena — rekaman mulai otomatis dan video
              webm terunduh sendiri saat fight selesai (~60 detik). Jangan
              tutup halaman ini selama merekam.
            </p>
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-[420px]">
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-ink-900 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <iframe
              ref={iframeRef}
              src={ARENA_URL}
              title={`Arena: ${nameOf(fighterA, "Kiri")} vs ${nameOf(fighterB, "Kanan")}`}
              width={720}
              height={1280}
              className="block aspect-[9/16] w-full"
              allow="autoplay"
              sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
            />
          </div>
          <p className="mt-2 text-center text-xs leading-relaxed text-paper-mute">
            Tekan tombol <strong className="text-paper">Tarung</strong> di
            dalam arena untuk memulai (suara komentator butuh klik di dalam
            arena).
            {detail.canSubmit
              ? ""
              : " Kamu menonton sebagai penonton — hasil dikirim oleh peserta fight."}
          </p>
        </div>
      </section>

      {/* Status pengiriman hasil */}
      {submitting ? (
        <p
          role="status"
          className="text-center text-sm font-semibold text-amber-brand"
        >
          Mengirim hasil ke server untuk verifikasi…
        </p>
      ) : null}
      {submitError ? (
        <p
          role="alert"
          className="text-center text-sm font-semibold text-red-400"
        >
          Gagal mengirim hasil: {submitError}
        </p>
      ) : null}
      {dispute || disputed ? (
        <GlassCard className="border-red-brand/50 text-center">
          <p className="font-semibold text-red-400">
            {dispute ||
              "Hasil fight ini tidak cocok dengan verifikasi server dan ditandai disputed — ranking tidak berubah."}
          </p>
        </GlassCard>
      ) : null}

      {/* Poster hasil */}
      {done && poster ? (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt={`Poster hasil ${nameOf(fighterA, "Kiri")} vs ${nameOf(fighterB, "Kanan")}`}
            className="mx-auto w-full max-w-[420px] rounded-2xl border border-white/15"
          />
          <figcaption className="mt-2 text-center text-xs text-paper-mute">
            Poster resmi hasil fight
          </figcaption>
        </figure>
      ) : null}

      {/* Catatan kaki hasil — seed hanya disebut di sini, kecil, di bawah
          semua konten, bukan di atas arena. */}
      {done && fight.completedAt ? (
        <p className="text-center text-xs text-paper-mute">
          Selesai {formatWIB(fight.completedAt)} • Hasil terverifikasi dari
          seed {fight.seed}
        </p>
      ) : null}

      {/* Obrolan Global TIDAK lagi tertanam di sini — pindah ke tombol chat
          mengambang (FloatingChat di layout root) supaya tidak memanjangkan
          halaman game dan tidak overflow di HP. */}

      <p className="pb-2 text-center text-sm text-paper-mute">
        <Link
          href="/tantangan"
          className="font-semibold text-amber-brand hover:underline"
        >
          ← Kembali ke Tantangan
        </Link>
      </p>
    </div>
  );
}
