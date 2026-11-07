import Link from "next/link";
import type { Metadata } from "next";
import { dataOr, serverApiGet } from "@/components/server-api";
import {
  asFighter,
  formatWIB,
  getId,
  IG_URL,
  normalizeBracket,
  TOURNAMENT_STATUS_LABELS,
} from "@/components/api";
import type {
  Announcement,
  Fighter,
  MatchItem,
  Tournament,
  TournamentDetail,
  TournamentEntry,
} from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import { ButtonLink } from "@/components/Button";
import FighterCard from "@/components/FighterCard";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Street Fight Tournament Hub — Arena Turnamen Stickman",
  description:
    "Buat fighter stickman-mu, ikut Night Fight Championship, dan tonton pertarunganmu di @streetfightstickman.",
};

function TournamentCard({ t }: { t: Tournament }) {
  const statusTone =
    t.status === "in_progress"
      ? "red"
      : t.status === "upcoming"
        ? "amber"
        : t.status === "completed"
          ? "green"
          : "neutral";
  return (
    <Link
      href={`/turnamen/${t.slug}`}
      className="glass group block p-5 transition-transform duration-150 hover:scale-[1.02]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-2xl uppercase leading-tight tracking-wide group-hover:text-amber-brand">
          {t.name}
        </h3>
        <Badge tone={statusTone}>
          {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
        </Badge>
      </div>
      <dl className="mt-3 space-y-1 text-sm text-paper-dim">
        <div className="flex justify-between gap-2">
          <dt>Ukuran bracket</dt>
          <dd className="font-semibold text-paper">{t.bracketSize} fighter</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Peserta</dt>
          <dd className="font-semibold text-paper">
            {t.participantCount ?? 0} / {t.bracketSize}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Pendaftaran ditutup</dt>
          <dd className="text-right font-semibold text-paper">
            {formatWIB(t.regCloseAt)}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm font-bold text-amber-brand">
        Lihat detail →
      </p>
    </Link>
  );
}

export default async function Home() {
  const [annRes, upcomingRes, liveRes, completedRes, topRes] =
    await Promise.all([
      serverApiGet<{ announcement: Announcement | null }>(
        "/api/announcements/active",
      ),
      serverApiGet<{ tournaments: Tournament[] }>(
        "/api/tournaments?status=upcoming",
      ),
      serverApiGet<{ tournaments: Tournament[] }>(
        "/api/tournaments?status=in_progress",
      ),
      serverApiGet<{ tournaments: Tournament[] }>(
        "/api/tournaments?status=completed",
      ),
      serverApiGet<{ fighters: Fighter[] }>("/api/fighters?sort=wins"),
    ]);

  const announcement = dataOr(annRes, { announcement: null }).announcement;
  const upcoming = dataOr(upcomingRes, { tournaments: [] }).tournaments;
  const live = dataOr(liveRes, { tournaments: [] }).tournaments;
  const completed = dataOr(completedRes, { tournaments: [] }).tournaments;
  const topFighters = dataOr(topRes, { fighters: [] }).fighters.slice(0, 5);

  // Juara terakhir: ambil detail turnamen selesai terbaru, cari champion-nya.
  const lastCompleted = completed[0];
  let championName: string | null = null;
  if (lastCompleted) {
    const detailRes = await serverApiGet<{
      tournament: Tournament;
      entries: TournamentEntry[];
      bracket: MatchItem[];
      participantCount: number;
    }>(`/api/tournaments/${lastCompleted.slug}`);
    const detailRaw = dataOr(detailRes, null);
    const detail: TournamentDetail | null = detailRaw
      ? {
          ...detailRaw.tournament,
          entries: detailRaw.entries,
          bracket: detailRaw.bracket,
          participantCount: detailRaw.participantCount,
        }
      : null;
    if (detail) {
      const champ = asFighter(
        typeof detail.championId === "string"
          ? null
          : (detail.championId as Fighter | null),
      );
      if (champ) {
        championName = champ.aiPersona?.nickname ?? champ.displayName;
      } else {
        // Fallback: pemenang final dari bracket (entries turnamen selesai
        // sudah tidak berstatus 'active', jadi lookup lewat entries gagal).
        const finalMatch = normalizeBracket(detail.bracket).find(
          (m) => m.round === "F" && m.status === "decided",
        );
        const fWinner = asFighter(
          typeof finalMatch?.winnerId === "string"
            ? null
            : (finalMatch?.winnerId as Fighter | null),
        );
        if (fWinner) {
          championName =
            fWinner.aiPersona?.nickname ?? fWinner.displayName;
        }
      }
    }
  }

  const apiDown =
    !annRes && !upcomingRes && !liveRes && !completedRes && !topRes;

  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="animate-fade-up pt-4 text-center sm:pt-10">
        <Badge tone="cyan" className="sticker">
          Single Elimination • Undian Acak
        </Badge>
        <h1 className="mt-5 font-display text-[clamp(3rem,11vw,7.5rem)] uppercase leading-[0.95] tracking-wide">
          Night Fight
          <span className="block text-amber-brand">Championship</span>
          <span className="text-stroke block">Stickman Arena</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-paper-dim sm:text-lg">
          Buat fighter stickman-mu dengan persona AI, daftarkan ke turnamen,
          dan biarkan undian menentukan nasibmu di ring. Kalah menang, tetap
          sportif — videonya tayang di Instagram.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/fighter-saya" size="lg">
            Buat Fighter-mu
          </ButtonLink>
          <ButtonLink href="/turnamen" variant="glass" size="lg">
            Lihat Turnamen
          </ButtonLink>
        </div>
        <p className="mt-5 text-sm text-paper-mute">
          Tonton semua pertarungan di{" "}
          <a
            href={IG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-amber-brand hover:underline"
          >
            @streetfightstickman
          </a>
        </p>
      </section>

      {/* Banner pengumuman aktif */}
      {announcement?.text ? (
        <section aria-label="Pengumuman" className="animate-fade-up">
          <div className="rounded-2xl border-2 border-amber-brand/70 bg-amber-brand/15 px-5 py-4 text-center shadow-[0_8px_32px_rgba(245,166,35,0.2)]">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-brand">
              Pengumuman
            </p>
            <p className="mt-1 text-base font-semibold leading-relaxed text-paper sm:text-lg">
              {announcement.text}
            </p>
          </div>
        </section>
      ) : null}

      {apiDown ? (
        <GlassCard className="border-amber-brand/50 text-center">
          <p className="font-semibold text-amber-brand">
            Data turnamen belum bisa dimuat.
          </p>
          <p className="mt-1 text-sm text-paper-dim">
            Server atau database mungkin belum siap — coba muat ulang halaman
            ini sebentar lagi.
          </p>
        </GlassCard>
      ) : null}

      {/* Turnamen live + upcoming */}
      <section aria-labelledby="turnamen-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2
            id="turnamen-heading"
            className="font-display text-3xl uppercase tracking-wide sm:text-4xl"
          >
            Turnamen <span className="text-amber-brand">Aktif</span>
          </h2>
          <Link
            href="/turnamen"
            className="shrink-0 text-sm font-bold text-amber-brand hover:underline"
          >
            Semua turnamen →
          </Link>
        </div>
        {live.length === 0 && upcoming.length === 0 ? (
          <EmptyState
            title="Belum Ada Turnamen Aktif"
            description="Belum ada turnamen yang dibuka atau sedang berlangsung. Pantau pengumuman di atas — turnamen berikutnya segera diumumkan."
            action={<ButtonLink href="/turnamen">Lihat Arsip Turnamen</ButtonLink>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {[...live, ...upcoming].slice(0, 4).map((t) => (
              <TournamentCard key={t.slug} t={t} />
            ))}
          </div>
        )}
      </section>

      {/* Juara terakhir */}
      {lastCompleted ? (
        <section aria-labelledby="juara-heading">
          <h2
            id="juara-heading"
            className="mb-4 font-display text-3xl uppercase tracking-wide sm:text-4xl"
          >
            Juara <span className="text-amber-brand">Terakhir</span>
          </h2>
          <GlassCard className="flex flex-col items-start gap-4 border-amber-brand/40 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge tone="amber">Champion</Badge>
              <p className="mt-3 font-display text-3xl uppercase leading-none tracking-wide sm:text-4xl">
                {championName ?? "Juara belum tercatat"}
              </p>
              <p className="mt-2 text-sm text-paper-dim">
                {lastCompleted.name} • Selesai
              </p>
            </div>
            <ButtonLink href={`/turnamen/${lastCompleted.slug}`} variant="ghost">
              Lihat Bracket
            </ButtonLink>
          </GlassCard>
        </section>
      ) : null}

      {/* Top 5 klasemen */}
      <section aria-labelledby="top-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2
            id="top-heading"
            className="font-display text-3xl uppercase tracking-wide sm:text-4xl"
          >
            Top 5 <span className="text-red-brand">Klasemen</span>
          </h2>
          <Link
            href="/klasemen"
            className="shrink-0 text-sm font-bold text-amber-brand hover:underline"
          >
            Klasemen lengkap →
          </Link>
        </div>
        {topFighters.length === 0 ? (
          <EmptyState
            title="Belum Ada Fighter"
            description="Jadilah fighter pertama di arena — buat fighter-mu dan daftarkan ke turnamen berikutnya."
            action={<ButtonLink href="/fighter-saya">Buat Fighter</ButtonLink>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topFighters.map((f, i) => (
              <FighterCard key={getId(f) || i} fighter={f} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* CTA penutup */}
      <section aria-label="Ajakan bergabung">
        <GlassCard
          strong
          className="animate-glow-pulse border-amber-brand/40 px-6 py-10 text-center"
        >
          <h2 className="font-display text-3xl uppercase leading-tight tracking-wide sm:text-5xl">
            Siap Naik <span className="text-amber-brand">Ring?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-paper-dim">
            Satu akun, satu fighter. Persona AI akan memberimu julukan, jurus
            andalan, dan warna khas — gratis, bisa di-regenerate sampai 3 kali.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/daftar" size="lg">
              Daftar Sekarang
            </ButtonLink>
            <ButtonLink href="/fighter-saya" variant="ghost" size="lg">
              Buat Fighter
            </ButtonLink>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
