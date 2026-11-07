"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  clientApi,
  getId,
  moveLabel,
  STYLE_OPTIONS,
  styleColor,
  styleLabel,
  TEMPO_OPTIONS,
} from "@/components/api";
import { signatureMoveOptions } from "@/lib/game/engine-config";
import type { Fighter, SessionUser } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import FighterPreview, {
  COLOR_PRESETS,
  ItemIcon,
  type ColorPart,
} from "@/components/FighterPreview";
import { Input, Select, Textarea } from "@/components/Input";
import Button, { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import StatChip from "@/components/StatChip";
import Badge from "@/components/Badge";

type Phase = "loading" | "need-login" | "create" | "manage";

type ColorsState = {
  body: string;
  gloves: string;
  shoes: string;
  belt: string;
  headband: string;
  weapon: string;
};

const DEFAULT_COLORS: ColorsState = {
  body: "#f97316",
  gloves: "#141210",
  shoes: "#FBF8F1",
  belt: "none",
  headband: "none",
  weapon: "#8B5E34",
};

const COLOR_FIELDS: { key: keyof ColorsState; label: string; noneable: boolean }[] = [
  { key: "body", label: "Badan", noneable: false },
  { key: "gloves", label: "Sarung tangan", noneable: false },
  { key: "shoes", label: "Sepatu", noneable: false },
  { key: "belt", label: "Sabuk", noneable: true },
  { key: "headband", label: "Ikat kepala", noneable: true },
  { key: "weapon", label: "Senjata", noneable: true },
];

/**
 * Pemilih warna satu item secara VISUAL: ikon item + grid banyak
 * pilihan warna preset yang bisa di-tap + color picker RGB bebas +
 * kolom hex + toggle Pakai/Tidak pakai (untuk item yang boleh kosong).
 * Pemilihan dilakukan dengan men-tap pilihan di dalam picker.
 */
function ColorField({
  part,
  label,
  value,
  noneable,
  onChange,
}: {
  part: ColorPart;
  label: string;
  value: string;
  noneable: boolean;
  onChange: (v: string) => void;
}) {
  const isNone = value === "none";
  const selected = isNone ? "" : value.toLowerCase();
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      {/* Baris item: ikon + nama + nilai saat ini */}
      <div className="flex items-center gap-2.5">
        <ItemIcon part={part} color={value} />
        <span className="min-w-0 flex-1 text-sm font-semibold text-paper">
          {label}
        </span>
        <span
          className="shrink-0 rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[11px] text-paper-mute"
          aria-label={`Warna ${label} saat ini: ${isNone ? "tidak dipakai" : value}`}
        >
          {isNone ? "tidak dipakai" : value}
        </span>
      </div>

      {/* Grid pilihan warna preset — tap untuk memilih */}
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label={`Pilihan warna ${label}`}
      >
        {COLOR_PRESETS.map((p) => {
          const active = !isNone && selected === p.hex.toLowerCase();
          return (
            <button
              key={p.hex}
              type="button"
              onClick={() => onChange(p.hex)}
              disabled={isNone}
              aria-label={`Warna ${label}: ${p.name} ${p.hex}`}
              aria-pressed={active}
              title={`${p.name} ${p.hex}`}
              className={`h-8 w-8 rounded-full border transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-amber-brand disabled:cursor-not-allowed disabled:opacity-30 ${
                active
                  ? "scale-110 border-white ring-2 ring-amber-brand ring-offset-2 ring-offset-ink-950"
                  : "border-white/30 hover:scale-110"
              }`}
              style={{ backgroundColor: p.hex }}
            />
          );
        })}
      </div>

      {/* Warna bebas (RGB) + hex + toggle pakai */}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="color"
          value={isNone ? "#8B5E34" : value}
          disabled={isNone}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Warna bebas ${label}`}
          className="h-[44px] w-[52px] shrink-0 cursor-pointer rounded-xl border border-white/15 bg-white/5 p-1 disabled:opacity-40"
        />
        <input
          type="text"
          value={isNone ? "none" : value}
          disabled={isNone}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v || "#000000");
          }}
          aria-label={`Kode hex ${label}`}
          placeholder="#RRGGBB"
          maxLength={7}
          className="min-h-[44px] w-full min-w-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 font-mono text-sm text-paper placeholder:text-paper-mute focus:border-amber-brand focus:outline-none focus:ring-2 focus:ring-amber-brand/40 disabled:opacity-50"
        />
        {noneable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(isNone ? "#8B5E34" : "none")}
            aria-pressed={isNone}
          >
            {isNone ? "Pakai" : "Tidak pakai"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function FighterSayaForm() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [fighter, setFighter] = useState<Fighter | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);

  // Form identitas fighter
  const [displayName, setDisplayName] = useState("");
  const [igUsername, setIgUsername] = useState("");
  const [style, setStyle] = useState("street");
  const [styleOther, setStyleOther] = useState("");
  const [selfDescription, setSelfDescription] = useState("");

  // Field game (Fase 1)
  const [signatureMove, setSignatureMove] = useState("");
  const [tempo, setTempo] = useState("seimbang");
  const [colors, setColors] = useState<ColorsState>(DEFAULT_COLORS);

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
    setSignatureMove(f.signatureMove ?? "");
    setTempo(f.tempo ?? "seimbang");
    setColors({
      body: f.colors?.body ?? styleColor(f.style),
      gloves: f.colors?.gloves ?? DEFAULT_COLORS.gloves,
      shoes: f.colors?.shoes ?? DEFAULT_COLORS.shoes,
      belt: f.colors?.belt ?? DEFAULT_COLORS.belt,
      headband: f.colors?.headband ?? DEFAULT_COLORS.headband,
      weapon: f.colors?.weapon ?? DEFAULT_COLORS.weapon,
    });
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

  const moveOptions = signatureMoveOptions(style);

  const changeStyle = (next: string) => {
    // Ganti gaya → jurus khas direset (daftar gerakan tiap gaya beda);
    // warna badan ikut warna khas gaya baru kalau masih warna gaya lama.
    setColors((c) =>
      c.body === styleColor(style) ? { ...c, body: styleColor(next) } : c,
    );
    setStyle(next);
    setSignatureMove("");
  };

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
    if (signatureMove && !moveOptions.some((o) => o.kind === signatureMove)) {
      e.signatureMove = "Jurus khas tidak ada di gaya ini.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const gamePayload = () => ({
    signatureMove: signatureMove || null,
    tempo,
    colors,
  });

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
        ...gamePayload(),
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
    setEditing(false);
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
          ...gamePayload(),
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    fillFromFighter(res.data.fighter);
    setEditing(false);
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
  const casual = fighter?.casualRecord ?? { wins: 0, losses: 0, draws: 0, kos: 0 };

  // Form (dipakai buat baru + edit). Di mode manage, form disembunyikan
  // sampai tombol "Ubah / Customize" ditekan.
  const form = (
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
            onChange={(e) => changeStyle(e.target.value)}
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

        {/* Jurus khas + tempo */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="signatureMove"
            label="Jurus Khas (bobot 2.5x di arena)"
            hint="Gerakan andalanmu — lebih sering keluar saat fight."
            error={errors.signatureMove}
            options={[
              { value: "", label: "— Tanpa jurus khas —" },
              ...moveOptions.map((o) => ({ value: o.kind, label: o.label })),
            ]}
            value={signatureMove}
            onChange={(e) => setSignatureMove(e.target.value)}
          />
          <Select
            id="tempo"
            label="Tempo Bertarung"
            options={TEMPO_OPTIONS}
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
          />
        </div>

        {/* Warna RGB bebas per bagian — dengan preview karakter live */}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-paper">
            Warna Fighter (RGB bebas — tampil di arena)
          </legend>
          <p className="mb-3 text-xs text-paper-mute">
            Tap salah satu warna di tiap item untuk memilihnya, atau atur
            sendiri lewat color picker dan kode hex (#RRGGBB). Preview di
            bawah berubah langsung. Sabuk, ikat kepala, dan senjata boleh
            tidak dipakai.
          </p>
          <div className="mb-4">
            <FighterPreview colors={colors} name={displayName} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {COLOR_FIELDS.map((f) => (
              <ColorField
                key={f.key}
                part={f.key}
                label={f.label}
                value={colors[f.key]}
                noneable={f.noneable}
                onChange={(v) => setColors((c) => ({ ...c, [f.key]: v }))}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy
              ? "Menyimpan…"
              : phase === "create"
                ? "Buat Fighter"
                : "Simpan Perubahan"}
          </Button>
          {phase === "manage" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (fighter) fillFromFighter(fighter);
                setEditing(false);
              }}
            >
              Batal
            </Button>
          ) : null}
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
  );

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
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatChip label="Menang" value={record.wins} tone="amber" />
              <StatChip label="Kalah" value={record.losses} tone="red" />
              <StatChip label="Seri" value={record.draws} tone="paper" />
              <StatChip label="KO" value={record.kos} tone="red" />
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatChip label="Rating" value={fighter.rating ?? 1000} tone="cyan" />
              <StatChip label="Menang Kasual" value={casual.wins} tone="amber" />
              <StatChip label="Kalah Kasual" value={casual.losses} tone="red" />
              <StatChip label="KO Kasual" value={casual.kos} tone="red" />
            </div>
          </>
        ) : null}

        {phase === "manage" && fighter && !editing ? (
          <GlassCard strong>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div
                  className="h-2 w-full rounded-full"
                  style={{ backgroundColor: styleColor(fighter.style) }}
                  aria-hidden="true"
                />
                <p className="mt-4 font-display text-3xl uppercase leading-none tracking-wide">
                  {fighter.displayName}
                </p>
                <p className="mt-1 text-sm text-paper-mute">
                  @{fighter.igUsername} • {styleLabel(fighter.style, fighter.styleOther)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {fighter.signatureMove ? (
                    <Badge tone="amber">
                      Jurus: {moveLabel(fighter.signatureMove)}
                    </Badge>
                  ) : null}
                  <Badge tone="cyan">Tempo: {fighter.tempo ?? "seimbang"}</Badge>
                </div>
                {/* Swatch warna */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-paper-mute">
                    Warna:
                  </span>
                  {(Object.keys(DEFAULT_COLORS) as (keyof ColorsState)[]).map(
                    (k) => {
                      const v = fighter.colors?.[k] ?? DEFAULT_COLORS[k];
                      if (v === "none") return null;
                      return (
                        <span
                          key={k}
                          title={`${k}: ${v}`}
                          className="inline-block h-6 w-6 rounded-full border border-white/30"
                          style={{ backgroundColor: v }}
                        />
                      );
                    },
                  )}
                </div>
                {fighter.selfDescription ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-paper-dim">
                    {fighter.selfDescription}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Button onClick={() => setEditing(true)}>
                  Ubah / Customize
                </Button>
                <ButtonLink href="/tantangan" variant="glass">
                  Tantang Orang →
                </ButtonLink>
                <ButtonLink href="/gelar" variant="ghost">
                  Lihat Gelar →
                </ButtonLink>
              </div>
            </div>
          </GlassCard>
        ) : (
          form
        )}
      </section>

      <p className="text-center text-sm text-paper-mute">
        Akun login sebagai{" "}
        <strong className="text-paper">@{user?.username ?? "—"}</strong>. Satu
        akun hanya bisa punya satu fighter aktif.
      </p>
    </div>
  );
}
