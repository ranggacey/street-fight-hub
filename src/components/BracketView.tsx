import Link from "next/link";
import type { MatchItem } from "./types";
import {
  asFighter,
  getId,
  METHOD_LABELS,
  normalizeBracket,
  ROUND_LABELS,
  ROUND_ORDER,
} from "./api";
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

  const name = (f: typeof a) => f?.aiPersona?.nickname ?? f?.displayName ?? "TBD";

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
 * Bracket interaktif: mobile horizontal snap-scroll, desktop grid kolom
 * per ronde. Klik match untuk melihat detail pertandingan.
 */
export default function BracketView({
  bracket,
}: {
  bracket: MatchItem[] | Record<string, MatchItem[]> | null | undefined;
}) {
  const matches = normalizeBracket(bracket);
  if (matches.length === 0) {
    return (
      <EmptyState
        title="Bracket Belum Dibuat"
        description="Bracket akan muncul setelah admin menutup pendaftaran dan membuat bracket turnamen ini."
      />
    );
  }

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

  return (
    <div
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 lg:grid lg:snap-none lg:grid-flow-col lg:auto-cols-fr lg:overflow-visible"
      aria-label="Bracket turnamen"
    >
      {rounds.map((round) => {
        const list = byRound.get(round) ?? [];
        return (
          <section
            key={round}
            className="w-[280px] min-w-[280px] snap-start sm:w-[300px] lg:w-auto lg:min-w-0"
            aria-label={ROUND_LABELS[round] ?? round}
          >
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg uppercase tracking-wide">
              <span className="rounded-md bg-amber-brand px-2 py-0.5 text-sm text-on-amber">
                {round}
              </span>
              <span className="text-paper">{ROUND_LABELS[round] ?? round}</span>
              <span className="text-sm text-paper-mute">({list.length})</span>
            </h3>
            <div className="space-y-3">
              {list.map((m, i) => (
                <MatchRow key={getId(m) || `${round}-${i}`} match={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
