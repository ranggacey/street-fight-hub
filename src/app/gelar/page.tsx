import Link from "next/link";
import type { Metadata } from "next";
import { dataOr, serverApiGet } from "@/components/server-api";
import { formatDateWIB, formatWIB, styleLabel } from "@/components/api";
import type { TitleHistoryEvent, TitlePublic } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Countdown from "@/components/Countdown";
import EmptyState from "@/components/EmptyState";
import StatChip from "@/components/StatChip";
import { ButtonLink } from "@/components/Button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gelar Juara",
  description:
    "Juara Street Fight saat ini, riwayat juara, lineage sabuk, dan Hall of Fame.",
};

const EVENT_LABELS: Record<string, string> = {
  race_10_win: "Menang Race 10",
  race_7_win: "Menang Race 7",
  takeover: "Merebut Gelar",
  vacated_inactivity: "Gelar Kosong (tidak bertarung 6 hari)",
};

function holderName(
  v: string | { displayName?: string } | null | undefined,
): string {
  if (!v) return "—";
  if (typeof v === "string") return v;
  return v.displayName ?? "—";
}

function holderIdOf(
  v: string | { id?: string; _id?: string } | null | undefined,
): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.id ?? v._id ?? "";
}

export default async function GelarPage() {
  const [titleRes, historyRes] = await Promise.all([
    serverApiGet<{ title: TitlePublic }>("/api/title"),
    serverApiGet<{
      events: TitleHistoryEvent[];
      page: number;
      total: number;
      pages: number;
    }>("/api/title/history?limit=50"),
  ]);
  const title = dataOr(titleRes, { title: null as TitlePublic | null }).title;
  const history = dataOr(historyRes, {
    events: [],
    page: 1,
    total: 0,
    pages: 1,
  }).events;

  // --- Hall of Fame (dihitung dari TitleHistory + GameFight) ---
  // Reign: tiap event penobatan → berakhir di event berikutnya yang
  // melibatkan holder itu (takeover / vacated) atau masih berjalan.
  type Reign = {
    fighterId: string;
    name: string;
    start: number;
    end: number | null;
    defenses: number;
    endedBy: string | null;
  };
  const reigns: Reign[] = [];
  const open = new Map<string, Reign>();
  for (const e of [...history].reverse()) {
    const at = new Date(e.at ?? "").getTime();
    if (Number.isNaN(at)) continue;
    if (e.type === "race_10_win" || e.type === "race_7_win" || e.type === "takeover") {
      const nid = holderIdOf(e.newHolderFighterId);
      if (!nid) continue;
      const reign: Reign = {
        fighterId: nid,
        name: holderName(e.newHolderFighterId),
        start: at,
        end: null,
        defenses: 0,
        endedBy: null,
      };
      reigns.push(reign);
      open.set(nid, reign);
    } else if (e.type === "vacated_inactivity") {
      const pid = holderIdOf(e.previousHolderFighterId);
      const reign = pid ? open.get(pid) : undefined;
      if (reign) {
        reign.end = at;
        reign.defenses = e.defensesAtEnd ?? 0;
        reign.endedBy = "kosong (6 hari tidak bertarung)";
        open.delete(pid);
      }
    }
    if (e.type === "takeover") {
      const pid = holderIdOf(e.previousHolderFighterId);
      const reign = pid ? open.get(pid) : undefined;
      if (reign) {
        reign.end = at;
        reign.defenses = e.defensesAtEnd ?? 0;
        reign.endedBy = holderName(e.newHolderFighterId);
        open.delete(pid);
      }
    }
  }
  // Reign yang masih berjalan: defenses dari data title saat ini.
  for (const reign of reigns) {
    if (reign.end === null && title?.holder?.id === reign.fighterId) {
      reign.defenses = title.defenses ?? 0;
    }
  }
  // Referensi "sekarang" untuk reign yang masih berjalan — diambil dari
  // data terbaru yang diketahui (bukan Date.now(), supaya render Server
  // Component tetap murni/deterministik).
  const nowRef = Math.max(
    0,
    ...history
      .map((e) => new Date(e.at ?? "").getTime())
      .filter((t) => Number.isFinite(t)),
    title?.wonAt ? new Date(title.wonAt).getTime() : 0,
  );
  const longestReign = reigns.reduce<Reign | null>(
    (best, r) =>
      !best ||
      (r.end ?? nowRef) - r.start > (best.end ?? nowRef) - best.start
        ? r
        : best,
    null,
  );
  const mostDefenses = reigns.reduce<Reign | null>(
    (best, r) => (!best || r.defenses > best.defenses ? r : best),
    null,
  );
  // Raihan gelar tercepat: race event dengan (at - raceStartAt) terkecil.
  const fastestRace = history
    .filter(
      (e) =>
        (e.type === "race_10_win" || e.type === "race_7_win") &&
        e.raceStartAt &&
        e.at,
    )
    .map((e) => ({
      name: holderName(e.newHolderFighterId),
      type: e.type,
      ms:
        new Date(e.at ?? "").getTime() - new Date(e.raceStartAt ?? "").getTime(),
    }))
    .filter((r) => r.ms >= 0)
    .sort((a, b) => a.ms - b.ms)[0];

  const fmtDays = (ms: number): string => {
    const d = ms / 86_400_000;
    return d < 1 ? `${Math.max(1, Math.round(d * 24))} jam` : `${d.toFixed(1)} hari`;
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Gelar <span className="text-amber-brand">Juara</span>
        </h1>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Sabuk Juara Street Fight. Menang 10 fight duluan saat gelar kosong
          untuk merebutnya; kalau holder kalah, gelar pindah ke pemenang;
          holder yang 6 hari tidak bertarung kehilangan gelarnya.
        </p>
      </header>

      {/* Kartu juara aktif */}
      {title?.holder ? (
        <section aria-labelledby="juara-heading">
          <GlassCard
            strong
            className="border-amber-brand/40 px-6 py-8 text-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/belt.webp"
              alt="Sabuk Juara Street Fight"
              width={160}
              height={160}
              className="mx-auto h-28 w-28 sm:h-40 sm:w-40"
            />
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-brand">
              Juara Bertahan
            </p>
            <p className="mt-3 font-display text-4xl uppercase leading-none tracking-wide sm:text-6xl">
              {title.holder.displayName}
            </p>
            <p className="mt-2 text-sm text-paper-dim">
              @{title.holder.igUsername} •{" "}
              {styleLabel(title.holder.style, title.holder.styleOther ?? undefined)}
              {title.wonAt ? ` • Juara sejak ${formatDateWIB(title.wonAt)}` : ""}
            </p>
            <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-3">
              <StatChip label="Defense" value={title.defenses ?? 0} tone="amber" />
              <StatChip
                label="Rating"
                value={title.holder.rating ?? 1000}
                tone="paper"
              />
              <StatChip
                label="Menang Kasual"
                value={title.holder.casualRecord?.wins ?? 0}
                tone="cyan"
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <ButtonLink href={`/fighter/${title.holder.id ?? ""}`}>
                Lihat Profil Juara
              </ButtonLink>
              <ButtonLink href="/tantangan" variant="ghost">
                Tantang Juara →
              </ButtonLink>
            </div>
          </GlassCard>
          {title.vacatesAt ? (
            <div className="mt-4">
              <Countdown
                target={title.vacatesAt}
                label="Gelar kosong dalam (holder tidak bertarung)"
                endedLabel="Gelar sudah kosong — race perebutan dimulai"
              />
            </div>
          ) : null}
        </section>
      ) : (
        <section aria-labelledby="kosong-heading">
          <GlassCard strong className="border-amber-brand/40 px-6 py-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/belt.webp"
              alt="Sabuk Juara Street Fight"
              width={160}
              height={160}
              className="mx-auto h-28 w-28 opacity-80 sm:h-40 sm:w-40"
            />
            <h2
              id="kosong-heading"
              className="mt-4 font-display text-3xl uppercase tracking-wide sm:text-4xl"
            >
              Gelar <span className="text-amber-brand">Kosong</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-paper-dim">
              Belum ada juara bertahan. Menang{" "}
              <strong className="text-paper">{title?.raceTarget ?? 10} fight</strong>{" "}
              duluan untuk merebut sabuk ini — kemenangan dihitung dari semua
              fight game terverifikasi sejak{" "}
              {title?.raceStartAt ? formatDateWIB(title.raceStartAt) : "race dimulai"}.
            </p>
            {title?.raceStandings && title.raceStandings.length > 0 ? (
              <div className="mx-auto mt-5 max-w-md space-y-2 text-left">
                {title.raceStandings.map((s) => (
                  <div
                    key={s.fighterId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2"
                  >
                    <Link
                      href={`/fighter/${s.fighterId}`}
                      className="font-semibold text-paper hover:text-amber-brand"
                    >
                      {s.displayName}
                    </Link>
                    <span className="font-display text-lg text-amber-brand">
                      {s.wins}/{title.raceTarget ?? 10}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-paper-mute">
                Belum ada yang memenangkan fight di race ini.
              </p>
            )}
            <div className="mt-5">
              <ButtonLink href="/tantangan">Mulai Race →</ButtonLink>
            </div>
          </GlassCard>
        </section>
      )}

      {/* Hall of Fame */}
      <section aria-labelledby="hof-heading">
        <h2
          id="hof-heading"
          className="mb-4 font-display text-3xl uppercase tracking-wide"
        >
          Hall of <span className="text-amber-brand">Fame</span>
        </h2>
        {reigns.length === 0 ? (
          <EmptyState
            title="Belum Ada Juara"
            description="Belum ada yang pernah memegang gelar — jadilah yang pertama."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <GlassCard className="px-4 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-paper-dim">
                Reign Terlama
              </p>
              <p className="mt-2 font-display text-2xl uppercase text-paper">
                {longestReign?.name ?? "—"}
              </p>
              <p className="mt-1 text-sm text-paper-mute">
                {longestReign
                  ? fmtDays((longestReign.end ?? nowRef) - longestReign.start)
                  : "—"}
              </p>
            </GlassCard>
            <GlassCard className="px-4 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-paper-dim">
                Defense Terbanyak
              </p>
              <p className="mt-2 font-display text-2xl uppercase text-paper">
                {mostDefenses?.name ?? "—"}
              </p>
              <p className="mt-1 text-sm text-paper-mute">
                {mostDefenses ? `${mostDefenses.defenses}x defense` : "—"}
              </p>
            </GlassCard>
            <GlassCard className="px-4 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-paper-dim">
                Raihan Gelar Tercepat
              </p>
              <p className="mt-2 font-display text-2xl uppercase text-paper">
                {fastestRace?.name ?? "—"}
              </p>
              <p className="mt-1 text-sm text-paper-mute">
                {fastestRace
                  ? `${fmtDays(fastestRace.ms)} (${fastestRace.type === "race_10_win" ? "race 10" : "race 7"})`
                  : "—"}
              </p>
            </GlassCard>
          </div>
        )}
      </section>

      {/* Lineage / timeline sabuk */}
      <section aria-labelledby="riwayat-heading">
        <h2
          id="riwayat-heading"
          className="mb-4 font-display text-3xl uppercase tracking-wide"
        >
          Riwayat <span className="text-red-brand">Juara</span>
        </h2>
        {history.length === 0 ? (
          <EmptyState
            title="Belum Ada Riwayat Gelar"
            description="Perubahan gelar pertama akan tercatat di sini."
          />
        ) : (
          <ol className="space-y-3">
            {history.map((e) => {
              const newId = holderIdOf(e.newHolderFighterId);
              const prevId = holderIdOf(e.previousHolderFighterId);
              const fightId =
                e.fightId && typeof e.fightId === "object"
                  ? (e.fightId.id ?? null)
                  : null;
              return (
                <li key={e.id}>
                  <GlassCard className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-paper">
                          {e.type === "vacated_inactivity" ? (
                            <>
                              Gelar kosong — {holderName(e.previousHolderFighterId)}{" "}
                              kehilangan sabuk
                            </>
                          ) : (
                            <>
                              {holderName(e.newHolderFighterId)} jadi juara
                              {prevId ? (
                                <>
                                  {" "}
                                  (merebut dari {holderName(e.previousHolderFighterId)})
                                </>
                              ) : null}
                            </>
                          )}
                        </p>
                        <p className="mt-0.5 text-sm text-paper-dim">
                          {EVENT_LABELS[e.type ?? ""] ?? e.type}
                          {e.score !== null && e.score !== undefined
                            ? ` • ${e.score} kemenangan race`
                            : ""}
                          {e.defensesAtEnd !== null && e.defensesAtEnd !== undefined
                            ? ` • ${e.defensesAtEnd} defense di reign sebelumnya`
                            : ""}
                          {e.at ? ` • ${formatWIB(e.at)}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {newId ? (
                          <Link
                            href={`/fighter/${newId}`}
                            className="text-sm font-semibold text-amber-brand hover:underline"
                          >
                            Profil →
                          </Link>
                        ) : null}
                        {fightId ? (
                          <Link
                            href={`/game/${fightId}`}
                            className="text-sm font-semibold text-cyan-accent hover:underline"
                          >
                            Lihat fight →
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </GlassCard>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
