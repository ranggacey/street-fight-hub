"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clientApi,
  formatWIB,
  getId,
  METHOD_LABELS,
  styleLabel,
} from "@/components/api";
import type {
  Fighter,
  GameFight,
  SessionUser,
  TitlePublic,
} from "@/components/types";
import { summarizeMyFight } from "@/lib/profile";
import FighterPreview from "@/components/FighterPreview";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import BackToHome from "@/components/BackToHome";

/** Warna fallback preview — sama dengan DEFAULT_COLORS form fighter-saya. */
const DEFAULT_COLORS = {
  body: "#f97316",
  gloves: "#141210",
  shoes: "#FBF8F1",
  belt: "none",
  headband: "none",
  weapon: "#8B5E34",
};

type Phase = "loading" | "need-login" | "no-fighter" | "ready" | "error";

const RESULT_TONE: Record<string, "green" | "red" | "neutral" | "amber"> = {
  win: "green",
  loss: "red",
  draw: "neutral",
};

const RESULT_LABEL: Record<string, string> = {
  win: "Menang",
  loss: "Kalah",
  draw: "Seri",
};

export default function ProfilClient() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [fighter, setFighter] = useState<Fighter | null>(null);
  const [fights, setFights] = useState<GameFight[]>([]);
  const [fightsRemaining, setFightsRemaining] = useState<number | null>(null);
  const [title, setTitle] = useState<TitlePublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Pola yang sama dengan FighterSayaForm: sesi dulu, lalu cari
      // fighter milik user dari daftar (belum ada endpoint /me).
      const me = await clientApi<{ user: SessionUser }>("/api/auth/me");
      if (!alive) return;
      if (!me.ok) {
        setPhase("need-login");
        return;
      }
      setUser(me.data.user);
      const [listRes, mineRes, titleRes] = await Promise.all([
        clientApi<{ fighters: Fighter[] }>("/api/fighters?sort=wins"),
        // Riwayat fight kasual + sisa jatah hari ini (sudah ada endpoint-nya).
        clientApi<{
          fights: GameFight[];
          fightsRemaining: number;
          hasFighter: boolean;
        }>("/api/fights/mine"),
        clientApi<{ title: TitlePublic }>("/api/title"),
      ]);
      if (!alive) return;
      if (titleRes.ok) setTitle(titleRes.data.title);
      if (mineRes.ok) {
        setFights(mineRes.data.fights ?? []);
        setFightsRemaining(mineRes.data.fightsRemaining);
      }
      if (!listRes.ok) {
        setLoadError(listRes.error.message);
        setPhase("error");
        return;
      }
      const mine = listRes.data.fighters.find(
        (f) => f.userId === me.data.user.id,
      );
      if (!mine) {
        setPhase("no-fighter");
        return;
      }
      setFighter(mine);
      setPhase("ready");
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (phase === "loading") {
    return (
      <div className="space-y-6" aria-busy="true">
        <BackToHome />
        <p className="text-paper-dim">Memuat profil…</p>
        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  if (phase === "need-login") {
    return (
      <div className="space-y-6">
        <BackToHome />
        <EmptyState
          title="Masuk dulu untuk melihat profil"
          description="Profil menampilkan akun, fighter, statistik, dan riwayat fight-mu. Masuk atau daftar dulu — gratis."
          action={
            <div className="flex gap-3">
              <ButtonLink href="/masuk">Masuk</ButtonLink>
              <ButtonLink href="/daftar" variant="ghost">
                Daftar
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-6">
        <BackToHome />
        <EmptyState
          title="Profil belum bisa dimuat"
          description={loadError ?? "Server atau database mungkin belum siap — coba muat ulang sebentar lagi."}
          action={
            <ButtonLink href="/profil" variant="ghost">
              Muat Ulang
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (phase === "no-fighter") {
    return (
      <div className="space-y-6">
        <BackToHome />
        <GlassCard>
          <p className="text-sm text-paper-mute">Akun</p>
          <p className="mt-1 font-display text-2xl uppercase tracking-wide">
            @{user?.username}
          </p>
          <p className="mt-1 text-sm text-paper-dim">
            Peran: {user?.role === "admin" ? "Admin" : "Fighter"}
          </p>
        </GlassCard>
        <EmptyState
          title="Kamu belum punya fighter"
          description="Buat fighter dulu — nama tampil, username IG, gaya bertarung, warna, dan aksesoris — baru statistik dan riwayat fight muncul di sini."
          action={<ButtonLink href="/fighter-saya">Buat Fighter</ButtonLink>}
        />
      </div>
    );
  }

  // phase === "ready"
  // SATU rekor (record) untuk semua fight — kasual, turnamen, gelar.
  const record = fighter?.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };
  const myId = fighter ? getId(fighter) : "";
  const isHolder = !!title?.holder && title.holder.id === myId;
  const summaries = fights
    .slice(0, 10)
    .map((f) => summarizeMyFight(f, myId));
  const colors = { ...DEFAULT_COLORS, ...(fighter?.colors ?? {}) };

  return (
    <div className="space-y-6">
      <BackToHome />

      {/* Kartu identitas: preview fighter + nama + rating. */}
      <GlassCard strong className="border-amber-brand/40">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="mx-auto w-full max-w-[220px] shrink-0 sm:mx-0">
            {fighter ? (
              <FighterPreview
                colors={colors}
                accessories={fighter.accessories ?? null}
                name={fighter.displayName}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm text-paper-mute">Profil fighter</p>
            <h1 className="mt-1 font-display text-4xl uppercase leading-none tracking-wide sm:text-5xl">
              {fighter?.displayName}
            </h1>
            <p className="mt-2 text-base font-semibold text-paper-dim">
              @{user?.username}
              {fighter?.igUsername ? (
                <>
                  {" • IG "}
                  <a
                    href={`https://www.instagram.com/${fighter.igUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-brand hover:underline"
                  >
                    @{fighter.igUsername}
                  </a>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-paper-dim">
              {styleLabel(fighter?.style, fighter?.styleOther)}
              {fighter?.tempo ? ` • Tempo ${fighter.tempo}` : ""}
              {fighter?.signatureMove
                ? ` • Jurus khas: ${fighter.signatureMove}`
                : ""}
            </p>
            {fighter?.selfDescription ? (
              <p className="mt-3 text-sm leading-relaxed text-paper-dim">
                {fighter.selfDescription}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-full border border-amber-brand/50 bg-amber-brand/15 px-3 py-1.5 text-sm font-bold text-amber-brand">
                Rating {fighter?.rating ?? 1000}
              </span>
              {isHolder ? (
                <Badge tone="amber">Pemegang Gelar Juara</Badge>
              ) : null}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/fighter-saya">
                Ubah Warna &amp; Aksesoris
              </ButtonLink>
              <ButtonLink href="/tantangan" variant="ghost">
                Tantang Lawan
              </ButtonLink>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Statistik (SATU rekor untuk semua fight) */}
      <section aria-labelledby="stat-kasual">
        <h2
          id="stat-kasual"
          className="mb-3 font-display text-2xl uppercase tracking-wide sm:text-3xl"
        >
          Statistik <span className="text-amber-brand">Fighter</span>
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Rating Point", value: String(fighter?.rating ?? 1000) },
            { label: "Menang", value: String(record.wins) },
            { label: "Kalah", value: String(record.losses) },
            { label: "Seri", value: String(record.draws) },
            { label: "KO", value: String(record.kos) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center"
            >
              <dd className="font-display text-3xl text-paper">{s.value}</dd>
              <dt className="mt-1 text-xs font-semibold text-paper-mute">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
        {fightsRemaining !== null ? (
          <p className="mt-3 text-sm text-paper-dim">
            Sisa jatah fight hari ini: {fightsRemaining}
          </p>
        ) : null}
      </section>

      {/* Gelar */}
      <section aria-labelledby="gelar-saya">
        <h2
          id="gelar-saya"
          className="mb-3 font-display text-2xl uppercase tracking-wide sm:text-3xl"
        >
          Gelar <span className="text-amber-brand">Juara</span>
        </h2>
        <GlassCard
          className={
            isHolder ? "border-amber-brand/50" : undefined
          }
        >
          {isHolder ? (
            <p className="text-sm leading-relaxed text-paper">
              Kamu sedang memegang sabuk juara
              {title?.defenses ? ` — sudah ${title.defenses} kali bertahan` : ""}
              . Kalah sekali, gelar pindah ke pemenang; 6 hari tidak bertarung,
              gelar kosong.
            </p>
          ) : title?.holder ? (
            <p className="text-sm leading-relaxed text-paper-dim">
              Gelar sedang dipegang{" "}
              <span className="font-bold text-paper">
                {title.holder.displayName ?? "—"}
              </span>
              . Menang 10 fight duluan saat gelar kosong untuk merebutnya.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-paper-dim">
              Gelar sedang kosong — menang 10 fight duluan untuk merebutnya.
            </p>
          )}
          <div className="mt-3">
            <Link
              href="/gelar"
              className="text-sm font-bold text-amber-brand hover:underline"
            >
              Lihat halaman gelar →
            </Link>
          </div>
        </GlassCard>
      </section>

      {/* Riwayat fight */}
      <section aria-labelledby="riwayat">
        <h2
          id="riwayat"
          className="mb-3 font-display text-2xl uppercase tracking-wide sm:text-3xl"
        >
          Riwayat <span className="text-amber-brand">Fight</span>
        </h2>
        {summaries.length === 0 ? (
          <EmptyState
            title="Belum ada fight"
            description="Kamu belum pernah gelud 1v1 di Hub. Tantang fighter lain dan hasil fight-mu akan tercatat di sini."
            action={<ButtonLink href="/tantangan">Buka Tantangan</ButtonLink>}
          />
        ) : (
          <ol className="space-y-2">
            {summaries.map((s) => (
              <li key={s.fightId}>
                <Link
                  href={`/game/${s.fightId}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-amber-brand/50 hover:bg-white/10"
                >
                  {s.result ? (
                    <Badge tone={RESULT_TONE[s.result] ?? "neutral"}>
                      {RESULT_LABEL[s.result]}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Belum selesai</Badge>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-paper">
                      vs {s.opponentName}
                      {s.isTitleFight ? (
                        <span className="ml-2 text-xs font-bold text-amber-brand">
                          Perebutan Gelar
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-paper-mute">
                      {s.method ? METHOD_LABELS[s.method] ?? s.method : "—"}
                      {s.score ? ` • ${s.score.a} - ${s.score.b}` : ""}
                      {s.method === "KO" && s.koTimeSec != null
                        ? ` • KO ${s.koTimeSec} dtk`
                        : ""}
                      {s.playedAt ? ` • ${formatWIB(s.playedAt)}` : ""}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-amber-brand">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
