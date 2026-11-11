import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dataOr, serverApiGet } from "@/components/server-api";
import {
  formatWIB,
  IG_URL,
  METHOD_LABELS,
  ROUND_LABELS,
  styleColor,
  styleLabel,
} from "@/components/api";
import type {
  Fighter,
  FighterDetail,
  FightHistoryItem,
  GameHistoryItem,
  TitleHistoryItem,
} from "@/components/types";
import { weightClassLabel } from "@/lib/game/weight-classes";
import { INJURY_STAT_LABELS } from "@/lib/game/progress";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import { ButtonLink } from "@/components/Button";
import StatChip from "@/components/StatChip";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

/** Backend mengembalikan { fighter, history, gameHistory, titleHistory }. */
type FighterDetailResponse = {
  fighter: Fighter;
  history: FightHistoryItem[];
  gameHistory?: GameHistoryItem[];
  titleHistory?: TitleHistoryItem[];
};

/** GET /api/fighters/[id]/progress — XP/level/koin/gear/achievement/cedera. */
type ProgressResponse = {
  progress: {
    level: number;
    xp: number;
    xpInLevel: number;
    xpForNextLevel: number;
    xpProgressPct: number;
    coins: number;
    gearOwned: string[];
    achievements: string[];
    injury: { stat: string; pct: number; fightsRemaining: number } | null;
    totalFights: number;
    currentWinStreak: number;
    activityStreakDays: number;
  };
  gear: { id: string; label: string; description: string; price: number }[];
  achievements: {
    id: string;
    label: string;
    description: string;
    icon: string;
    unlocked: boolean;
  }[];
};

function toDetail(raw: FighterDetailResponse | null): FighterDetail | null {
  if (!raw) return null;
  return {
    ...raw.fighter,
    history: raw.history,
    gameHistory: raw.gameHistory ?? [],
    titleHistory: raw.titleHistory ?? [],
  };
}

const TITLE_EVENT_LABELS: Record<string, string> = {
  race_10_win: "Menang Race 10 — jadi juara",
  race_7_win: "Menang Race 7 — jadi juara",
  takeover: "Merebut gelar juara",
  vacated_inactivity: "Kehilangan gelar (6 hari tidak bertarung)",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await serverApiGet<FighterDetailResponse>(
      `/api/fighters/${id}`,
    );
    const f = toDetail(dataOr(res, null));
    if (f) {
      return {
        title: f.displayName,
        description: `Profil fighter ${f.displayName} — ${styleLabel(f.style, f.styleOther)}, rekor ${f.record.wins} menang ${f.record.losses} kalah.`,
      };
    }
  } catch {
    // fallback
  }
  return {
    title: "Profil Fighter",
    description: "Profil publik fighter Street Fight Hub.",
  };
}

