"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { clientApi, getId, STYLE_OPTIONS } from "@/components/api";
import type { Fighter, SessionUser } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import { Input, Select, Textarea } from "@/components/Input";
import Button, { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import StatChip from "@/components/StatChip";

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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fillFromFighter = (f: Fighter) => {
    setFighter(f);
    setDisplayName(f.displayName);
    setIgUsername(f.igUsername);
    setStyle(f.style);
    setStyleOther(f.styleOther ?? "");
    setSelfDescription(f.selfDescription ?? "");
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
    setNotice("Fighter berhasil dibuat! Langkah berikutnya: gabung turnamen.");
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
              hint="Ceritakan siapa kamu, dari mana, dan kenapa kamu bertarung."
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
                <>
                  <ButtonLink href="/turnamen" variant="cyan">
                    Gabung Turnamen →
                  </ButtonLink>
                  <Link
                    href={`/fighter/${getId(fighter)}`}
                    className="text-sm font-semibold text-amber-brand hover:underline"
                  >
                    Lihat profil publik →
                  </Link>
                </>
              ) : null}
            </div>
          </form>
        </GlassCard>
      </section>

      <p className="text-center text-sm text-paper-mute">
        Akun login sebagai{" "}
        <strong className="text-paper">@{user?.username ?? "—"}</strong>. Satu
        akun hanya bisa punya satu fighter aktif.
      </p>
    </div>
  );
}
