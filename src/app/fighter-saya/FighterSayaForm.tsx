"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { clientApi, getId, MAX_REGEN, STYLE_OPTIONS } from "@/components/api";
import type { AiPersona, Fighter, SessionUser } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import { Input, Select, Textarea } from "@/components/Input";
import Button, { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import StatChip from "@/components/StatChip";

const EMPTY_PERSONA: AiPersona = {
  nickname: "",
  styleSummary: "",
  strengths: ["", ""],
  weakness: "",
  signatureMove: "",
  introLine: "",
  color: "#f5a623",
  gear: "",
};

type Phase = "loading" | "need-login" | "create" | "manage";

export default function FighterSayaForm() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [fighter, setFighter] = useState<Fighter | null>(null);
  const [loadError, setLoadError] = useState("");

  // Form identitas fighter
  const [displayName, setDisplayName] = useState("");
  const [igUsername, setIgUsername] = useState("");
  const [style, setStyle] = useState("street");
  const [styleOther, setStyleOther] = useState("");
  const [selfDescription, setSelfDescription] = useState("");

  // Persona (review/edit)
  const [persona, setPersona] = useState<AiPersona>(EMPTY_PERSONA);
  const [personaDirty, setPersonaDirty] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  const fillFromFighter = (f: Fighter) => {
    setFighter(f);
    setDisplayName(f.displayName);
    setIgUsername(f.igUsername);
    setStyle(f.style);
    setStyleOther(f.styleOther ?? "");
    setSelfDescription(f.selfDescription ?? "");
    setPersona(
      f.aiPersona ?? { ...EMPTY_PERSONA, strengths: ["", ""] },
    );
    setPersonaDirty(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const me = await clientApi<{ user: SessionUser }>("/api/auth/me");
      if (!alive) return;
      if (!me.ok) {
        setPhase("need-login");
        return;
      }
      setUser(me.data.user);
      // Cari fighter milik user dari daftar standings (belum ada endpoint /me).
      const list = await clientApi<{ fighters: Fighter[] }>(
        "/api/fighters?sort=wins",
      );
      if (!alive) return;
      if (!list.ok) {
        setLoadError(list.error.message);
        setPhase("create");
        return;
      }
      const mine = list.data.fighters.find(
        (f) => f.userId === me.data.user.id,
      );
      if (mine) {
        fillFromFighter(mine);
        setPhase("manage");
      } else {
        setPhase("create");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const validateIdentity = (): boolean => {
    const e: Record<string, string> = {};
    if (displayName.trim().length < 1 || displayName.trim().length > 30) {
      e.displayName = "Nama tampil 1–30 karakter.";
    }
    if (!/^[A-Za-z0-9._]{1,30}$/.test(igUsername.trim())) {
      e.igUsername = "Username IG 1–30 karakter (huruf, angka, titik, underscore).";
    }
    if (style === "other" && styleOther.trim().length === 0) {
      e.styleOther = "Isi gaya bertarungmu jika memilih Lainnya.";
    }
    if (
      selfDescription.trim().length < 1 ||
      selfDescription.trim().length > 600
    ) {
      e.selfDescription =
        "Deskripsi diri maks 600 karakter. Ceritakan siapa kamu dan kenapa kamu bertarung.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const createFighter = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateIdentity()) return;
    setBusy(true);
    setError("");
    const res = await clientApi<{ fighter: Fighter }>("/api/fighters", {
      method: "POST",
      body: JSON.stringify({
        displayName: displayName.trim(),
        igUsername: igUsername.trim(),
        style,
        styleOther: style === "other" ? styleOther.trim() : undefined,
        selfDescription: selfDescription.trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.status === 409) {
        setError("Kamu sudah punya fighter aktif. Muat ulang halaman ini.");
      } else {
        setError(res.error.message);
      }
      return;
    }
    fillFromFighter(res.data.fighter);
    setPhase("manage");
    setNotice("Fighter berhasil dibuat! Sekarang generate persona AI-mu.");
  };

  const saveIdentity = async (e: FormEvent) => {
    e.preventDefault();
    if (!fighter || !validateIdentity()) return;
    setBusy(true);
    setError("");
    const res = await clientApi<{ fighter: Fighter }>(
      `/api/fighters/${getId(fighter)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          displayName: displayName.trim(),
          igUsername: igUsername.trim(),
          style,
          styleOther: style === "other" ? styleOther.trim() : undefined,
          selfDescription: selfDescription.trim(),
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    fillFromFighter(res.data.fighter);
    setNotice("Data fighter tersimpan.");
  };

  const generatePersona = async () => {
    if (!fighter) return;
    setGenBusy(true);
    setError("");
    const res = await clientApi<{ fighter: Fighter; regenLeft: number }>(
      `/api/fighters/${getId(fighter)}/ai-generate`,
      { method: "POST" },
    );
    setGenBusy(false);
    if (!res.ok) {
      if (res.error.status === 429) {
        setError("Jatah regenerate persona sudah habis (maksimal 3 kali).");
      } else if (res.error.status === 503) {
        setError(
          "AI belum dikonfigurasi di server. Persona bisa dibuat manual di bawah — isi lalu simpan.",
        );
      } else {
        setError(res.error.message);
      }
      return;
    }
    fillFromFighter(res.data.fighter);
    setNotice("Persona AI berhasil dibuat! Tinjau dan edit bila perlu, lalu simpan.");
  };

  const savePersona = async (e: FormEvent) => {
    e.preventDefault();
    if (!fighter) return;
    if (persona.strengths.some((s) => s.trim().length === 0)) {
      setError("Persona harus punya tepat 2 kekuatan — isi keduanya.");
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(persona.color)) {
      setError("Warna harus format hex, contoh #f5a623.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await clientApi<{ fighter: Fighter }>(
      `/api/fighters/${getId(fighter)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          nickname: persona.nickname.trim(),
          styleSummary: persona.styleSummary.trim(),
          strengths: persona.strengths.map((s) => s.trim()),
          weakness: persona.weakness.trim(),
          signatureMove: persona.signatureMove.trim(),
          introLine: persona.introLine.trim(),
          color: persona.color,
          gear: persona.gear.trim(),
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    fillFromFighter(res.data.fighter);
    setNotice("Persona tersimpan.");
  };

  if (phase === "loading") {
    return (
      <div className="space-y-4" role="status" aria-label="Memuat…">
        <div className="glass h-24 animate-pulse" />
        <div className="glass h-64 animate-pulse" />
      </div>
    );
  }

  if (phase === "need-login") {
    return (
      <EmptyState
        title="Masuk Dulu, Darling"
        description="Kamu harus masuk untuk membuat dan mengelola fighter-mu."
        action={
          <div className="flex gap-3">
            <ButtonLink href="/masuk">Masuk</ButtonLink>
            <ButtonLink href="/daftar" variant="ghost">
              Daftar Akun
            </ButtonLink>
          </div>
        }
      />
    );
  }

  const regenLeft = MAX_REGEN - (fighter?.regenCount ?? 0);
  const record = fighter?.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };

  return (
    <div className="space-y-8">
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-400"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-brand/50 bg-red-brand/10 px-4 py-3 text-sm font-semibold text-red-400"
        >
          {error}
        </p>
      ) : null}
      {loadError ? (
        <p className="text-sm text-paper-mute">
          Catatan: daftar fighter tidak bisa dimuat ({loadError}) — form buat
          fighter tetap bisa dipakai.
        </p>
      ) : null}

      {/* Kartu identitas fighter */}
      <section aria-labelledby="identitas-heading">
        <h2
          id="identitas-heading"
          className="mb-4 font-display text-2xl uppercase tracking-wide sm:text-3xl"
        >
          {phase === "create" ? "Buat Fighter-mu" : "Fighter Saya"}
        </h2>

        {phase === "manage" && fighter ? (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip label="Menang" value={record.wins} tone="amber" />
            <StatChip label="Kalah" value={record.losses} tone="red" />
            <StatChip label="Seri" value={record.draws} tone="paper" />
            <StatChip label="KO" value={record.kos} tone="red" />
          </div>
        ) : null}

        <GlassCard strong>
          <form
            onSubmit={phase === "create" ? createFighter : saveIdentity}
            className="space-y-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="displayName"
                label="Nama Tampil"
                hint="1–30 karakter. Nama yang dilihat penonton."
                error={errors.displayName}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="contoh: Si Jagoan Semarang"
                maxLength={30}
                required
              />
              <Input
                id="igUsername"
                label="Username Instagram (tanpa @)"
                hint="Dipakai untuk menautkan Reel pertarunganmu."
                error={errors.igUsername}
                value={igUsername}
                onChange={(e) => setIgUsername(e.target.value.replace(/^@/, ""))}
                placeholder="contoh: jagoan.smg"
                maxLength={30}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="style"
                label="Gaya Bertarung"
                options={STYLE_OPTIONS}
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              />
              {style === "other" ? (
                <Input
                  id="styleOther"
                  label="Sebutkan Gayamu"
                  error={errors.styleOther}
                  value={styleOther}
                  onChange={(e) => setStyleOther(e.target.value)}
                  placeholder="contoh: Kung Fu Mabuk"
                  maxLength={30}
                />
              ) : null}
            </div>
            <Textarea
              id="selfDescription"
              label="Deskripsi Diri (maks 600 karakter)"
              hint="Ceritakan siapa kamu, dari mana, dan kenapa kamu bertarung. AI memakai ini untuk membuat persona."
              error={errors.selfDescription}
              value={selfDescription}
              onChange={(e) => setSelfDescription(e.target.value)}
              placeholder="Aku anak Semarang yang tiap sore latihan di gang rumah…"
              maxLength={600}
              required
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Menyimpan…"
                  : phase === "create"
                    ? "Buat Fighter"
                    : "Simpan Perubahan"}
              </Button>
              {phase === "manage" && fighter ? (
                <Link
                  href={`/fighter/${getId(fighter)}`}
                  className="text-sm font-semibold text-amber-brand hover:underline"
                >
                  Lihat profil publik →
                </Link>
              ) : null}
            </div>
          </form>
        </GlassCard>
      </section>

      {/* Persona AI — hanya setelah fighter dibuat */}
      {phase === "manage" && fighter ? (
        <section aria-labelledby="persona-heading">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2
              id="persona-heading"
              className="font-display text-2xl uppercase tracking-wide sm:text-3xl"
            >
              Persona AI
            </h2>
            {fighter.aiPersona ? (
              <Badge tone="amber">Persona Aktif</Badge>
            ) : (
              <Badge tone="outline">Belum Ada Persona</Badge>
            )}
            <span className="ml-auto text-sm text-paper-mute">
              Sisa regenerate: <strong className="text-amber-brand">{regenLeft}</strong> dari {MAX_REGEN}
            </span>
          </div>

          <GlassCard strong className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="cyan"
                onClick={generatePersona}
                disabled={genBusy || regenLeft <= 0}
              >
                {genBusy
                  ? "AI sedang berpikir…"
                  : fighter.aiPersona
                    ? "Regenerate Persona (AI)"
                    : "Generate Persona (AI)"}
              </Button>
              {regenLeft <= 0 ? (
                <p className="self-center text-xs text-paper-mute">
                  Jatah regenerate habis — persona masih bisa diedit manual
                  lalu disimpan.
                </p>
              ) : null}
            </div>

            <form onSubmit={savePersona} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="nickname"
                  label="Julukan"
                  value={persona.nickname}
                  onChange={(e) => {
                    setPersona({ ...persona, nickname: e.target.value });
                    setPersonaDirty(true);
                  }}
                  placeholder="contoh: Si Petir Semarang"
                  maxLength={60}
                />
                <div>
                  <label
                    htmlFor="color"
                    className="mb-1.5 block text-sm font-semibold text-paper"
                  >
                    Warna Khas
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="color"
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(persona.color) ? persona.color : "#f5a623"}
                      onChange={(e) => {
                        setPersona({ ...persona, color: e.target.value });
                        setPersonaDirty(true);
                      }}
                      className="h-[44px] w-[64px] cursor-pointer rounded-xl border border-white/15 bg-white/5 p-1"
                      aria-label="Pilih warna khas"
                    />
                    <code className="text-sm text-paper-dim">{persona.color}</code>
                  </div>
                </div>
              </div>
              <Textarea
                id="styleSummary"
                label="Ringkasan Gaya (1 kalimat)"
                value={persona.styleSummary}
                onChange={(e) => {
                  setPersona({ ...persona, styleSummary: e.target.value });
                  setPersonaDirty(true);
                }}
                placeholder="Petarung cepat yang mengandalkan tendangan berputar."
                rows={2}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="strength1"
                  label="Kekuatan 1"
                  value={persona.strengths[0] ?? ""}
                  onChange={(e) => {
                    const next = [...persona.strengths];
                    next[0] = e.target.value;
                    setPersona({ ...persona, strengths: next });
                    setPersonaDirty(true);
                  }}
                  placeholder="contoh: Tendangan cepat"
                  maxLength={60}
                />
                <Input
                  id="strength2"
                  label="Kekuatan 2"
                  value={persona.strengths[1] ?? ""}
                  onChange={(e) => {
                    const next = [...persona.strengths];
                    next[1] = e.target.value;
                    setPersona({ ...persona, strengths: next });
                    setPersonaDirty(true);
                  }}
                  placeholder="contoh: Stamina baja"
                  maxLength={60}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="weakness"
                  label="Kelemahan"
                  value={persona.weakness}
                  onChange={(e) => {
                    setPersona({ ...persona, weakness: e.target.value });
                    setPersonaDirty(true);
                  }}
                  placeholder="contoh: Mudah terpancing emosi"
                  maxLength={80}
                />
                <Input
                  id="signatureMove"
                  label="Jurus Andalan"
                  value={persona.signatureMove}
                  onChange={(e) => {
                    setPersona({ ...persona, signatureMove: e.target.value });
                    setPersonaDirty(true);
                  }}
                  placeholder="contoh: Tendangan Tornado"
                  maxLength={60}
                />
              </div>
              <Input
                id="introLine"
                label="Kalimat Pembuka (intro line)"
                value={persona.introLine}
                onChange={(e) => {
                  setPersona({ ...persona, introLine: e.target.value });
                  setPersonaDirty(true);
                }}
                placeholder="contoh: Aku datang bukan untuk kalah."
                maxLength={120}
              />
              <Input
                id="gear"
                label="Perlengkapan Khas"
                value={persona.gear}
                onChange={(e) => {
                  setPersona({ ...persona, gear: e.target.value });
                  setPersonaDirty(true);
                }}
                placeholder="contoh: Sarung tangan merah + bandana hitam"
                maxLength={80}
              />
              <Button type="submit" disabled={busy || !personaDirty}>
                {busy ? "Menyimpan…" : "Simpan Persona"}
              </Button>
              <p className="text-xs text-paper-mute">
                Persona yang kamu edit di sini akan tampil di profil publik
                dan kartu fighter-mu. Regenerate AI akan menimpa isi di atas.
              </p>
            </form>
          </GlassCard>
        </section>
      ) : null}

      <p className="text-center text-sm text-paper-mute">
        Akun login sebagai{" "}
        <strong className="text-paper">@{user?.username ?? "—"}</strong>. Satu
        akun hanya bisa punya satu fighter aktif.
      </p>
    </div>
  );
}
