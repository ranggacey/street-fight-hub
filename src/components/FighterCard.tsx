import Link from "next/link";
import type { Fighter } from "./types";
import { getId, styleColor, styleLabel } from "./api";
import Badge from "./Badge";

/** Kartu ringkas fighter — dipakai di home, detail turnamen, klasemen. */
export default function FighterCard({
  fighter,
  rank,
}: {
  fighter: Fighter;
  rank?: number;
}) {
  const id = getId(fighter);
  const color = styleColor(fighter.style);
  const record = fighter.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };

  return (
    <Link
      href={`/fighter/${id}`}
      className="glass group block overflow-hidden p-0 transition-transform duration-150 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-amber-brand"
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-xl uppercase leading-tight tracking-wide text-paper group-hover:text-amber-brand">
              {fighter.displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-paper-mute">
              @{fighter.igUsername}
            </p>
          </div>
          {typeof rank === "number" ? (
            <span className="shrink-0 rounded-lg border border-amber-brand/50 bg-amber-brand/15 px-2 py-1 font-display text-lg leading-none text-amber-brand">
              #{rank}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="outline">
            {styleLabel(fighter.style, fighter.styleOther)}
          </Badge>
          {fighter.status === "retired" ? (
            <Badge tone="neutral">Pensiun</Badge>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3 text-sm">
          <span>
            <strong className="font-display text-base text-paper">
              {record.wins}
            </strong>{" "}
            <span className="text-paper-mute">Menang</span>
          </span>
          <span>
            <strong className="font-display text-base text-paper">
              {record.losses}
            </strong>{" "}
            <span className="text-paper-mute">Kalah</span>
          </span>
          <span>
            <strong className="font-display text-base text-paper">
              {record.draws}
            </strong>{" "}
            <span className="text-paper-mute">Seri</span>
          </span>
          <span className="ml-auto">
            <strong className="font-display text-base text-red-brand">
              {record.kos}
            </strong>{" "}
            <span className="text-paper-mute">KO</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
