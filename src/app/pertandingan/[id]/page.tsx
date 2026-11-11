import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApiGet, dataOr } from "@/components/server-api";
import {
  asFighter,
  formatWIB,
  getId,
  instagramEmbedUrl,
  METHOD_LABELS,
  ROUND_LABELS,
  styleColor,
} from "@/components/api";
import type { MatchItem } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import StatChip from "@/components/StatChip";
import PredictionBox from "@/components/PredictionBox";
import { ButtonLink } from "@/components/Button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await serverApiGet<{ match: MatchItem }>(
      `/api/matches/${id}`,
    );
    const m = res && res.ok ? res.data.match : null;
    if (m) {
      const a = asFighter(m.fighterA ?? m.fighterAId);
      const b = asFighter(m.fighterB ?? m.fighterBId);
      const title = `${a?.displayName ?? "TBD"} vs ${b?.displayName ?? "TBD"}`;
      return {
        title: `Pertandingan: ${title}`,
        description: `Hasil pertandingan ${ROUND_LABELS[m.round] ?? m.round} — ${title}.`,
      };
    }
  } catch {
    // fallback
  }
  return {
    title: "Detail Pertandingan",
    description: "Detail pertandingan turnamen stickman fight.",
  };
}

function FighterSide({
  fighter,
  isWinner,
  score,
  align,
}: {
  fighter: NonNullable<ReturnType<typeof asFighter>>;
  isWinner: boolean;
  score: number | null;
  align: "left" | "right";
}) {
  const color = styleColor(fighter.style);
  const record = fighter.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };
  return (
    <Link
      href={`/fighter/${getId(fighter)}`}
      className="glass group block overflow-hidden p-0 transition-transform duration-150 hover:scale-[1.02]"
    >
      <div className="h-2 w-full" style={{ backgroundColor: color }} />
      <div className={`p-5 ${align === "right" ? "sm:text-right" : ""}`}>
        {isWinner ? (
          <Badge tone="amber" className="mb-2">
            Pemenang
          </Badge>
        ) : null}
        <p className="font-display text-2xl uppercase leading-tight tracking-wide group-hover:text-amber-brand sm:text-3xl">
          {fighter.displayName}
        </p>
        <p className="text-xs text-paper-mute">@{fighter.igUsername}</p>
        <div
          className={`mt-4 flex gap-4 text-sm ${align === "right" ? "sm:justify-end" : ""}`}
        >
          <span>
            <strong className="font-display text-lg text-paper">{record.wins}</strong>{" "}
            <span className="text-paper-mute">M</span>
          </span>
          <span>
            <strong className="font-display text-lg text-paper">{record.losses}</strong>{" "}
            <span className="text-paper-mute">K</span>
          </span>
          <span>
            <strong className="font-display text-lg text-paper">{record.kos}</strong>{" "}
            <span className="text-paper-mute">KO</span>
          </span>
          {score !== null ? (
            <span>
              <strong className="font-display text-lg text-amber-brand">
                {score}
              </strong>{" "}
              <span className="text-paper-mute">poin</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default async function PertandinganDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await serverApiGet<{ match: MatchItem }>(`/api/matches/${id}`);
  const m = res && res.ok ? res.data.match : null;
  if (!m) notFound();

  const a = asFighter(m.fighterA ?? m.fighterAId);
  const b = asFighter(m.fighterB ?? m.fighterBId);
  const winnerId = typeof m.winnerId === "string" ? m.winnerId : "";
  const aWon = !!a && winnerId !== "" && getId(a) === winnerId;
  const bWon = !!b && winnerId !== "" && getId(b) === winnerId;
  const decided = m.status === "decided" || m.status === "video_done";

  // Badge rivalitas (head-to-head pasangan ini, kalau pernah bertemu).
  let rivalryLabel: string | null = null;
  if (a && b) {
    try {
      const rr = await serverApiGet<{ label: string | null; rivalry: { totalFights: number } }>(
        `/api/fighters/${getId(a)}/rivalry?opponentId=${getId(b)}`,
      );
      const rd = dataOr(rr, null);
      if (rd && rd.rivalry?.totalFights > 0) rivalryLabel = rd.label;
    } catch {
      rivalryLabel = null;
    }
  }
  const tournament =
    m.tournament ??
    (m.tournamentId && typeof m.tournamentId === "object"
      ? m.tournamentId
      : null);
  const embedUrl = instagramEmbedUrl(m.reelUrl);

  return (
    <div className="space-y-8">
      <header className="text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge tone="red">{ROUND_LABELS[m.round] ?? m.round}</Badge>
          {decided && m.method ? (
            <Badge tone={m.method === "KO" ? "red" : "amber"}>
              {METHOD_LABELS[m.method] ?? m.method}
            </Badge>
          ) : (
            <Badge tone="outline">Terjadwal</Badge>
          )}
          {m.method === "KO" && m.koTimeSec != null ? (
            <Badge tone="outline">KO di detik {m.koTimeSec}</Badge>
          ) : null}
        </div>
        <h1 className="mt-4 font-display text-4xl uppercase tracking-wide sm:text-5xl">
          {a?.displayName ?? "TBD"} <span className="text-red-brand">VS</span>{" "}
          {b?.displayName ?? "TBD"}
        </h1>
        <p className="mt-2 text-sm text-paper-dim">
          {tournament?.name ? (
            <>
              {tournament.name}
              {tournament.slug ? (
                <>
                  {" • "}
                  <Link
                    href={`/turnamen/${tournament.slug}`}
                    className="font-semibold text-amber-brand hover:underline"
                  >
                    Lihat turnamen
                  </Link>
                </>
              ) : null}
            </>
          ) : (
            "Turnamen Night Fight Championship"
          )}
          {m.decidedAt ? <> • Diputuskan {formatWIB(m.decidedAt)}</> : null}
        </p>
      </header>

      {/* Dua fighter berdampingan */}
      {rivalryLabel ? (
        <p className="glass px-4 py-2 text-center text-sm font-semibold text-amber-brand">
          ⚔️ {rivalryLabel}
        </p>
      ) : null}
      <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        {a ? (
          <FighterSide fighter={a} isWinner={aWon} score={m.score?.a ?? null} align="left" />
        ) : (
          <GlassCard className="flex items-center justify-center text-paper-mute">
            Lawan belum ditentukan
          </GlassCard>
        )}
        <div className="flex items-center justify-center">
          <span className="sticker flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-red-brand bg-red-brand/15 font-display text-2xl text-red-brand md:h-20 md:w-20 md:text-3xl">
            VS
          </span>
        </div>
        {b ? (
          <FighterSide fighter={b} isWinner={bWon} score={m.score?.b ?? null} align="right" />
        ) : (
          <GlassCard className="flex items-center justify-center text-paper-mute">
            {m.isBye ? "Bye — lolos otomatis" : "Lawan belum ditentukan"}
          </GlassCard>
        )}
      </div>

      {/* Hasil */}
      {decided ? (
        <GlassCard className="text-center">
          <h2 className="font-display text-2xl uppercase tracking-wide">
            Hasil Pertandingan
          </h2>
          {m.method === "draw" ? (
            <p className="mt-2 text-lg text-paper">
              Pertandingan berakhir <strong className="text-cyan-accent">seri</strong>.
              Pemenang ditentukan lewat undian ulang.
            </p>
          ) : (
            <p className="mt-2 text-lg text-paper">
              Pemenang:{" "}
              <strong className="text-amber-brand">
                {aWon ? a?.displayName : b?.displayName}
              </strong>{" "}
              {m.method ? `(${METHOD_LABELS[m.method] ?? m.method})` : ""}
              {m.score ? ` — skor ${m.score.a} : ${m.score.b}` : ""}
              {m.method === "KO" && m.koTimeSec != null ? ` — KO di detik ${m.koTimeSec}` : ""}
            </p>
          )}
          <div className="mx-auto mt-5 grid max-w-lg grid-cols-3 gap-3">
            <StatChip label="Skor A" value={m.score?.a ?? "—"} tone="paper" />
            <StatChip label="Skor B" value={m.score?.b ?? "—"} tone="paper" />
            <StatChip
              label="KO"
              value={m.koTimeSec != null ? `${m.koTimeSec} dtk` : "—"}
              tone="red"
            />
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="text-center">
          <p className="text-paper-dim">
            Pertandingan ini belum diputuskan. Hasil dan video akan muncul di
            sini setelah ronde diundi admin.
          </p>
        </GlassCard>
      )}

      {/* Prediksi penonton (hanya saat terjadwal & kedua fighter ada) */}
      {a && b ? (
        <PredictionBox
          fightId={id}
          kind="tournament"
          fighterA={{ id: getId(a), displayName: a.displayName }}
          fighterB={{ id: getId(b), displayName: b.displayName }}
          canPredict={!decided}
        />
      ) : null}

      {/* Reel */}
      {m.reelUrl ? (
        <section aria-label="Video pertandingan">
          <h2 className="mb-4 text-center font-display text-3xl uppercase tracking-wide">
            Tonton <span className="text-amber-brand">Reel-nya</span>
          </h2>
          <div className="mx-auto max-w-md space-y-4">
            {embedUrl ? (
              <div className="glass overflow-hidden p-2">
                <iframe
                  src={embedUrl}
                  title="Reel pertandingan di Instagram"
                  className="h-[540px] w-full rounded-lg bg-ink-900"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            ) : null}
            <div className="text-center">
              <ButtonLink href={m.reelUrl} size="lg">
                Buka Reel di Instagram
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
