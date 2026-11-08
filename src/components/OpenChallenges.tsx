"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  clientApi,
  formatWIB,
  getId,
  MAP_LABELS,
  styleLabel,
} from "@/components/api";
import type { Challenge, Fighter, SessionUser } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { Textarea } from "@/components/Input";

/**
 * Tantangan terbuka di halaman /obrolan (Agen D).
 * - Daftar: GET /api/challenges/open (publik, polling 10 detik).
 * - Buat: POST /api/challenges/open (butuh login + fighter).
 * - Terima: POST /api/challenges/[id]/accept-open — yang pertama
 *   menerima yang gelud, lalu diarahkan ke arena (/game/[fightId]).
 * Tantangan langsung ke 1 orang tetap di /tantangan, tidak di sini.
 */

type OpenChallenge = Challenge & { kind?: string };

type OpenListResponse = {
  challenges: OpenChallenge[];
};

type QuotaResponse = {
  sentRemaining: number;
  fightsRemaining: number;
};

function challengerName(c: OpenChallenge): string {
  const v = c.challengerFighterId;
  if (!v || typeof v === "string") return "—";
  return v.displayName;
}

function challengerStyle(c: OpenChallenge): string {
  const v = c.challengerFighterId;
  if (!v || typeof v === "string") return "";
  return styleLabel(v.style, v.styleOther);
}

