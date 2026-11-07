import Link from "next/link";
import type { Metadata } from "next";
import { dataOr, serverApiGet } from "@/components/server-api";
import { getSession } from "@/lib/auth";
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
import GlobalChat from "@/components/GlobalChat";

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
  const [annRes, upcomingRes, liveRes, completedRes, topRes, session] =
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
      // Sesi dibaca server-side supaya CTA penutup tidak menawarkan
      // "Daftar" ke user yang sudah login. Gagal baca sesi (mis. secret
      // belum terkonfigurasi) dianggap belum login, bukan error halaman.
      getSession().catch(() => null),
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
        championName = champ.displayName;
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
          championName = fWinner.displayName;
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
          Buat fighter stickman-mu, daftarkan ke turnamen, dan biarkan undian
          menentukan nasibmu di ring. Kalah menang, tetap sportif — videonya
          tayang di Instagram.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/fighter-saya" size="lg">
            Buat Fighter-mu
          </ButtonLink>
          <ButtonLink href="/turnamen" variant="glass" size="lg">
            Lihat Turnamen
          </ButtonLink>
        </div>
        {/* 3 langkah mudah */}
        <ol className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          {[
            { n: "1", t: "Daftar Akun", d: "Gratis, cukup username + password." },
            { n: "2", t: "Buat Fighter", d: "Nama tampil, IG, gaya bertarung." },
            { n: "3", t: "Gabung Turnamen", d: "Satu klik, undian yang menentukan." },
          ].map((s) => (
            <li
              key={s.n}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <span className="font-display text-xl text-amber-brand">
                {s.n}
              </span>
              <p className="mt-1 font-semibold text-paper">{s.t}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-paper-mute">
                {s.d}
              </p>
            </li>
          ))}
        </ol>
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

      {/* Game 1v1 + gelar */}
      <section aria-labelledby="game-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2
            id="game-heading"
            className="font-display text-3xl uppercase tracking-wide sm:text-4xl"
          >
            Gelud <span className="text-amber-brand">1v1</span>
          </h2>
          <Link
            href="/tantangan"
            className="shrink-0 text-sm font-bold text-amber-brand hover:underline"
          >
            Semua tantangan →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassCard className="flex flex-col items-start gap-3">
            <Badge tone="red">Baru</Badge>
            <h3 className="font-display text-2xl uppercase leading-tight tracking-wide">
              Tantang Fighter Lain
            </h3>
            <p className="text-sm leading-relaxed text-paper-dim">
              Tantang siapa pun, terima tantangan yang masuk, lalu gelud
              langsung di Hub — 60 detik, hasil terverifikasi dari seed, foto
              poster untuk game biasa.
            </p>
            <ButtonLink href="/tantangan">Buka Tantangan →</ButtonLink>
          </GlassCard>
          <GlassCard className="flex flex-col items-start gap-3 border-amber-brand/40">
            <Badge tone="amber">Sabuk Juara</Badge>
            <h3 className="font-display text-2xl uppercase leading-tight tracking-wide">
              Perebutan Gelar
            </h3>
            <p className="text-sm leading-relaxed text-paper-dim">
              Menang 10 fight duluan saat gelar kosong untuk jadi juara.
              Holder yang kalah kehilangan sabuk; yang menang mempertahankannya.
            </p>
            <ButtonLink href="/gelar" variant="ghost">
              Lihat Gelar →
            </ButtonLink>
          </GlassCard>
        </div>
      </section>

      {/* Obrolan global */}
      <section aria-labelledby="chat-heading">
        <h2
          id="chat-heading"
          className="mb-4 font-display text-3xl uppercase tracking-wide sm:text-4xl"
        >
          Obrolan <span className="text-amber-brand">Global</span>
        </h2>
        <GlobalChat />
      </section>

      {/* CTA penutup — beda untuk yang sudah login vs belum.
          User yang sudah login tidak boleh ditawari "Daftar" lagi. */}
      <section aria-label="Ajakan bergabung">
        <GlassCard
          strong
          className="animate-glow-pulse border-amber-brand/40 px-6 py-10 text-center"
        >
          {session ? (
            <>
              <h2 className="font-display text-3xl uppercase leading-tight tracking-wide sm:text-5xl">
                Lanjut <span className="text-amber-brand">Bertarung?</span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-paper-dim">
                Kamu sudah masuk sebagai @{session.username}. Tantang lawan,
                rebut sabuk juara, atau cek fighter-mu — ring sudah
                menunggumu.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/tantangan" size="lg">
                  Tantang Lawan
                </ButtonLink>
                <ButtonLink href="/fighter-saya" variant="ghost" size="lg">
                  Lihat Fighter Saya
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl uppercase leading-tight tracking-wide sm:text-5xl">
                Siap Naik <span className="text-amber-brand">Ring?</span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-paper-dim">
                Satu akun, satu fighter. Isi nama tampil, username IG, dan gaya
                bertarungmu — lalu gabung turnamen dan biarkan undian menentukan
                nasibmu di ring.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/daftar" size="lg">
                  Daftar Sekarang
                </ButtonLink>
                <ButtonLink href="/fighter-saya" variant="ghost" size="lg">
                  Buat Fighter
                </ButtonLink>
              </div>
            </>
          )}
        </GlassCard>
      </section>
    </div>
  );
}
