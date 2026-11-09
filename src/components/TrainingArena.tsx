"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAP_LABELS,
  METHOD_LABELS,
  STYLE_LABELS,
  TEMPO_LABELS,
  TEMPO_OPTIONS,
  moveLabel,
  styleColor,
} from "@/components/api";
import ArenaPicker from "@/components/ArenaPicker";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import GlassCard from "@/components/GlassCard";
import StatChip from "@/components/StatChip";
import {
  buildTrainingConfig,
  isValidTrainingMap,
  isValidTrainingStyle,
  isValidTrainingTempo,
  resolveTrainingSeed,
  TRAINING_STYLES,
  type Tempo,
  type TrainingSfaConfig,
} from "@/lib/game/training-config";

// Arena disajikan SAME-ORIGIN oleh Hub sendiri (public/arena/) —
// pola embed yang sama persis dengan GameArena (EMBED-CONTRACT).
const ARENA_URL = "/arena/index.html";
const ARENA_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";

type Phase = "setup" | "fighting" | "result";

/** Payload sfa-result dari iframe (EMBED-CONTRACT §8) — tampil saja. */
type SfaResult = {
  fightId?: unknown;
  winner?: "R" | "B" | null;
  method?: "KO" | "decision" | "draw";
  score?: { a: number; b: number };
  koTimeSec?: number | null;
  stats?: {
    accuracyA?: number;
    accuracyB?: number;
    damageDealtA?: number;
    damageDealtB?: number;
    strikesLandedA?: number;
    strikesLandedB?: number;
    strikesThrownA?: number;
    strikesThrownB?: number;
    knockdowns?: number;
  };
  keyMoments?: {
    biggestHit?: {
      by: "L" | "R";
      move: string;
      damage?: number;
      timeSec?: number;
    } | null;
    finisher?: {
      by: "L" | "R";
      move: string;
      timeSec?: number;
    } | null;
    leadChange?: { by: "L" | "R"; timeSec?: number } | null;
    knockdowns?: { by: "L" | "R"; timeSec?: number }[];
  };
  posterDataUrl?: string | null;
};

type Side = "left" | "right";

const SIDE_META: Record<
  Side,
  {
    title: string;
    name: string;
    dot: string;
    selectedChip: string;
    selectedTempo: string;
  }
> = {
  left: {
    title: "Petarung Kiri",
    name: "Merah",
    dot: "bg-red-brand",
    selectedChip: "border-red-brand bg-red-brand/15 text-paper",
    selectedTempo: "bg-red-brand font-bold text-white",
  },
  right: {
    title: "Petarung Kanan",
    name: "Biru",
    dot: "bg-cyan-accent",
    selectedChip: "border-cyan-accent bg-cyan-accent/15 text-paper",
    selectedTempo: "bg-cyan-accent font-bold text-ink-950",
  },
};

/**
 * Kartu setup satu sisi: pilih gaya (chip + dot warna gaya) dan tempo
 * (segmented 3 tombol). Gaya yang sama di kedua sisi dibolehkan
 * (mirror match) — tidak ada validasi yang melarangnya.
 */
