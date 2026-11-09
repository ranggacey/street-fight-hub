"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clientApi,
  formatWIB,
  getId,
  MAP_LABELS,
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
import ArenaPicker from "@/components/ArenaPicker";
import OpponentPicker from "@/components/OpponentPicker";
import { Textarea } from "@/components/Input";

type BatchSummary = {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
  cancelled: number;
};

type ChallengesResponse = {
  challenges: Challenge[];
  batches?: Record<string, BatchSummary>;
  fightsRemaining: number;
  hasFighter: boolean;
};

function fighterName(
  v: string | FighterSummary | undefined,
): string {
  if (!v || typeof v === "string") return "—";
  return v.displayName;
}

/** Kartu jatah harian dengan bilah segmen — habisnya kelihatan sekilas. */
function QuotaCard({
  label,
  remaining,
  total,
}: {
  label: string;
  remaining: number;
  total: number;
}) {
  const empty = remaining <= 0;
  return (
    <GlassCard className="px-4 py-3 text-center">
      <p
        className={`font-display text-3xl leading-none ${
          empty ? "text-red-brand" : "text-amber-brand"
        }`}
      >
        {remaining}/{total}
      </p>
      <div
        className="mx-auto mt-2.5 flex max-w-[120px] gap-1"
        aria-hidden="true"
      >
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < remaining ? "bg-amber-brand" : "bg-white/15"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-paper-dim">
        {label}
      </p>
      {empty ? (
        <p className="mt-0.5 text-xs font-semibold text-red-400">
          Habis hari ini
        </p>
      ) : null}
    </GlassCard>
  );
}

