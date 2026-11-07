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
} from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import StatChip from "@/components/StatChip";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

/** Backend mengembalikan { fighter, history }. */
type FighterDetailResponse = {
  fighter: Fighter;
  history: FightHistoryItem[];
};

function toDetail(raw: FighterDetailResponse | null): FighterDetail | null {
  if (!raw) return null;
  return { ...raw.fighter, history: raw.history };
}

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

  const record = f.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };
  const color = styleColor(f.style);
  const history = f.history ?? f.matches ?? [];

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

      {/* Rekor */}
      <section aria-label="Rekor fighter">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip label="Menang" value={record.wins} tone="amber" />
          <StatChip label="Kalah" value={record.losses} tone="red" />
          <StatChip label="Seri" value={record.draws} tone="paper" />
          <StatChip label="KO" value={record.kos} tone="red" />
        </div>
      </section>

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