function SideSetupCard({
  side,
  style,
  tempo,
  onStyle,
  onTempo,
}: {
  side: Side;
  style: string;
  tempo: Tempo;
  onStyle: (style: string) => void;
  onTempo: (tempo: Tempo) => void;
}) {
  const meta = SIDE_META[side];
  return (
    <GlassCard className="animate-fade-up">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 rounded-full ${meta.dot} ring-2 ring-white/30`}
        />
        <h2 className="font-display text-2xl uppercase leading-none tracking-wide">
          {meta.title} <span className="text-paper-mute">— {meta.name}</span>
        </h2>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-paper-dim">
          Bela diri
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {TRAINING_STYLES.map((s) => {
            const selected = style === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={selected}
                onClick={() => onStyle(s)}
                className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-2 py-2 text-left text-xs font-semibold transition-colors duration-150 sm:text-sm ${
                  selected
                    ? meta.selectedChip
                    : "border-white/10 bg-white/[0.03] text-paper-dim hover:border-white/25"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: styleColor(s) }}
                />
                <span className="min-w-0 leading-tight">
                  {STYLE_LABELS[s] ?? s}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-paper-dim">Tempo</legend>
        <div
          className="mt-2 grid grid-cols-3 gap-2"
          role="group"
          aria-label={`Tempo ${meta.name}`}
        >
          {TEMPO_OPTIONS.map((t) => {
            const selected = tempo === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onTempo(t.value as Tempo)}
                className={`min-h-[44px] rounded-xl px-2 py-2 text-sm font-semibold transition-colors duration-150 ${
                  selected
                    ? meta.selectedTempo
                    : "bg-white/[0.03] text-paper-dim hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-3 text-sm text-paper-dim">
        <span
          aria-hidden="true"
          className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
          style={{ backgroundColor: styleColor(style) }}
        />
        {STYLE_LABELS[style] ?? style} • Tempo{" "}
        {TEMPO_LABELS[tempo] ?? tempo}
      </p>
    </GlassCard>
  );
}

export default function TrainingArena() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [leftStyle, setLeftStyle] = useState("muay-thai");
  const [rightStyle, setRightStyle] = useState("taekwondo");
  const [leftTempo, setLeftTempo] = useState<Tempo>("seimbang");
  const [rightTempo, setRightTempo] = useState<Tempo>("seimbang");
  const [map, setMap] = useState("ring");
  const [seedInput, setSeedInput] = useState("");
  const [fightKey, setFightKey] = useState(0);
  const [activeConfig, setActiveConfig] = useState<TrainingSfaConfig | null>(
    null,
  );
  const [activeSeed, setActiveSeed] = useState<number | null>(null);
  const [result, setResult] = useState<SfaResult | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /** Mulai fight dari setting saat ini (seedOverride "" = seed baru acak). */
  const startFight = (seedOverride?: string) => {
    const input = seedOverride ?? seedInput;
    const seed = resolveTrainingSeed(input);
    const setup = {
      left: {
        style: isValidTrainingStyle(leftStyle) ? leftStyle : "muay-thai",
        tempo: isValidTrainingTempo(leftTempo) ? leftTempo : "seimbang",
      },
      right: {
        style: isValidTrainingStyle(rightStyle) ? rightStyle : "taekwondo",
        tempo: isValidTrainingTempo(rightTempo) ? rightTempo : "seimbang",
      },
      map: isValidTrainingMap(map) ? map : "ring",
      seedInput: input,
    };
    setActiveConfig(buildTrainingConfig(setup, seed));
    setActiveSeed(seed);
    setResult(null);
    // Remount iframe → sfa-ready baru → config baru terkirim.
    setFightKey((k) => k + 1);
    setPhase("fighting");
  };

  const randomSeed = () => {
    setSeedInput(String(Math.floor(Math.random() * 0x100000000)));
  };

  const backToSetup = () => {
    setActiveConfig(null);
    setActiveSeed(null);
    setResult(null);
    setPhase("setup");
  };

  // Bridge postMessage dengan iframe arena (EMBED-CONTRACT).
  // Hasil TIDAK PERNAH dikirim ke API mana pun — hanya tampil lokal.
  useEffect(() => {
    if (phase === "setup" || !activeConfig) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== ARENA_ORIGIN) return;
      const d = ev.data as Record<string, unknown> | null;
      if (!d || typeof d !== "object") return;
      if (d.type === "sfa-ready") {
        iframe.contentWindow?.postMessage(activeConfig, ARENA_ORIGIN);
      } else if (d.type === "sfa-result") {
        // Hanya hasil fight yang sedang berjalan (abaikan fight lama).
        if (d.fightId !== activeConfig.fightId) return;
        setResult(d as unknown as SfaResult);
        setPhase("result");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [phase, activeConfig]);

  const winnerName =
    result?.winner === "R"
      ? "Merah"
      : result?.winner === "B"
        ? "Biru"
        : null;
  const winnerStyle =
    result?.winner === "R"
      ? STYLE_LABELS[leftStyle]
      : result?.winner === "B"
        ? STYLE_LABELS[rightStyle]
        : null;
  const isDraw = !result?.winner || result?.method === "draw";
  const score = result?.score ?? null;
  const stats = result?.stats ?? null;
  const totalDamage =
    (stats?.damageDealtA ?? 0) + (stats?.damageDealtB ?? 0);
  const pctA =
    totalDamage > 0
      ? Math.round(((stats?.damageDealtA ?? 0) / totalDamage) * 100)
      : 50;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-4xl uppercase leading-none tracking-wide sm:text-5xl">
          Testing <span className="text-amber-brand">Training</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-paper-dim sm:text-base">
          Coba tarung 1v1: pilih bela diri di kedua sisi, atur tempo, arena,
          dan seed — tanpa akun kedua, tanpa tantangan.
        </p>
        <div
          className="mt-4 rounded-xl border border-amber-brand/50 bg-amber-brand/10 px-4 py-3"
          role="note"
        >
          <p className="text-sm font-bold text-amber-brand">
            Training / Testing — hasil tidak dicatat, tidak masuk klasemen
          </p>
          <p className="mt-1 text-xs leading-relaxed text-paper-dim">
            Tanpa login, tanpa jatah tarung, tanpa rekor, tanpa gelar. Murni
            buat ngetes tarung. Seed yang sama + setting yang sama = fight
            yang sama persis.
          </p>
        </div>
      </header>

      {phase === "setup" ? (
        <>
          <div className="space-y-5">
            <SideSetupCard
              side="left"
              style={leftStyle}
              tempo={leftTempo}
              onStyle={setLeftStyle}
              onTempo={setLeftTempo}
            />
            <p
              aria-hidden="true"
              className="text-center font-display text-3xl text-amber-brand"
            >
              VS
            </p>
            <SideSetupCard
              side="right"
              style={rightStyle}
              tempo={rightTempo}
              onStyle={setRightStyle}
              onTempo={setRightTempo}
            />
          </div>

          <GlassCard>
            <h2
              id="arena-label"
              className="font-display text-2xl uppercase tracking-wide"
            >
              Arena
            </h2>
            <div className="mt-3">
              <ArenaPicker
                value={map}
                onChange={setMap}
                name="training-map"
                labelledBy="arena-label"
              />
            </div>
          </GlassCard>

          <GlassCard>
            <label
              htmlFor="training-seed"
              className="font-display text-2xl uppercase tracking-wide"
            >
              Seed
            </label>
            <p className="mt-1 text-sm text-paper-dim">
              Kosong = seed acak. Isi angka atau teks apa pun — seed yang sama
              mengulang fight yang sama.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                id="training-seed"
                type="text"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="Contoh: 12345 (kosong = acak)"
                autoComplete="off"
                className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-base text-paper placeholder:text-paper-mute focus:border-amber-brand focus:outline-none"
              />
              <Button variant="ghost" onClick={randomSeed}>
                Acak
              </Button>
            </div>
          </GlassCard>

          <Button
            size="lg"
            className="w-full"
            onClick={() => startFight()}
          >
            Mulai Tarung
          </Button>
          <p className="text-center text-xs text-paper-mute">
            60 detik • Klik tombol Tarung di dalam arena untuk memulai
          </p>
        </>
      ) : null}

      {phase !== "setup" && activeConfig ? (
        <>
          {/* Ringkasan setting fight yang sedang berjalan. */}
          <GlassCard className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="amber">Training</Badge>
              <Badge tone="outline">
                {MAP_LABELS[map] ?? map} • 60 detik
              </Badge>
              {activeSeed !== null ? (
                <Badge tone="cyan">Seed: {activeSeed}</Badge>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-1 text-center">
              <div className="min-w-0">
                <p className="truncate font-display text-xl uppercase leading-tight tracking-wide text-red-400 sm:text-2xl">
                  Merah
                </p>
                <p className="mt-0.5 truncate text-xs text-paper-dim">
                  {STYLE_LABELS[leftStyle] ?? leftStyle} •{" "}
                  {TEMPO_LABELS[leftTempo] ?? leftTempo}
                </p>
              </div>
              <span className="shrink-0 px-1 font-display text-2xl text-amber-brand">
                VS
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-xl uppercase leading-tight tracking-wide text-cyan-300 sm:text-2xl">
                  Biru
                </p>
                <p className="mt-0.5 truncate text-xs text-paper-dim">
                  {STYLE_LABELS[rightStyle] ?? rightStyle} •{" "}
                  {TEMPO_LABELS[rightTempo] ?? rightTempo}
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Hasil — hanya tampil lokal, tidak dikirim ke mana pun. */}
          {phase === "result" && result ? (
            <section aria-label="Hasil training" className="animate-pop-in">
              <GlassCard strong className="overflow-hidden text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Badge tone={isDraw ? "cyan" : "amber"}>
                    {METHOD_LABELS[result.method ?? "draw"] ?? "Seri"}
                  </Badge>
                  {activeSeed !== null ? (
                    <Badge tone="outline">Seed: {activeSeed}</Badge>
                  ) : null}
                </div>
                <h2 className="mt-4 font-display text-5xl uppercase leading-none tracking-wide sm:text-6xl">
                  {isDraw ? (
                    <span className="text-cyan-accent">Seri</span>
                  ) : (
                    <>
                      <span className="text-amber-brand">{winnerName}</span>{" "}
                      <span className="text-paper">Menang</span>
                    </>
                  )}
                </h2>
                {winnerName && winnerStyle ? (
                  <p className="mt-2 text-sm font-semibold text-paper-dim">
                    {winnerName} ({winnerStyle})
                    {result.method === "KO" && result.koTimeSec != null
                      ? ` — KO di detik ${result.koTimeSec}`
                      : ""}
                  </p>
                ) : null}
                {score ? (
                  <div
                    className="mt-6 flex items-start justify-center gap-4 sm:gap-6"
                    role="img"
                    aria-label={`Skor akhir ${score.a} lawan ${score.b}`}
                  >
                    <div className="min-w-0">
                      <p
                        className={`font-display text-6xl leading-none sm:text-7xl ${
                          result.winner === "R"
                            ? "text-amber-brand"
                            : "text-paper"
                        }`}
                      >
                        {score.a}
                      </p>
                      <p className="mx-auto mt-2 max-w-[150px] truncate text-xs font-semibold uppercase tracking-wide text-paper-dim">
                        Merah
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="flex h-[60px] items-center sm:h-[72px]"
                    >
                      <span className="block h-[7px] w-[27px] rounded-full bg-amber-brand sm:h-[9px] sm:w-[32px]" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`font-display text-6xl leading-none sm:text-7xl ${
                          result.winner === "B"
                            ? "text-amber-brand"
                            : "text-paper"
                        }`}
                      >
                        {score.b}
                      </p>
                      <p className="mx-auto mt-2 max-w-[150px] truncate text-xs font-semibold uppercase tracking-wide text-paper-dim">
                        Biru
                      </p>
                    </div>
                  </div>
                ) : null}
                {stats ? (
                  <div className="mt-6 text-left">
                    <div className="mb-1 flex justify-between gap-2 text-xs font-semibold text-paper-dim">
                      <span className="min-w-0 truncate">
                        Merah — damage {stats.damageDealtA ?? 0}
                      </span>
                      <span className="min-w-0 truncate text-right">
                        Biru — damage {stats.damageDealtB ?? 0}
                      </span>
                    </div>
                    <div
                      className="flex h-3 overflow-hidden rounded-full bg-white/10"
                      role="img"
                      aria-label={`Damage ${pctA}% vs ${100 - pctA}%`}
                    >
                      <div
                        className="bg-red-brand"
                        style={{ width: `${pctA}%` }}
                      />
                      <div
                        className="bg-cyan-accent"
                        style={{ width: `${100 - pctA}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <StatChip
                        label="Akurasi Merah"
                        value={`${Math.round((stats.accuracyA ?? 0) * 100)}%`}
                        tone="red"
                      />
                      <StatChip
                        label="Akurasi Biru"
                        value={`${Math.round((stats.accuracyB ?? 0) * 100)}%`}
                        tone="cyan"
                      />
                      <StatChip
                        label="Pukulan mendarat"
                        value={`${stats.strikesLandedA ?? 0} : ${stats.strikesLandedB ?? 0}`}
                        tone="paper"
                      />
                      <StatChip
                        label="Knockdown"
                        value={stats.knockdowns ?? 0}
                        tone="amber"
                      />
                    </div>
                    {result.keyMoments?.biggestHit ? (
                      <p className="mt-3 text-center text-sm text-paper-dim">
                        Pukulan terbesar:{" "}
                        <span className="font-semibold text-paper">
                          {moveLabel(result.keyMoments.biggestHit.move)} (
                          {result.keyMoments.biggestHit.damage ?? "?"} dmg)
                        </span>{" "}
                        —{" "}
                        {result.keyMoments.biggestHit.by === "L"
                          ? "Merah"
                          : "Biru"}
                        , detik {result.keyMoments.biggestHit.timeSec}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {result.posterDataUrl ? (
                  <figure className="mt-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.posterDataUrl}
                      alt="Poster hasil training Merah vs Biru"
                      className="mx-auto w-full max-w-[420px] rounded-2xl border border-white/15"
                    />
                    <figcaption className="mt-2 text-center text-xs text-paper-mute">
                      Poster hasil (lokal — tidak tersimpan di server)
                    </figcaption>
                  </figure>
                ) : null}
                <p className="mt-4 text-xs text-paper-mute">
                  Hasil ini hanya di layar ini — tidak dicatat, tidak masuk
                  klasemen.
                </p>
              </GlassCard>
            </section>
          ) : null}

          {/* Arena iframe — pola yang sama dengan GameArena. */}
          <section
            aria-label="Arena pertarungan"
            id="arena"
            className="scroll-mt-20"
          >
            <div className="mx-auto w-full max-w-[420px]">
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-ink-900 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                <iframe
                  key={fightKey}
                  ref={iframeRef}
                  src={ARENA_URL}
                  title="Arena training: Merah vs Biru"
                  width={720}
                  height={1280}
                  className="block aspect-[9/16] w-full"
                  allow="autoplay"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
                />
              </div>
              <p className="mt-2 text-center text-xs leading-relaxed text-paper-mute">
                Tekan tombol{" "}
                <strong className="text-paper">Tarung</strong> di dalam arena
                untuk memulai (suara komentator butuh klik di dalam arena).
              </p>
            </div>
          </section>

          {/* Aksi pasca-fight / batalkan. */}
          <div className="grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
            {phase === "result" ? (
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => startFight("")}
              >
                Tarung Lagi
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto"
              onClick={backToSetup}
            >
              Ubah Setting
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