export default function TantanganClient() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [myFighter, setMyFighter] = useState<Fighter | null>(null);
  const [incoming, setIncoming] = useState<Challenge[]>([]);
  const [outgoing, setOutgoing] = useState<Challenge[]>([]);
  const [allFighters, setAllFighters] = useState<Fighter[]>([]);
  const [batches, setBatches] = useState<Record<string, BatchSummary>>({});
  const [fightsRemaining, setFightsRemaining] = useState(3);
  const [phase, setPhase] = useState<"loading" | "need-login" | "ready">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  // Form tantang
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [targetId, setTargetId] = useState("");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [map, setMap] = useState("ring");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [formBusy, setFormBusy] = useState(false);

  const toggleTarget = useCallback((id: string) => {
    setTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

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
      setBatches(inRes.data.batches ?? {});
      setFightsRemaining(inRes.data.fightsRemaining);
    }
    if (outRes.ok) {
      setOutgoing(outRes.data.challenges);
      setBatches((prev) => ({ ...(outRes.data.batches ?? {}), ...prev }));
    }
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

  const createBulkChallenge = async (e: FormEvent) => {
    e.preventDefault();
    if (targetIds.length === 0) {
      setFormError("Pilih minimal 1 fighter yang mau ditantang.");
      return;
    }
    setFormBusy(true);
    setFormError("");
    setNotice("");
    const res = await clientApi<{
      batchId: string;
      created: number;
      skipped: number;
      results: { status: string; reason?: string; message?: string }[];
    }>("/api/challenges/bulk", {
      method: "POST",
      body: JSON.stringify({
        opponentIds: targetIds,
        message: message.trim() || undefined,
        map,
      }),
    });
    setFormBusy(false);
    if (!res.ok) {
      setFormError(res.error.message);
      return;
    }
    const skipped = res.data.results.filter((r) => r.status === "skipped");
    setMessage("");
    setTargetIds([]);
    setNotice(
      res.data.skipped > 0
        ? `Tantangan terkirim ke ${res.data.created} orang (${res.data.skipped} dilewati: ${skipped
            .map((r) => r.message)
            .filter((m, i, a) => m && a.indexOf(m) === i)
            .join("; ")}). Yang menerima duluan yang bertarung.`
        : `Tantangan terkirim ke ${res.data.created} orang! Yang menerima duluan yang bertarung.`,
    );
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
    // Status batch tantang-banyak-orang (dari ringkasan GET): baris
    // "menunggu X dari N lawan" / "sudah diterima" di daftar keluar.
    const batch = c.batchId ? batches[c.batchId] : undefined;
    const batchLine =
      batch && batch.total > 1
        ? batch.accepted > 0
          ? `Tantangan ke banyak orang • sudah diterima`
          : batch.pending > 0
            ? `Tantangan ke banyak orang • menunggu ${batch.pending} dari ${batch.total} lawan`
            : `Tantangan ke banyak orang • tidak ada yang menerima`
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
            {batchLine ? (
              <p className="mt-0.5 text-sm font-semibold text-amber-brand">
                {batchLine}
              </p>
            ) : null}
            {c.status === "cancelled" && c.cancelReason ? (
              <p className="mt-0.5 text-sm text-paper-dim">{c.cancelReason}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {c.status === "pending" ? (
              <Badge tone="amber">Menunggu</Badge>
            ) : c.status === "accepted" ? (
              <Badge tone="green">Diterima</Badge>
            ) : c.status === "declined" ? (
              <Badge tone="red">Ditolak</Badge>
            ) : c.status === "cancelled" ? (
              <Badge tone="outline">Batal</Badge>
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
    <div className="min-w-0 space-y-8">
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

      {/* Sisa jatah tarung (tantangan sendiri UNLIMITED — tanpa kartu jatah) */}
      <QuotaCard
        label="Sisa tarung hari ini"
        remaining={fightsRemaining}
        total={3}
      />

      {/* Form tantang */}
      {myFighter ? (
        <section aria-labelledby="tantang-heading">
          <h2
            id="tantang-heading"
            className="mb-4 overflow-visible break-words font-display text-[1.35rem] uppercase leading-[1.15] tracking-wide sm:text-3xl sm:leading-[1.1]"
          >
            Tantang <span className="text-amber-brand">Fighter Lain</span>
          </h2>
          <GlassCard strong>
            {/* Mode tantang: satu lawan atau banyak orang sekaligus */}
            <div
              role="group"
              aria-label="Mode tantangan"
              className="mb-6 flex gap-2"
            >
              <button
                type="button"
                onClick={() => setMode("single")}
                aria-pressed={mode === "single"}
                className={`min-h-[44px] flex-1 rounded-xl border px-3 text-sm font-bold transition-colors duration-150 ${
                  mode === "single"
                    ? "border-amber-brand bg-amber-brand/15 text-amber-brand"
                    : "border-white/15 bg-white/5 text-paper hover:border-white/25"
                }`}
              >
                Satu lawan
              </button>
              <button
                type="button"
                onClick={() => setMode("bulk")}
                aria-pressed={mode === "bulk"}
                className={`min-h-[44px] flex-1 rounded-xl border px-3 text-sm font-bold transition-colors duration-150 ${
                  mode === "bulk"
                    ? "border-amber-brand bg-amber-brand/15 text-amber-brand"
                    : "border-white/15 bg-white/5 text-paper hover:border-white/25"
                }`}
              >
                Banyak orang
              </button>
            </div>
            {mode === "bulk" ? (
              <p className="mb-6 rounded-xl border border-amber-brand/50 bg-amber-brand/10 px-4 py-3 text-sm leading-relaxed text-paper">
                Tantang banyak orang sekaligus — satu arena dan satu pesan
                untuk semuanya. Yang menerima duluan yang bertarung,
                tantangan ke yang lain otomatis batal.
              </p>
            ) : null}
            <form
              onSubmit={mode === "bulk" ? createBulkChallenge : createChallenge}
              className="space-y-6"
              noValidate
            >
              {/* Langkah 1 — pilih lawan */}
              <div>
                <div className="mb-3 flex items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className="font-display text-lg leading-none text-amber-brand"
                  >
                    01
                  </span>
                  <h3
                    id="lawan-heading"
                    className="text-sm font-bold uppercase tracking-wider text-paper"
                  >
                    {mode === "bulk" ? "Pilih lawan (boleh banyak)" : "Pilih lawan"}
                  </h3>
                </div>
                {mode === "bulk" ? (
                  <OpponentPicker
                    fighters={others}
                    selectedId=""
                    onSelect={() => {}}
                    multi
                    selectedIds={targetIds}
                    onToggle={toggleTarget}
                  />
                ) : (
                  <OpponentPicker
                    fighters={others}
                    selectedId={targetId}
                    onSelect={setTargetId}
                  />
                )}
              </div>

              {/* Langkah 2 — pilih arena */}
              <div>
                <div className="mb-3 flex items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className="font-display text-lg leading-none text-amber-brand"
                  >
                    02
                  </span>
                  <h3
                    id="arena-heading"
                    className="text-sm font-bold uppercase tracking-wider text-paper"
                  >
                    Pilih arena
                  </h3>
                </div>
                <ArenaPicker
                  value={map}
                  onChange={setMap}
                  labelledBy="arena-heading"
                />
              </div>

              {/* Langkah 3 — pesan */}
              <div>
                <div className="mb-3 flex items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className="font-display text-lg leading-none text-amber-brand"
                  >
                    03
                  </span>
                  <h3
                    id="pesan-heading"
                    className="text-sm font-bold uppercase tracking-wider text-paper"
                  >
                    Pesan tantangan
                  </h3>
                </div>
                <Textarea
                  id="message"
                  label="Pesan tantangan (opsional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 140))}
                  placeholder="contoh: Berani lawan aku di gudang?"
                  maxLength={140}
                  aria-describedby="message-count"
                />
                <p
                  id="message-count"
                  className="mt-1.5 text-right text-xs text-paper-mute"
                >
                  {message.length}/140
                </p>
              </div>

              {formError ? (
                <p role="alert" className="text-sm font-semibold text-red-400">
                  {formError}
                </p>
              ) : null}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                // Nantang TIDAK butuh jatah tarung (perintah user 8 Nov)
                // dan TIDAK ADA batas tantangan/hari (perintah user
                // 9 Nov): tantangan berlaku 3 hari, bisa diterima besok
                // setelah jatah reset. Gate jatah tetap ada di ACCEPT
                // (kedua fighter).
                disabled={
                  formBusy || (mode === "bulk" ? targetIds.length === 0 : false)
                }
              >
                {formBusy
                  ? "Mengirim…"
                  : mode === "bulk"
                    ? `Kirim tantangan ke ${targetIds.length} orang`
                    : "Kirim Tantangan"}
              </Button>
              {fightsRemaining <= 0 ? (
                <p className="text-sm text-paper-mute">
                  Jatah tarungmu habis hari ini — tantangan tetap bisa
                  dikirim, lawan bisa menerimanya besok setelah jatah reset
                  (tantangan berlaku 3 hari).
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
          className="mb-4 overflow-visible break-words font-display text-[1.35rem] uppercase leading-[1.15] tracking-wide sm:text-3xl sm:leading-[1.1]"
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
          className="mb-4 overflow-visible break-words font-display text-[1.35rem] uppercase leading-[1.15] tracking-wide sm:text-3xl sm:leading-[1.1]"
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