export default async function FighterProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await serverApiGet<FighterDetailResponse>(
    `/api/fighters/${id}`,
  );
  const f = toDetail(dataOr(res, null));
  if (!f) notFound();

  // Progres anti-monoton (gagal fetch = seksi tidak tampil, bukan crash).
  let progressRes: ProgressResponse | null = null;
  try {
    const pr = await serverApiGet<ProgressResponse>(`/api/fighters/${id}/progress`);
    progressRes = dataOr(pr, null);
  } catch {
    progressRes = null;
  }

  const record = f.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };
  const color = styleColor(f.style);
  const history = f.history ?? f.matches ?? [];
  const gameHistory = f.gameHistory ?? [];
  const titleHistory = f.titleHistory ?? [];

  // Badge turunan dari rekor + riwayat.
  const isUndefeated = record.wins > 0 && record.losses === 0;
  const isKoArtist = record.kos >= 3;
  const isChampion = history.some(
    (h) => h.round === "F" && h.result === "win",
  );

  return (
    <div className="space-y-8">
      {/* Header profil */}
      <header className="animate-fade-up">
        <div
          className="h-2 w-full rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl uppercase leading-tight tracking-wide sm:text-6xl">
              {f.displayName}
            </h1>
            <p className="mt-1 text-sm text-paper-mute">
              <a
                href={`https://www.instagram.com/${f.igUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-amber-brand hover:underline"
              >
                @{f.igUsername}
              </a>
              {" • "}
              {styleLabel(f.style, f.styleOther)}
              {f.weightKg ? ` • ${f.weightKg} kg (${weightClassLabel(f.weightKg)})` : " • Tanpa kelas"}
              {f.status === "retired" ? " • Pensiun" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isChampion ? <Badge tone="amber">Champion</Badge> : null}
            {isKoArtist ? <Badge tone="red">KO Artist</Badge> : null}
            {isUndefeated ? <Badge tone="cyan">Undefeated</Badge> : null}
          </div>
        </div>
      </header>

      {/* Rekor (SATU rekor untuk semua fight) */}
      <section aria-label="Rekor fighter">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip label="Menang" value={record.wins} tone="amber" />
          <StatChip label="Kalah" value={record.losses} tone="red" />
          <StatChip label="Seri" value={record.draws} tone="paper" />
          <StatChip label="KO" value={record.kos} tone="red" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip label="Rating" value={f.rating ?? 1000} tone="cyan" />
        </div>
      </section>

      {/* Progres: XP/level, koin, cedera, achievement, gear */}
      {progressRes ? (
        <section aria-labelledby="progres-heading">
          <h2
            id="progres-heading"
            className="mb-4 font-display text-3xl uppercase tracking-wide"
          >
            Progres <span className="text-amber-brand">Fighter</span>
          </h2>
          <GlassCard className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-2xl uppercase tracking-wide">
                Level {progressRes.progress.level}
                <span className="ml-2 text-sm normal-case tracking-normal text-paper-dim">
                  {progressRes.progress.xp} XP
                </span>
              </p>
              <p className="font-semibold text-amber-brand">
                🪙 {progressRes.progress.coins} koin
              </p>
            </div>
            <div
              className="h-3 w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={progressRes.progress.xpProgressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progres XP ke level berikutnya"
            >
              <div
                className="h-full rounded-full bg-amber-brand"
                style={{ width: `${progressRes.progress.xpProgressPct}%` }}
              />
            </div>
            <p className="text-sm text-paper-dim">
              {progressRes.progress.xpInLevel}/{progressRes.progress.xpForNextLevel} XP
              ke level {progressRes.progress.level + 1}
              {progressRes.progress.currentWinStreak > 0
                ? ` • 🔥 ${progressRes.progress.currentWinStreak}x menang beruntun`
                : ""}
              {progressRes.progress.activityStreakDays > 0
                ? ` • 📅 aktif ${progressRes.progress.activityStreakDays} hari beruntun`
                : ""}
            </p>
            {progressRes.progress.injury ? (
              <p className="rounded-xl border border-red-brand/50 bg-red-brand/10 px-3 py-2 text-sm font-semibold text-red-400">
                🤕 Cedera:{" "}
                {INJURY_STAT_LABELS[
                  progressRes.progress.injury.stat as keyof typeof INJURY_STAT_LABELS
                ] ?? progressRes.progress.injury.stat}{" "}
                -{progressRes.progress.injury.pct}% — sembuh setelah{" "}
                {progressRes.progress.injury.fightsRemaining} fight lagi.
              </p>
            ) : null}

            <div>
              <h3 className="mb-2 font-display text-xl uppercase tracking-wide">
                Achievement
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {progressRes.achievements.map((a) => (
                  <div
                    key={a.id}
                    className={`rounded-xl border px-3 py-2 text-center ${
                      a.unlocked
                        ? "border-amber-brand/60 bg-amber-brand/10"
                        : "border-white/10 bg-white/[0.03] opacity-60"
                    }`}
                    title={a.description}
                  >
                    <p className="text-xl">{a.icon}</p>
                    <p className="mt-1 text-xs font-semibold text-paper">{a.label}</p>
                    <p className="text-[11px] text-paper-mute">
                      {a.unlocked ? "Terbuka" : "Terkunci"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-display text-xl uppercase tracking-wide">
                Gear Dimiliki
              </h3>
              {progressRes.gear.length === 0 ? (
                <p className="text-sm text-paper-dim">
                  Belum ada gear. Menang fight untuk dapat koin, lalu belanja
                  di toko.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {progressRes.gear.map((g) => (
                    <Badge key={g.id} tone="amber">
                      {g.label}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-3">
                <ButtonLink href="/toko">Ke Toko Gear 🛒</ButtonLink>
              </div>
            </div>
          </GlassCard>
        </section>
      ) : null}

      {/* Deskripsi diri */}
      {f.selfDescription ? (
        <section aria-labelledby="tentang-heading">
          <h2
            id="tentang-heading"
            className="mb-4 font-display text-3xl uppercase tracking-wide"
          >
            Tentang <span className="text-amber-brand">Fighter</span>
          </h2>
          <GlassCard>
            <p className="whitespace-pre-line text-sm leading-relaxed text-paper-dim">
              {f.selfDescription}
            </p>
          </GlassCard>
        </section>
      ) : null}

      {/* Riwayat fight */}
      <section aria-labelledby="riwayat-heading">
        <h2
          id="riwayat-heading"
          className="mb-4 font-display text-3xl uppercase tracking-wide"
        >
          Riwayat <span className="text-red-brand">Pertarungan</span>
        </h2>
        {history.length === 0 ? (
          <EmptyState
            title="Belum Ada Pertarungan"
            description="Fighter ini belum pernah bertanding di turnamen. Riwayat akan muncul setelah ronde pertamanya diundi."
          />
        ) : (
          <div className="space-y-3">
            {history.map((h, i) => (
              <GlassCard key={h.matchId ?? i} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-paper">
                      {h.tournamentName ?? "Turnamen"} •{" "}
                      {ROUND_LABELS[h.round ?? "R16"] ?? h.round}
                    </p>
                    <p className="mt-0.5 text-sm text-paper-dim">
                      Lawan: {h.opponentName ?? "—"}
                      {h.decidedAt ? ` • ${formatWIB(h.decidedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.result === "win" ? (
                      <Badge tone="amber">Menang</Badge>
                    ) : h.result === "loss" ? (
                      <Badge tone="red">Kalah</Badge>
                    ) : h.result === "draw" ? (
                      <Badge tone="cyan">Seri</Badge>
                    ) : null}
                    {h.method ? (
                      <Badge tone="outline">
                        {METHOD_LABELS[h.method] ?? h.method}
                      </Badge>
                    ) : null}
                    {h.score ? (
                      <span className="font-display text-lg tabular-nums text-paper">
                        {h.score.a}:{h.score.b}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {h.matchId ? (
                    <Link
                      href={`/pertandingan/${h.matchId}`}
                      className="font-semibold text-amber-brand hover:underline"
                    >
                      Lihat pertandingan →
                    </Link>
                  ) : null}
                  {h.reelUrl ? (
                    <a
                      href={h.reelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-cyan-accent hover:underline"
                    >
                      Tonton Reel ↗
                    </a>
                  ) : null}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      {/* Riwayat gelar */}
      <section aria-labelledby="gelar-heading">
        <h2
          id="gelar-heading"
          className="mb-4 font-display text-3xl uppercase tracking-wide"
        >
          Riwayat <span className="text-amber-brand">Gelar</span>
        </h2>
        {titleHistory.length === 0 ? (
          <EmptyState
            title="Belum Pernah Pegang Gelar"
            description="Fighter ini belum pernah merebut atau memegang sabuk Juara Street Fight."
          />
        ) : (
          <div className="space-y-3">
            {titleHistory.map((t) => (
              <GlassCard key={t.id ?? `${t.type}-${t.at}`} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-paper">
                      {TITLE_EVENT_LABELS[t.type ?? ""] ?? t.type}
                    </p>
                    <p className="mt-0.5 text-sm text-paper-dim">
                      {t.at ? formatWIB(t.at) : ""}
                      {t.score !== null && t.score !== undefined
                        ? ` • ${t.score} kemenangan race`
                        : ""}
                      {t.defensesAtEnd !== null && t.defensesAtEnd !== undefined
                        ? ` • ${t.defensesAtEnd} defense di reign itu`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.role === "won" ? (
                      <Badge tone="amber">Juara</Badge>
                    ) : (
                      <Badge tone="red">Kehilangan Gelar</Badge>
                    )}
                    {t.fightId ? (
                      <Link
                        href={`/game/${t.fightId}`}
                        className="text-sm font-semibold text-amber-brand hover:underline"
                      >
                        Lihat fight →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      {/* Riwayat game kasual */}
      <section aria-labelledby="game-heading">
        <h2
          id="game-heading"
          className="mb-4 font-display text-3xl uppercase tracking-wide"
        >
          Riwayat <span className="text-amber-brand">Game</span>
        </h2>
        {gameHistory.length === 0 ? (
          <EmptyState
            title="Belum Ada Fight Game"
            description="Fighter ini belum pernah bertarung di game Hub. Tantang lewat halaman Tantangan!"
            action={<ButtonLink href="/tantangan">Ke Tantangan</ButtonLink>}
          />
        ) : (
          <div className="space-y-3">
            {gameHistory.map((g) => (
              <GlassCard key={g.fightId} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-paper">
                      vs {g.opponentName ?? "—"}
                      {g.isTitleFight ? (
                        <span className="ml-2">
                          <Badge tone="amber">Title Fight</Badge>
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-paper-dim">
                      {g.completedAt ? formatWIB(g.completedAt) : ""}
                      {g.status === "disputed" ? " • Disputed" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.result === "win" ? (
                      <Badge tone="amber">Menang</Badge>
                    ) : g.result === "loss" ? (
                      <Badge tone="red">Kalah</Badge>
                    ) : (
                      <Badge tone="cyan">Seri</Badge>
                    )}
                    {g.method ? (
                      <Badge tone="outline">
                        {METHOD_LABELS[g.method] ?? g.method}
                      </Badge>
                    ) : null}
                    {g.score ? (
                      <span className="font-display text-lg tabular-nums text-paper">
                        {g.score.a}:{g.score.b}
                      </span>
                    ) : null}
                  </div>
                </div>
                {g.fightId ? (
                  <div className="mt-2">
                    <Link
                      href={`/game/${g.fightId}`}
                      className="text-sm font-semibold text-amber-brand hover:underline"
                    >
                      Tonton ulang / lihat hasil →
                    </Link>
                  </div>
                ) : null}
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-sm text-paper-mute">
        Lihat semua pertarungan di{" "}
        <a
          href={IG_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-amber-brand hover:underline"
        >
          @streetfightstickman
        </a>
      </p>
    </div>
  );
}
