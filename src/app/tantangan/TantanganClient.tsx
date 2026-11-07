"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clientApi,
  formatWIB,
  getId,
  MAP_LABELS,
  MAP_OPTIONS,
  styleLabel,
} from "@/components/api";
import type {
  Challenge,
  Fighter,
  FighterSummary,
  SessionUser,
} from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import Button, { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { Select, Textarea } from "@/components/Input";

type ChallengesResponse = {
  challenges: Challenge[];
  sentToday: number;
  sentRemaining: number;
  fightsRemaining: number;
  hasFighter: boolean;
};

function fighterName(
  v: string | FighterSummary | undefined,
): string {
  if (!v || typeof v === "string") return "—";
  return v.displayName;
}

export default function TantanganClient() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [myFighter, setMyFighter] = useState<Fighter | null>(null);
  const [incoming, setIncoming] = useState<Challenge[]>([]);
  const [outgoing, setOutgoing] = useState<Challenge[]>([]);
  const [allFighters, setAllFighters] = useState<Fighter[]>([]);
  const [sentRemaining, setSentRemaining] = useState(5);
  const [fightsRemaining, setFightsRemaining] = useState(3);
  const [phase, setPhase] = useState<"loading" | "need-login" | "ready">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  // Form tantang
  const [targetId, setTargetId] = useState("");
  const [map, setMap] = useState("ring");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [formBusy, setFormBusy] = useState(false);

  const load = useCallback(async () => {
    const me = await clientApi<{ user: SessionUser }>("/api/auth/me");
    if (!me.ok) {
      setPhase("need-login");
      return;
    }
    setUser(me.data.user);
    const [listRes, inRes, outRes] = await Promise.all([
      clientApi<{ fighters: Fighter[] }>("/api/fighters?sort=wins"),
      clientApi<ChallengesResponse>("/api/challenges?box=in"),
      clientApi<ChallengesResponse>("/api/challenges?box=out"),
    ]);
    if (listRes.ok) {
      setAllFighters(listRes.data.fighters);
      setMyFighter(
        listRes.data.fighters.find((f) => f.userId === me.data.user.id) ?? null,
      );
    }
    if (inRes.ok) {
      setIncoming(inRes.data.challenges);
      setSentRemaining(inRes.data.sentRemaining);
      setFightsRemaining(inRes.data.fightsRemaining);
    }
    if (outRes.ok) setOutgoing(outRes.data.challenges);
    setPhase("ready");
  }, []);

  useEffect(() => {
    // Fetch saat mount — pola standar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const act = async (
    id: string,
    action: "accept" | "decline",
  ) => {
    setBusyId(id);
    setError("");
    setNotice("");
    const res = await clientApi<{ gameFight?: { id: string } }>(
      `/api/challenges/${id}/${action}`,
      { method: "POST" },
    );
    setBusyId("");
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    if (action === "accept" && res.data.gameFight?.id) {
      router.push(`/game/${res.data.gameFight.id}`);
      return;
    }
    setNotice(
      action === "accept"
        ? "Tantangan diterima — arena dibuka."
        : "Tantangan ditolak.",
    );
    await load();
  };

  const createChallenge = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      setFormError("Pilih fighter yang mau ditantang.");
      return;
    }
    setFormBusy(true);
    setFormError("");
    setNotice("");
    const res = await clientApi<{ challenge: Challenge }>(
      "/api/challenges",
      {
        method: "POST",
        body: JSON.stringify({
          challengedFighterId: targetId,
          message: message.trim() || undefined,
          map,
        }),
      },
    );
    setFormBusy(false);
    if (!res.ok) {
      setFormError(res.error.message);
      return;
    }
    setMessage("");
    setTargetId("");
    setNotice("Tantangan terkirim! Tunggu lawanmu menerima.");
    await load();
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
        title="Masuk Dulu"
        description="Kamu harus masuk untuk menantang dan menerima tantangan."
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

  const others = allFighters.filter(
    (f) => getId(f) && getId(f) !== getId(myFighter),
  );

  const renderChallenge = (c: Challenge, box: "in" | "out") => {
    const from = fighterName(c.challengerFighterId as FighterSummary | string);
    const to = fighterName(c.challengedFighterId as FighterSummary | string);
    const gameFightId =
      c.gameFightId && typeof c.gameFightId === "object"
        ? c.gameFightId.id
        : null;
    return (
      <GlassCard key={c.id ?? c._id} className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-paper">
              {from} <span className="text-amber-brand">VS</span> {to}
            </p>
            <p className="mt-0.5 text-sm text-paper-dim">
              {MAP_LABELS[c.map ?? "ring"] ?? c.map}
              {c.message ? ` • “${c.message}”` : ""}
              {c.expiresAt ? ` • Kedaluwarsa ${formatWIB(c.expiresAt)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {c.status === "pending" ? (
              <Badge tone="amber">Menunggu</Badge>
            ) : c.status === "accepted" ? (
              <Badge tone="green">Diterima</Badge>
            ) : c.status === "declined" ? (
              <Badge tone="red">Ditolak</Badge>
            ) : (
              <Badge tone="outline">Kedaluwarsa</Badge>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {c.status === "pending" && box === "in" ? (
            <>
              <Button
                size="sm"
                disabled={busyId === (c.id ?? c._id ?? "")}
                onClick={() => act(c.id ?? c._id ?? "", "accept")}
              >
                Terima & Gelud
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === (c.id ?? c._id ?? "")}
                onClick={() => act(c.id ?? c._id ?? "", "decline")}
              >
                Tolak
              </Button>
            </>
          ) : null}
          {gameFightId ? (
            <ButtonLink href={`/game/${gameFightId}`} size="sm" variant="glass">
              Buka Arena →
            </ButtonLink>
          ) : null}
        </div>
      </GlassCard>
    );
  };

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

      {/* Sisa jatah */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="px-4 py-3 text-center">
          <p className="font-display text-3xl text-amber-brand">
            {fightsRemaining}/3
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-paper-dim">
            Sisa tarung hari ini
          </p>
        </GlassCard>
        <GlassCard className="px-4 py-3 text-center">
          <p className="font-display text-3xl text-amber-brand">
            {sentRemaining}/5
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-paper-dim">
            Sisa tantangan hari ini
          </p>
        </GlassCard>
      </div>

      {/* Form tantang */}
      {myFighter ? (
        <section aria-labelledby="tantang-heading">
          <h2
            id="tantang-heading"
            className="mb-4 font-display text-2xl uppercase tracking-wide sm:text-3xl"
          >
            Tantang <span className="text-amber-brand">Fighter Lain</span>
          </h2>
          <GlassCard strong>
            <form onSubmit={createChallenge} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="target"
                  label="Pilih Lawan"
                  options={[
                    { value: "", label: "— Pilih fighter —" },
                    ...others.map((f) => ({
                      value: getId(f),
                      label: `${f.displayName} (${styleLabel(f.style, f.styleOther)})`,
                    })),
                  ]}
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                />
                <Select
                  id="map"
                  label="Arena (Map)"
                  options={MAP_OPTIONS}
                  value={map}
                  onChange={(e) => setMap(e.target.value)}
                />
              </div>
              <Textarea
                id="message"
                label="Pesan tantangan (opsional, maks 140 karakter)"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 140))}
                placeholder="contoh: Berani lawan aku di gudang?"
                maxLength={140}
              />
              {formError ? (
                <p role="alert" className="text-sm font-semibold text-red-400">
                  {formError}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={formBusy || sentRemaining <= 0 || fightsRemaining <= 0}
              >
                {formBusy ? "Mengirim…" : "Kirim Tantangan"}
              </Button>
              {sentRemaining <= 0 ? (
                <p className="text-sm text-paper-mute">
                  Jatah tantangan hari ini habis — coba lagi besok.
                </p>
              ) : null}
            </form>
          </GlassCard>
        </section>
      ) : (
        <EmptyState
          title="Belum Punya Fighter"
          description="Buat fighter dulu sebelum bisa menantang orang lain."
          action={<ButtonLink href="/fighter-saya">Buat Fighter</ButtonLink>}
        />
      )}

      {/* Tantangan masuk */}
      <section aria-labelledby="masuk-heading">
        <h2
          id="masuk-heading"
          className="mb-4 font-display text-2xl uppercase tracking-wide sm:text-3xl"
        >
          Tantangan <span className="text-red-brand">Masuk</span>
        </h2>
        {incoming.length === 0 ? (
          <EmptyState
            title="Belum Ada Tantangan"
            description="Belum ada yang menantangmu. Tantang duluan, atau tunggu lawan datang."
          />
        ) : (
          <div className="space-y-3">
            {incoming.map((c) => renderChallenge(c, "in"))}
          </div>
        )}
      </section>

      {/* Tantangan keluar */}
      <section aria-labelledby="keluar-heading">
        <h2
          id="keluar-heading"
          className="mb-4 font-display text-2xl uppercase tracking-wide sm:text-3xl"
        >
          Tantangan <span className="text-amber-brand">Keluar</span>
        </h2>
        {outgoing.length === 0 ? (
          <EmptyState
            title="Belum Mengirim Tantangan"
            description="Kamu belum mengirim tantangan apa pun."
          />
        ) : (
          <div className="space-y-3">
            {outgoing.map((c) => renderChallenge(c, "out"))}
          </div>
        )}
      </section>

      <p className="text-center text-sm text-paper-mute">
        Login sebagai{" "}
        <strong className="text-paper">@{user?.username ?? "—"}</strong>
        {myFighter ? (
          <>
            {" • "}Fighter:{" "}
            <Link
              href={`/fighter/${getId(myFighter)}`}
              className="font-semibold text-amber-brand hover:underline"
            >
              {myFighter.displayName}
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
