"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  clientApi,
  formatWIB,
  getId,
  ROUND_LABELS,
  TOURNAMENT_STATUS_LABELS,
} from "@/components/api";
import type { RoundKey, Tournament } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import { Input, Select, Textarea } from "@/components/Input";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";

const DRAW_ROUNDS: { value: RoundKey; label: string }[] = [
  { value: "R32", label: "32 Besar" },
  { value: "R16", label: "16 Besar" },
  { value: "QF", label: "Perempat Final" },
  { value: "SF", label: "Semifinal" },
  { value: "F", label: "Final" },
];

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminTournaments({ slug }: { slug: string }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  // Form buat turnamen
  const [name, setName] = useState("");
  const [bracketSize, setBracketSize] = useState("32");
  const [regOpenAt, setRegOpenAt] = useState("");
  const [regCloseAt, setRegCloseAt] = useState("");
  const [rules, setRules] = useState("");

  // Edit inline
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editRules, setEditRules] = useState("");
  const [editOpen, setEditOpen] = useState("");
  const [editClose, setEditClose] = useState("");

  // Modal konfirmasi
  const [confirm, setConfirm] = useState<
    | { kind: "bracket"; t: Tournament }
    | { kind: "close"; t: Tournament }
    | { kind: "cancel"; t: Tournament }
    | null
  >(null);

  // Draw round per turnamen
  const [drawRound, setDrawRound] = useState<Record<string, RoundKey>>({});

  const headers = { "x-admin-path": slug };

  const load = useCallback(async () => {
    // Semua setState terjadi SETELAH await — aman dipanggil dari useEffect.
    const res = await clientApi<{ tournaments: Tournament[] }>(
      "/api/tournaments",
      {
        headers: { "x-admin-path": slug },
      },
    );
    if (res.ok) setTournaments(res.data.tournaments);
    else setError(res.error.message);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    // Fetch awal: setState hanya di dalam .then() (callback async),
    // bukan pemanggilan fungsi pen-set-state langsung dari badan effect.
    clientApi<{ tournaments: Tournament[] }>("/api/tournaments", {
      headers: { "x-admin-path": slug },
    }).then((res) => {
      if (res.ok) setTournaments(res.data.tournaments);
      else setError(res.error.message);
      setLoading(false);
    });
  }, [slug]);

  const createTournament = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim()) {
      setError("Nama turnamen wajib diisi.");
      return;
    }
    if (!regOpenAt || !regCloseAt) {
      setError("Isi tanggal buka dan tutup pendaftaran.");
      return;
    }
    setBusyId("create");
    const res = await clientApi<{ tournament: Tournament }>(
      "/api/admin/tournaments",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: name.trim(),
          bracketSize: Number(bracketSize),
          regOpenAt: new Date(regOpenAt).toISOString(),
          regCloseAt: new Date(regCloseAt).toISOString(),
          rules: rules.trim(),
        }),
      },
    );
    setBusyId("");
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice(
      `Turnamen “${res.data.tournament.name}” dibuat (slug: ${res.data.tournament.slug}).`,
    );
    setName("");
    setRules("");
    setRegOpenAt("");
    setRegCloseAt("");
    load();
  };

  const saveEdit = async (t: Tournament) => {
    setBusyId(getId(t));
    const res = await clientApi<{ tournament: Tournament }>(
      `/api/admin/tournaments/${getId(t)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: editName.trim() || t.name,
          rules: editRules,
          regOpenAt: editOpen ? new Date(editOpen).toISOString() : undefined,
          regCloseAt: editClose ? new Date(editClose).toISOString() : undefined,
        }),
      },
    );
    setBusyId("");
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice("Turnamen diperbarui.");
    setEditingId("");
    load();
  };

  const runAction = async (
    t: Tournament,
    body: Record<string, unknown>,
    endpoint: string,
    successMsg: string,
  ) => {
    setBusyId(getId(t));
    const res = await clientApi<unknown>(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    setBusyId("");
    setConfirm(null);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice(successMsg);
    load();
  };

  const patchAction = async (t: Tournament, action: "close" | "cancel") => {
    setBusyId(getId(t));
    const res = await clientApi<{ tournament: Tournament }>(
      `/api/admin/tournaments/${getId(t)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ action }),
      },
    );
    setBusyId("");
    setConfirm(null);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice(
      action === "close"
        ? `Pendaftaran “${t.name}” ditutup.`
        : `Turnamen “${t.name}” dibatalkan.`,
    );
    load();
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Kelola Turnamen
        </h1>
        <p className="mt-2 text-paper-dim">
          Buat turnamen baru, edit jendela pendaftaran, tutup/batalkan,
          generate bracket, dan undi tiap ronde.
        </p>
      </header>

      {notice ? (
        <p role="status" className="rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-400">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-brand/50 bg-red-brand/10 px-4 py-3 text-sm font-semibold text-red-400">
          {error}
        </p>
      ) : null}

      {/* Buat turnamen */}
      <section aria-labelledby="buat-heading">
        <h2 id="buat-heading" className="mb-4 font-display text-2xl uppercase tracking-wide">
          Buat Turnamen Baru
        </h2>
        <GlassCard strong>
          <form onSubmit={createTournament} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="t-name"
                label="Nama Turnamen"
                hint="Slug dibuat otomatis: night-fight-championship-N."
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: Night Fight Championship #2"
                maxLength={80}
                required
              />
              <Select
                id="t-size"
                label="Ukuran Bracket"
                options={[
                  { value: "8", label: "8 fighter" },
                  { value: "16", label: "16 fighter" },
                  { value: "32", label: "32 fighter" },
                ]}
                value={bracketSize}
                onChange={(e) => setBracketSize(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="t-open"
                label="Pendaftaran Dibuka"
                type="datetime-local"
                value={regOpenAt}
                onChange={(e) => setRegOpenAt(e.target.value)}
                required
              />
              <Input
                id="t-close"
                label="Pendaftaran Ditutup"
                type="datetime-local"
                value={regCloseAt}
                onChange={(e) => setRegCloseAt(e.target.value)}
                required
              />
            </div>
            <Textarea
              id="t-rules"
              label="Peraturan"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="Contoh: Single elimination, undian acak, KO atau keputusan juri…"
              maxLength={2000}
            />
            <Button type="submit" disabled={busyId === "create"}>
              {busyId === "create" ? "Membuat…" : "Buat Turnamen"}
            </Button>
          </form>
        </GlassCard>
      </section>

      {/* Daftar turnamen */}
      <section aria-labelledby="daftar-heading">
        <h2 id="daftar-heading" className="mb-4 font-display text-2xl uppercase tracking-wide">
          Semua Turnamen
        </h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2" role="status" aria-label="Memuat…">
            {[0, 1].map((i) => (
              <div key={i} className="glass h-40 animate-pulse" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <EmptyState
            title="Belum Ada Turnamen"
            description="Buat turnamen pertama lewat form di atas."
          />
        ) : (
          <div className="space-y-4">
            {tournaments.map((t) => {
              const id = getId(t);
              const busy = busyId === id;
              const isEditing = editingId === id;
              return (
                <GlassCard key={t.slug} className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-2xl uppercase leading-tight tracking-wide">
                        {t.name}
                      </h3>
                      <p className="mt-1 text-xs text-paper-mute">
                        slug: {t.slug} • {t.participantCount ?? 0}/{t.bracketSize} peserta •{" "}
                        {formatWIB(t.regOpenAt)} — {formatWIB(t.regCloseAt)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        t.status === "in_progress"
                          ? "red"
                          : t.status === "upcoming"
                            ? "amber"
                            : t.status === "completed"
                              ? "green"
                              : "neutral"
                      }
                    >
                      {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 border-t border-white/10 pt-4">
                      <Input
                        id={`edit-name-${id}`}
                        label="Nama"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          id={`edit-open-${id}`}
                          label="Pendaftaran Dibuka"
                          type="datetime-local"
                          value={editOpen}
                          onChange={(e) => setEditOpen(e.target.value)}
                        />
                        <Input
                          id={`edit-close-${id}`}
                          label="Pendaftaran Ditutup"
                          type="datetime-local"
                          value={editClose}
                          onChange={(e) => setEditClose(e.target.value)}
                        />
                      </div>
                      <Textarea
                        id={`edit-rules-${id}`}
                        label="Peraturan"
                        value={editRules}
                        onChange={(e) => setEditRules(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(t)} disabled={busy}>
                          Simpan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId("")}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(id);
                          setEditName(t.name);
                          setEditRules(t.rules ?? "");
                          setEditOpen(toDatetimeLocal(t.regOpenAt));
                          setEditClose(toDatetimeLocal(t.regCloseAt));
                        }}
                      >
                        Edit
                      </Button>
                      <Link
                        href={`/turnamen/${t.slug}`}
                        target="_blank"
                        className="inline-flex min-h-[40px] items-center rounded-xl border border-white/25 px-3 text-sm font-semibold text-paper hover:bg-white/10"
                      >
                        Lihat Publik ↗
                      </Link>
                      {t.status === "upcoming" || t.status === "closed" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: "close", t })}
                        >
                          Tutup Pendaftaran
                        </Button>
                      ) : null}
                      {t.status !== "in_progress" && t.status !== "completed" && t.status !== "cancelled" ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: "cancel", t })}
                        >
                          Batalkan
                        </Button>
                      ) : null}
                      {(t.status === "closed" || t.status === "upcoming") ? (
                        <Button
                          size="sm"
                          variant="cyan"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: "bracket", t })}
                        >
                          Generate Bracket
                        </Button>
                      ) : null}
                    </div>
                  )}

                  {/* Draw round */}
                  {t.status === "in_progress" || t.status === "closed" ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                      <label htmlFor={`draw-${id}`} className="text-sm font-semibold text-paper-dim">
                        Undi ronde:
                      </label>
                      <select
                        id={`draw-${id}`}
                        value={drawRound[id] ?? "R16"}
                        onChange={(e) =>
                          setDrawRound((prev) => ({
                            ...prev,
                            [id]: e.target.value as RoundKey,
                          }))
                        }
                        className="min-h-[44px] rounded-xl border border-white/15 bg-ink-800 px-3 text-sm text-paper"
                      >
                        {DRAW_ROUNDS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            t,
                            { round: drawRound[id] ?? "R16" },
                            `/api/admin/tournaments/${id}/draw-round`,
                            `Ronde ${ROUND_LABELS[drawRound[id] ?? "R16"]} diundi. Pemenang maju ke ronde berikut dan video task dibuat.`,
                          )
                        }
                      >
                        Undi Ronde
                      </Button>
                    </div>
                  ) : null}
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal konfirmasi */}
      <Modal
        open={confirm?.kind === "bracket"}
        onClose={() => setConfirm(null)}
        title="Generate Bracket?"
        confirmLabel="Ya, Generate"
        onConfirm={() =>
          confirm && confirm.kind === "bracket"
            ? runAction(
                confirm.t,
                {},
                `/api/admin/tournaments/${getId(confirm.t)}/generate-bracket`,
                `Bracket “${confirm.t.name}” dibuat dan turnamen berjalan.`,
              )
            : undefined
        }
        busy={!!busyId}
      >
        <p>
          Bracket dibuat acak dari peserta yang terdaftar. Turnamen butuh
          minimal 4 peserta. Setelah bracket dibuat, status turnamen menjadi
          Berlangsung dan pendaftaran tidak bisa dibuka lagi.
        </p>
      </Modal>
      <Modal
        open={confirm?.kind === "close"}
        onClose={() => setConfirm(null)}
        title="Tutup Pendaftaran?"
        confirmLabel="Ya, Tutup"
        onConfirm={() =>
          confirm && confirm.kind === "close"
            ? patchAction(confirm.t, "close")
            : undefined
        }
        busy={!!busyId}
      >
        <p>Pendaftaran ditutup — tidak ada fighter baru yang bisa bergabung.</p>
      </Modal>
      <Modal
        open={confirm?.kind === "cancel"}
        onClose={() => setConfirm(null)}
        title="Batalkan Turnamen?"
        confirmLabel="Ya, Batalkan"
        confirmVariant="danger"
        onConfirm={() =>
          confirm && confirm.kind === "cancel"
            ? patchAction(confirm.t, "cancel")
            : undefined
        }
        busy={!!busyId}
      >
        <p>
          Turnamen dibatalkan dan tidak bisa dilanjutkan. Hanya bisa dilakukan
          sebelum turnamen berjalan.
        </p>
      </Modal>
    </div>
  );
}
