import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dataOr, serverApiGet } from "@/components/server-api";
import {
  asFighter,
  formatWIB,
  getId,
  TOURNAMENT_STATUS_LABELS,
} from "@/components/api";
import type {
  MatchItem,
  Tournament,
  TournamentDetail,
  TournamentEntry,
} from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import Countdown from "@/components/Countdown";
import BracketView from "@/components/BracketView";
import FighterCard from "@/components/FighterCard";
import StatChip from "@/components/StatChip";
import EmptyState from "@/components/EmptyState";
import TournamentActions from "./TournamentActions";

export const dynamic = "force-dynamic";

/** Backend mengembalikan { tournament, entries, bracket, participantCount }. */
type TournamentDetailResponse = {
  tournament: Tournament;
  entries: TournamentEntry[];
  bracket: MatchItem[];
  participantCount: number;
};

function toDetail(
  raw: TournamentDetailResponse | null,
): TournamentDetail | null {
  if (!raw) return null;
  return {
    ...raw.tournament,
    entries: raw.entries,
    bracket: raw.bracket,
    participantCount: raw.participantCount,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await serverApiGet<TournamentDetailResponse>(
      `/api/tournaments/${slug}`,
    );
    const t = toDetail(dataOr(res, null));
    if (t) {
      return {
        title: t.name,
        description: `Detail turnamen ${t.name} — ${TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}, bracket ${t.bracketSize} fighter.`,
      };
    }
  } catch {
    // jatuh ke metadata default di bawah
  }
  return {
    title: "Detail Turnamen",
    description: "Detail turnamen Night Fight Championship.",
  };
}

export default async function TurnamenDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await serverApiGet<TournamentDetailResponse>(
    `/api/tournaments/${slug}`,
  );
  const t = toDetail(dataOr(res, null));

  if (!t) notFound();

  const entries = (t.entries ?? []).filter((e) => e.status !== "withdrawn");
  const participantCount = t.participantCount ?? entries.length;
  const entryUserIds = entries
    .map((e) => asFighter(e.fighter ?? e.fighterId)?.userId ?? "")
    .filter(Boolean);
  const champion = asFighter(
    typeof t.championId === "string" ? null : t.championId,
  );

  const statusTone =
    t.status === "in_progress"
      ? "red"
      : t.status === "upcoming"
        ? "amber"
        : t.status === "completed"
          ? "green"
          : "neutral";

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone}>
            {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
          </Badge>
          <Badge tone="outline">Single Elimination</Badge>
          <Badge tone="outline">Bracket {t.bracketSize}</Badge>
        </div>
        <h1 className="mt-3 font-display text-4xl uppercase leading-tight tracking-wide sm:text-6xl">
          {t.name}
        </h1>
        <p className="mt-2 text-sm text-paper-dim">
          Pendaftaran: {formatWIB(t.regOpenAt)} — {formatWIB(t.regCloseAt)}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            <StatChip
              label="Peserta"
              value={`${participantCount}/${t.bracketSize}`}
              tone="amber"
            />
            <StatChip
              label="Ukuran Bracket"
              value={t.bracketSize}
              tone="paper"
            />
            <StatChip
              label="Status"
              value={
                t.status === "in_progress"
                  ? "LIVE"
                  : t.status === "completed"
                    ? "Selesai"
                    : t.status === "upcoming"
                      ? "Buka"
                      : "Tutup"
              }
              tone={t.status === "in_progress" ? "red" : "cyan"}
            />
          </div>

          {t.status === "upcoming" ? (
            <Countdown target={t.regCloseAt} />
          ) : null}

          {t.rules ? (
            <GlassCard>
              <h2 className="font-display text-xl uppercase tracking-wide text-amber-brand">
                Peraturan
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-paper-dim">
                {t.rules}
              </p>
            </GlassCard>
          ) : null}

          {champion ? (
            <GlassCard className="border-amber-brand/50">
              <Badge tone="amber">Champion</Badge>
              <p className="mt-2 font-display text-3xl uppercase tracking-wide">
                {champion.aiPersona?.nickname ?? champion.displayName}
              </p>
              <p className="mt-1 text-sm text-paper-dim">
                {champion.aiPersona?.introLine ?? ""}
              </p>
            </GlassCard>
          ) : null}
        </div>

        <div>
          <TournamentActions
            slug={t.slug}
            status={t.status}
            regCloseAt={t.regCloseAt}
            entryUserIds={entryUserIds}
          />
        </div>
      </div>

      {/* Daftar peserta */}
      <section aria-labelledby="peserta-heading">
        <h2
          id="peserta-heading"
          className="mb-4 font-display text-3xl uppercase tracking-wide"
        >
          Peserta <span className="text-amber-brand">({participantCount})</span>
        </h2>
        {entries.length === 0 ? (
          <EmptyState
            title="Belum Ada Peserta"
            description="Belum ada fighter yang mendaftar ke turnamen ini. Jadilah yang pertama!"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e, i) => {
              const f = asFighter(e.fighter ?? e.fighterId);
              if (!f) return null;
              return (
                <FighterCard key={getId(f) || i} fighter={f} />
              );
            })}
          </div>
        )}
      </section>

      {/* Bracket */}
      <section aria-labelledby="bracket-heading">
        <h2
          id="bracket-heading"
          className="mb-4 font-display text-3xl uppercase tracking-wide"
        >
          Bracket
        </h2>
        <BracketView bracket={t.bracket} />
      </section>
    </div>
  );
}
