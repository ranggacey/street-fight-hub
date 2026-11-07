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
import GlobalChat from "@/components/GlobalChat";

const ARENA_URL =
  process.env.NEXT_PUBLIC_ARENA_URL ??
  "https://stickman-fight-arena-zeta.vercel.app";
const ARENA_ORIGIN = (() => {
  try {
    return new URL(ARENA_URL).origin;
  } catch {
    return "https://stickman-fight-arena-zeta.vercel.app";
  }
})();

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

type Phase = "loading" | "ready" | "error";

function nameOf(f: Fighter | undefined, fallback: string): string {
  return f?.displayName ?? fallback;
}

function Breakdown({ fight, fighterA, fighterB }: {
  fight: GameFight;
  fighterA: Fighter;
  fighterB: Fighter;
}) {
  const r = fight.result;
  if (!r) return null;
  const winnerName =
    r.winnerSide === "R"
      ? nameOf(fighterA, "Kiri")
      : r.winnerSide === "B"
        ? nameOf(fighterB, "Kanan")
        : null;
  const s = fight.stats;
  const km = fight.keyMoments;
  const totalDamage = (s?.damageDealtA ?? 0) + (s?.damageDealtB ?? 0);
  const pctA = totalDamage > 0 ? Math.round(((s?.damageDealtA ?? 0) / totalDamage) * 100) : 50;
  const hitName = (by: "L" | "R"): string =>
    by === "L" ? nameOf(fighterA, "Kiri") : nameOf(fighterB, "Kanan");
  const narrative =
    winnerName && r.method === "KO"
      ? `${winnerName} menang KO atas ${r.winnerSide === "R" ? nameOf(fighterB, "Kanan") : nameOf(fighterA, "Kiri")}${r.koTimeSec ? ` di detik ${r.koTimeSec}` : ""}.`
      : winnerName && r.score
        ? `${winnerName} menang angka ${r.score.a}–${r.score.b}.`
        : "Fight berakhir seri.";

  return (
    <div className="space-y-4">
      <p className="text-base leading-relaxed text-paper">{narrative}</p>
      {s ? (
        <>
          <div>
            <div className="mb-1 flex justify-between text-xs font-semibold text-paper-dim">
              <span>
                {nameOf(fighterA, "Kiri")} — damage {s.damageDealtA ?? 0}
              </span>
              <span>
                {nameOf(fighterB, "Kanan")} — damage {s.damageDealtB ?? 0}
              </span>
            </div>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-white/10"
              role="img"
              aria-label={`Damage ${pctA}% vs ${100 - pctA}%`}
            >
              <div className="bg-amber-brand" style={{ width: `${pctA}%` }} />
              <div className="bg-red-brand" style={{ width: `${100 - pctA}%` }} />
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
            <StatChip label="Knockdown" value={s.knockdowns ?? 0} tone="cyan" />
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
                  {moveLabel(km.biggestHit.move)} ({km.biggestHit.damage ?? "?"} dmg)
                  {" — "}
                  {hitName(km.biggestHit.by)}, detik {km.biggestHit.timeSec}
                </dd>
              </div>
            ) : null}
            {km?.finisher ? (
              <div className="flex justify-between gap-2">
                <dt>Finisher</dt>
                <dd className="text-right font-semibold text-paper">
                  {moveLabel(km.finisher.move)} — {hitName(km.finisher.by)}, detik{" "}
                  {km.finisher.timeSec}
                </dd>
              </div>
            ) : null}
            {km?.leadChange ? (
              <div className="flex justify-between gap-2">
                <dt>Momen balik</dt>
                <dd className="text-right font-semibold text-paper">
                  Detik {km.leadChange.timeSec} — {hitName(km.leadChange.by)} merebut
                  keunggulan
                </dd>
              </div>
            ) : null}
            {km?.knockdowns && km.knockdowns.length > 0 ? (
              <div className="flex justify-between gap-2">
                <dt>Knockdown</dt>
                <dd className="text-right font-semibold text-paper">
                  {km.knockdowns.map((k) => `${hitName(k.by)} (${k.timeSec}d)`).join(", ")}
                </dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}
    </div>
  );
}

export default function GameArena({ fightId }: { fightId: string }) {
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
    if (res.data.fight.status === "completed" || res.data.fight.status === "disputed") {
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
          },
          ARENA_ORIGIN,
        );
      } else if (d.type === "sfa-result") {
        // Hanya peserta yang boleh mengirim hasil ke server.
        if (!detail.canSubmit) return;
        void postResult(d);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [phase, detail, fightId, load, submitting]);

  if (phase === "loading") {
    return (
      <div className="space-y-4" role="status" aria-label="Memuat…">
        <div className="glass h-24 animate-pulse" />
        <div className="glass mx-auto h-[640px] max-w-[420px] animate-pulse" />
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
    <div className="space-y-8">
      {/* Header duel */}
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={fight.isTitleFight ? "amber" : "neutral"}>
            {fight.isTitleFight ? "Perebutan Gelar" : "Game Biasa"}
          </Badge>
          <Badge tone={done ? "green" : disputed ? "red" : "cyan"}>
            {done ? "Selesai" : disputed ? "Disputed" : "Belum Dimainkan"}
          </Badge>
          <span className="text-sm text-paper-mute">
            {MAP_LABELS[fight.map ?? "ring"] ?? fight.map} • 60 detik • Seed{" "}
            {fight.seed}
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl uppercase leading-tight tracking-wide sm:text-6xl">
          {nameOf(fighterA, "?")}{" "}
          <span className="text-amber-brand">VS</span> {nameOf(fighterB, "?")}
        </h1>
        <p className="mt-2 text-sm text-paper-dim">
          {styleLabel(fighterA.style, fighterA.styleOther)} vs{" "}
          {styleLabel(fighterB.style, fighterB.styleOther)}
          {detail.fightsRemaining !== null
            ? ` • Sisa tarung hari ini: ${detail.fightsRemaining}/3`
            : ""}
        </p>
      </header>

      {/* Win% pra-fight */}
      {!done ? (
        <section aria-label="Peluang menang" className="grid gap-3 sm:grid-cols-2">
          {[
            { f: fighterA, pct: detail.winPercentA },
            { f: fighterB, pct: detail.winPercentB },
          ].map(({ f, pct }) => (
            <GlassCard key={f.id ?? f.displayName} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-display text-xl uppercase tracking-wide">
                  {f.displayName}
                </p>
                <p className="font-display text-2xl text-amber-brand">{pct}%</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-amber-brand" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-paper-dim">
                Rating {f.rating ?? 1000} • Rekor kasual{" "}
                {f.casualRecord?.wins ?? 0}M–{f.casualRecord?.losses ?? 0}K
                {f.signatureMove ? ` • Jurus: ${moveLabel(f.signatureMove)}` : ""}
                {f.tempo ? ` • Tempo: ${f.tempo}` : ""}
              </p>
            </GlassCard>
          ))}
        </section>
      ) : null}

      {/* Arena iframe */}
      <section aria-label="Arena pertarungan">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-ink-900 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <iframe
              ref={iframeRef}
              src={ARENA_URL}
              title={`Arena: ${nameOf(fighterA, "Kiri")} vs ${nameOf(fighterB, "Kanan")}`}
              width={720}
              height={1280}
              className="block h-[640px] w-full sm:h-[720px]"
              allow="autoplay"
              sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
            />
          </div>
          <p className="mt-2 text-center text-xs text-paper-mute">
            Tekan tombol <strong className="text-paper">Tarung</strong> di dalam
            arena untuk memulai (suara komentator butuh klik di dalam arena).
            {detail.canSubmit
              ? ""
              : " Kamu menonton sebagai penonton — hasil dikirim oleh peserta fight."}
          </p>
        </div>
      </section>

      {/* Status pengiriman hasil */}
      {submitting ? (
        <p role="status" className="text-center text-sm font-semibold text-amber-brand">
          Mengirim hasil ke server untuk verifikasi…
        </p>
      ) : null}
      {submitError ? (
        <p role="alert" className="text-center text-sm font-semibold text-red-400">
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

      {/* Hasil + breakdown */}
      {done ? (
        <section aria-labelledby="hasil-heading">
          <h2
            id="hasil-heading"
            className="mb-4 font-display text-3xl uppercase tracking-wide"
          >
            Hasil <span className="text-amber-brand">Pertarungan</span>
          </h2>
          <GlassCard strong>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-2xl uppercase tracking-wide">
                {fight.result?.score
                  ? `${fight.result.score.a} – ${fight.result.score.b}`
                  : "—"}
              </p>
              <div className="flex gap-2">
                <Badge tone="amber">{fight.result?.method ?? "—"}</Badge>
                {fight.isTitleFight ? <Badge tone="red">Title Fight</Badge> : null}
              </div>
            </div>
            <Breakdown fight={fight} fighterA={fighterA} fighterB={fighterB} />
            <div className="mt-5 flex flex-wrap gap-3">
              {poster ? (
                <a
                  href={poster}
                  download={`street-fight-${fightId}-poster.jpg`}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-brand px-5 py-2.5 text-sm font-bold text-on-amber transition-transform hover:scale-[1.02]"
                >
                  Unduh Poster
                </a>
              ) : null}
              <Button variant="ghost" onClick={share}>
                Bagikan
              </Button>
              <ButtonLink href="/tantangan" variant="glass">
                Tantang Lagi
              </ButtonLink>
            </div>
            {shareMsg ? (
              <p role="status" className="mt-3 text-sm text-paper-dim">
                {shareMsg}
              </p>
            ) : null}
            {poster ? (
              <div className="mt-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={poster}
                  alt={`Poster hasil ${nameOf(fighterA, "Kiri")} vs ${nameOf(fighterB, "Kanan")}`}
                  className="mx-auto w-full max-w-[420px] rounded-2xl border border-white/15"
                />
              </div>
            ) : null}
            {fight.completedAt ? (
              <p className="mt-4 text-center text-xs text-paper-mute">
                Selesai {formatWIB(fight.completedAt)} • Hasil terverifikasi dari
                seed {fight.seed}
              </p>
            ) : null}
          </GlassCard>
        </section>
      ) : null}

      {/* Chat global */}
      <section aria-label="Obrolan global">
        <GlobalChat />
      </section>

      <p className="text-center text-sm text-paper-mute">
        <Link href="/tantangan" className="font-semibold text-amber-brand hover:underline">
          ← Kembali ke Tantangan
        </Link>
      </p>
    </div>
  );
}