export default function OpenChallenges() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [myFighter, setMyFighter] = useState<Fighter | null>(null);
  const [openList, setOpenList] = useState<OpenChallenge[]>([]);
  const [sentRemaining, setSentRemaining] = useState(5);
  const [fightsRemaining, setFightsRemaining] = useState(3);
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Form buat tantangan terbuka
  const [map, setMap] = useState("ring");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [busyId, setBusyId] = useState("");

  const loadOpen = useCallback(async () => {
    const res = await clientApi<OpenListResponse>("/api/challenges/open");
    if (res.ok) setOpenList(res.data.challenges);
  }, []);

  const load = useCallback(async () => {
    const me = await clientApi<{ user: SessionUser }>("/api/auth/me");
    if (me.ok) {
      setUser(me.data.user);
      const [listRes, quotaRes] = await Promise.all([
        clientApi<{ fighters: Fighter[] }>("/api/fighters?sort=wins"),
        clientApi<QuotaResponse>("/api/challenges?box=out"),
      ]);
      if (listRes.ok) {
        setMyFighter(
          listRes.data.fighters.find((f) => f.userId === me.data.user.id) ??
            null,
        );
      }
      if (quotaRes.ok) {
        setSentRemaining(quotaRes.data.sentRemaining);
        setFightsRemaining(quotaRes.data.fightsRemaining);
      }
    }
    await loadOpen();
    setPhase("ready");
  }, [loadOpen]);

  useEffect(() => {
    // Fetch saat mount + polling daftar terbuka 10 dtk — supaya
    // tantangan yang baru diterima orang lain cepat hilang dari daftar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(loadOpen, 10000);
    return () => clearInterval(timer);
  }, [load, loadOpen]);

  const createOpen = async (e: FormEvent) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError("");
    setNotice("");
    const res = await clientApi<{ challenge: OpenChallenge }>(
      "/api/challenges/open",
      {
        method: "POST",
        body: JSON.stringify({
          map,
          message: message.trim() || undefined,
        }),
      },
    );
    setFormBusy(false);
    if (!res.ok) {
      setFormError(res.error.message);
      return;
    }
    setMessage("");
    setNotice("Tantangan terbuka dibuat! Siapa pun bisa menerima — yang pertama menerima yang gelud.");
    await load();
  };

  const acceptOpen = async (id: string) => {
    setBusyId(id);
    setError("");
    setNotice("");
    const res = await clientApi<{ gameFight?: { id: string } }>(
      `/api/challenges/${id}/accept-open`,
      { method: "POST" },
    );
    setBusyId("");
    if (!res.ok) {
      setError(res.error.message);
      await loadOpen();
      return;
    }
    if (res.data.gameFight?.id) {
      router.push(`/game/${res.data.gameFight.id}`);
      return;
    }
    setNotice("Tantangan diterima — arena dibuka.");
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

  const myId = getId(myFighter);

  return (
    <div className="space-y-6">
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

      {/* Form buat tantangan terbuka */}
      {myFighter ? (
        <section aria-labelledby="buat-terbuka-heading">
          <h2
            id="buat-terbuka-heading"
            className="mb-4 font-display text-2xl uppercase tracking-wide sm:text-3xl"
          >
            Tantangan <span className="text-amber-brand">Terbuka</span>
          </h2>
          <GlassCard strong>
            <form onSubmit={createOpen} className="space-y-4" noValidate>
              <p className="text-sm leading-relaxed text-paper-dim">
                Tantang semua orang — bukan 1 fighter tertentu. Yang pertama
                menanggapi yang gelud lawan{" "}
                <strong className="text-paper">{myFighter.displayName}</strong>.
                Sisa tantangan hari ini:{" "}
                <strong className="text-paper">{sentRemaining}/5</strong> • Sisa
                tarung:{" "}
                <strong className="text-paper">{fightsRemaining}/3</strong>.
              </p>
              <div>
                <label
                  htmlFor="open-map"
                  className="mb-1.5 block text-sm font-bold uppercase tracking-wider text-paper"
                >
                  Arena
                </label>
                <select
                  id="open-map"
                  value={map}
                  onChange={(e) => setMap(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-paper focus:border-amber-brand focus:outline-none focus:ring-2 focus:ring-amber-brand/40"
                >
                  {Object.entries(MAP_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Textarea
                  id="open-message"
                  label="Pesan tantangan (opsional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 140))}
                  placeholder="contoh: Siapa berani lawan aku di gudang?"
                  maxLength={140}
                  aria-describedby="open-message-count"
                />
                <p
                  id="open-message-count"
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
                disabled={
                  formBusy || sentRemaining <= 0 || fightsRemaining <= 0
                }
              >
                {formBusy ? "Membuat…" : "Buat Tantangan Terbuka"}
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
          title="Buat Fighter Dulu"
          description={
            user
              ? "Buat fighter dulu sebelum bisa membuat atau menerima tantangan terbuka."
              : "Masuk dan buat fighter dulu sebelum bisa membuat atau menerima tantangan terbuka."
          }
          action={
            <Button
              onClick={() =>
                router.push(user ? "/fighter-saya" : "/masuk")
              }
            >
              {user ? "Buat Fighter" : "Masuk"}
            </Button>
          }
        />
      )}

      {/* Daftar tantangan terbuka */}
      <section aria-labelledby="terbuka-heading">
        <h2
          id="terbuka-heading"
          className="mb-4 font-display text-2xl uppercase tracking-wide sm:text-3xl"
        >
          Tantangan Terbuka <span className="text-red-brand">Menunggu</span>
        </h2>
        {openList.length === 0 ? (
          <EmptyState
            title="Belum Ada Tantangan Terbuka"
            description="Belum ada yang membuka tantangan. Jadilah yang pertama menantang semua orang!"
          />
        ) : (
          <div className="space-y-3">
            {openList.map((c) => {
              const id = c.id ?? c._id ?? "";
              const challengerId =
                c.challengerFighterId &&
                typeof c.challengerFighterId === "object"
                  ? c.challengerFighterId.id
                  : null;
              const isMine = !!myId && challengerId === myId;
              return (
                <GlassCard key={id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-paper">
                        {challengerName(c)}{" "}
                        <span className="text-amber-brand">VS</span>{" "}
                        <span className="text-paper-dim">Siapa pun</span>
                      </p>
                      <p className="mt-0.5 text-sm text-paper-dim">
                        {challengerStyle(c)
                          ? `${challengerStyle(c)} • `
                          : ""}
                        {MAP_LABELS[c.map ?? "ring"] ?? c.map}
                        {c.message ? ` • “${c.message}”` : ""}
                        {c.expiresAt
                          ? ` • Kedaluwarsa ${formatWIB(c.expiresAt)}`
                          : ""}
                      </p>
                    </div>
                    {isMine ? (
                      <Badge tone="amber">Tantanganmu</Badge>
                    ) : (
                      <Badge tone="red">Terbuka</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isMine ? (
                      <p className="text-sm text-paper-dim">
                        Menunggu ada yang menerima…
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!myFighter || busyId === id}
                        onClick={() => acceptOpen(id)}
                      >
                        {busyId === id ? "…" : "Terima & Gelud"}
                      </Button>
                    )}
                  </div>
                  {!myFighter && !isMine ? (
                    <p className="mt-2 text-xs text-paper-mute">
                      Buat fighter dulu untuk menerima tantangan ini.
                    </p>
                  ) : null}
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
