"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  adminTournamentActions,
  asFighter,
  clientApi,
  defaultDrawRound,
  filterAdminTournaments,
  formatWIB,
  getId,
  METHOD_LABELS,
  normalizeBracket,
  ROUND_LABELS,
  ROUND_ORDER,
  TOURNAMENT_STATUS_LABELS,
  type AdminTournamentTab,
} from "@/components/api";
import type { MatchItem, RoundKey, Tournament } from "@/components/types";
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

const TABS: { value: AdminTournamentTab; label: string; hint: string }[] = [
  {
    value: "kelola",
    label: "Kelola Turnamen",
    hint: "Buat baru, edit pendaftaran, tutup/batalkan, buat bracket.",
  },
  {
    value: "berlangsung",
    label: "Turnamen Berlangsung",
    hint: "Mulai pertarungan satu per satu dan lihat bracket.",
  },
  {
    value: "selesai",
    label: "Turnamen Selesai",
    hint: "Riwayat turnamen yang sudah selesai atau dibatalkan.",
  },
];

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Nama pemenang dari satu match bracket (untuk pesan sukses). */
function winnerName(match: MatchItem, winnerId: string): string {
  const a = asFighter(match.fighterA ?? match.fighterAId);
  const b = asFighter(match.fighterB ?? match.fighterBId);
  if (a && getId(a) === winnerId) return a.displayName;
  if (b && getId(b) === winnerId) return b.displayName;
  return "Pemenang";
}

/**
 * Bracket turnamen untuk admin: daftar match per ronde (bukan pohon),
 * lengkap dengan status + pemenang. Di turnamen yang sedang berjalan,
 * tiap match yang masih terjadwal punya tombol "Mulai Pertarungan" —
 * alur utama: satu per satu, bukan semua sekaligus.
 */
function AdminBracket({
  matches,
  loading,
  showActions,
  busyMatchId,
  onDrawMatch,
}: {
  matches: MatchItem[];
  loading: boolean;
  showActions: boolean;
  busyMatchId: string;
  onDrawMatch: (match: MatchItem) => void;
}) {
  if (loading) {
    return (
      <p role="status" className="text-sm text-paper-dim">
        Memuat bracket…
      </p>
    );
  }
  if (matches.length === 0) {
    return (
      <p className="text-sm text-paper-dim">
        Bracket belum dibuat untuk turnamen ini.
      </p>
    );
  }
  const byRound = ROUND_ORDER.filter((r) =>
    matches.some((m) => m.round === r),
  );
  return (
    <div className="space-y-4">
      {byRound.map((round) => {
        const roundMatches = matches.filter((m) => m.round === round);
        const decided = roundMatches.filter(
          (m) => m.status === "decided" || m.status === "video_done",
        ).length;
        return (
          <div key={round}>
            <h4 className="mb-2 font-display text-lg uppercase tracking-wide">
              {ROUND_LABELS[round] ?? round}{" "}
              <span className="text-sm normal-case tracking-normal text-paper-mute">
                ({decided}/{roundMatches.length} diputuskan)
              </span>
            </h4>
            <ul className="space-y-2">
              {roundMatches.map((m) => {
                const id = getId(m);
                const a = asFighter(m.fighterA ?? m.fighterAId);
                const b = asFighter(m.fighterB ?? m.fighterBId);
                const winnerId =
                  typeof m.winnerId === "string" ? m.winnerId : "";
                const aWon = !!a && winnerId !== "" && getId(a) === winnerId;
                const bWon = !!b && winnerId !== "" && getId(b) === winnerId;
                const decidedMatch =
                  m.status === "decided" || m.status === "video_done";
                const canStart =
                  showActions && m.status === "scheduled" && m.isBye !== true;
                return (
                  <li
                    key={id || `${round}-${a?.displayName}-${b?.displayName}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        <span className={aWon ? "font-bold text-amber-brand" : ""}>
                          {a?.displayName ?? "TBD"}
                          {aWon ? " ★" : ""}
                        </span>
                        {" vs "}
                        <span className={bWon ? "font-bold text-amber-brand" : ""}>
                          {m.isBye ? (
                            <span className="italic text-paper-mute">Bye</span>
                          ) : (
                            (b?.displayName ?? "TBD")
                          )}
                          {bWon ? " ★" : ""}
                        </span>
                      </p>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {m.isBye ? (
                          <Badge tone="neutral">Bye — Lolos Otomatis</Badge>
                        ) : decidedMatch && m.method ? (
                          <Badge tone={m.method === "KO" ? "red" : "amber"}>
                            {METHOD_LABELS[m.method] ?? m.method}
                            {m.score ? ` ${m.score.a}–${m.score.b}` : ""}
                          </Badge>
                        ) : (
                          <Badge tone="outline">Menunggu Dimulai</Badge>
                        )}
                        {m.method === "KO" && m.koTimeSec != null ? (
                          <Badge tone="outline">KO {m.koTimeSec} dtk</Badge>
                        ) : null}
                        {m.method === "draw" ? (
                          <Badge tone="cyan">Seri — Undian Ulang</Badge>
                        ) : null}
                        {m.reelUrl ? <Badge tone="cyan">Ada Video</Badge> : null}
                      </p>
                    </div>
                    {canStart ? (
                      <Button
                        size="sm"
                        disabled={busyMatchId === id}
                        onClick={() => onDrawMatch(m)}
                      >
                        {busyMatchId === id
                          ? "Memulai…"
                          : "▶ Mulai Pertarungan"}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminTournaments({ slug }: { slug: string }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [busyMatchId, setBusyMatchId] = useState("");

  // Tab admin: kelola / berlangsung / selesai.
  const [tab, setTab] = useState<AdminTournamentTab>("kelola");

  // Bracket per turnamen (diambil dari detail publik, sudah populate fighter).
  const [brackets, setBrackets] = useState<Record<string, MatchItem[]>>({});
  const [bracketLoading, setBracketLoading] = useState<Record<string, boolean>>({});

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
    | { kind: "reshuffle"; t: Tournament }
    | { kind: "close"; t: Tournament }
    | { kind: "cancel"; t: Tournament }
    | null
  >(null);

  // Draw round per turnamen (hanya override pilihan admin; kalau kosong,
  // default dihitung dari bracket — lihat defaultDrawRound).
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

  /** Ambil bracket satu turnamen (detail publik, fighter ter-populate). */
  const loadBracket = useCallback(async (tournamentSlug: string) => {
    setBracketLoading((prev) => ({ ...prev, [tournamentSlug]: true }));
    const res = await clientApi<{
      bracket: MatchItem[] | Record<string, MatchItem[]>;
    }>(`/api/tournaments/${tournamentSlug}`);
    if (res.ok) {
      setBrackets((prev) => ({
        ...prev,
        [tournamentSlug]: normalizeBracket(res.data.bracket),
      }));
    }
    setBracketLoading((prev) => ({ ...prev, [tournamentSlug]: false }));
  }, []);

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

  // Bracket langsung dimuat untuk turnamen yang tampil di tab Berlangsung
  // (in_progress) dan Selesai (completed/cancelled) — admin tidak perlu
  // pindah halaman atau refresh manual untuk melihat bracket.
  useEffect(() => {
    if (tab !== "berlangsung" && tab !== "selesai") return;
    for (const t of tournaments) {
      if (
        (t.status === "in_progress" || t.status === "completed") &&
        brackets[t.slug] === undefined &&
        !bracketLoading[t.slug]
      ) {
        // Muat bracket saat tab dibuka — loadBracket setState sinkron di
        // awal (setBracketLoading), pola yang sama dengan fetch saat mount
        // di tempat lain (lihat GameArena/TantanganClient).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadBracket(t.slug);
      }
    }
  }, [tab, tournaments, brackets, bracketLoading, loadBracket]);

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

  /** Generate bracket lalu LANGSUNG tampilkan bracketnya: pindah ke tab
   *  Berlangsung dan muat bracket turnamen itu juga. */
  const generateBracket = async (t: Tournament) => {
    setBusyId(getId(t));
    const res = await clientApi<{ tournament: Tournament }>(
      `/api/admin/tournaments/${getId(t)}/generate-bracket`,
      { method: "POST", headers, body: JSON.stringify({}) },
    );
    setBusyId("");
    setConfirm(null);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice(
      `Bracket “${t.name}” dibuat dan turnamen berjalan. Bracket ada di bawah — mulai pertarungan satu per satu.`,
    );
    setTab("berlangsung");
    await load();
    await loadBracket(t.slug);
  };

  /** Mulai SATU pertarungan: putuskan match itu saja, yang lain menunggu. */
  const drawMatch = async (t: Tournament, match: MatchItem) => {
    const matchId = getId(match);
    if (!matchId) return;
    setError("");
    setNotice("");
    setBusyMatchId(matchId);
    const res = await clientApi<{
      winnerId: string;
      method: string;
      scoreA: number;
      scoreB: number;
      koTimeSec: number | null;
      tournament: Tournament;
    }>(`/api/admin/tournaments/${getId(t)}/draw-match`, {
      method: "POST",
      headers,
      body: JSON.stringify({ matchId }),
    });
    setBusyMatchId("");
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const name = winnerName(match, res.data.winnerId);
    const methodLabel =
      METHOD_LABELS[res.data.method] ?? res.data.method;
    setNotice(
      `Pertarungan diputuskan: ${name} menang (${methodLabel}, ${res.data.scoreA}–${res.data.scoreB}). Video task dibuat.`,
    );
    await load();
    await loadBracket(t.slug);
    if (res.data.tournament.status === "completed") {
      const champion = res.data.tournament.championId;
      const championName =
        typeof champion === "object" && champion !== null
          ? champion.displayName
          : name;
      setNotice(
        `Turnamen “${t.name}” selesai — juara: ${championName}. Lihat hasil lengkap di tab Turnamen Selesai.`,
      );
      setTab("selesai");
    }
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

  const visible = filterAdminTournaments(tournaments, tab);
  const countFor = (value: AdminTournamentTab) =>
    filterAdminTournaments(tournaments, value).length;

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

      {/* Tab admin */}
      <div
        role="tablist"
        aria-label="Kategori turnamen"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((tb) => (
          <button
            key={tb.value}
            role="tab"
            aria-selected={tab === tb.value}
            onClick={() => setTab(tb.value)}
            className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold ${
              tab === tb.value
                ? "border-amber-brand bg-amber-brand text-on-amber"
                : "border-white/25 text-paper hover:bg-white/10"
            }`}
          >
            {tb.label} ({countFor(tb.value)})
          </button>
        ))}
      </div>
      <p className="text-sm text-paper-dim">
        {TABS.find((tb) => tb.value === tab)?.hint}
      </p>

      {/* Tab Kelola: form buat turnamen */}
      {tab === "kelola" ? (
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
      ) : null}

      {/* Daftar turnamen di tab aktif */}
      <section aria-labelledby="daftar-heading">
        <h2 id="daftar-heading" className="mb-4 font-display text-2xl uppercase tracking-wide">
          {tab === "kelola"
            ? "Turnamen yang Bisa Dikelola"
            : tab === "berlangsung"
              ? "Turnamen Berlangsung"
              : "Turnamen Selesai"}
        </h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2" role="status" aria-label="Memuat…">
            {[0, 1].map((i) => (
              <div key={i} className="glass h-40 animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              tab === "kelola"
                ? "Belum Ada Turnamen untuk Dikelola"
                : tab === "berlangsung"
                  ? "Belum Ada Turnamen Berlangsung"
                  : "Belum Ada Turnamen Selesai"
            }
            description={
              tab === "kelola"
                ? "Buat turnamen pertama lewat form di atas."
                : tab === "berlangsung"
                  ? "Turnamen yang sedang berjalan akan muncul di sini setelah bracket dibuat."
                  : "Turnamen yang sudah selesai atau dibatalkan akan muncul di sini."
            }
          />
        ) : (
          <div className="space-y-4">
            {visible.map((t) => {
              const id = getId(t);
              const busy = busyId === id;
              const isEditing = editingId === id;
              const actions = adminTournamentActions(t.status);
              const bracket = brackets[t.slug] ?? [];
              // Di tab Berlangsung, turnamen yang masih pendaftaran hanya
              // ditampilkan ringkas — pengelolaannya ada di tab Kelola.
              const isWaitingRoom =
                tab === "berlangsung" &&
                (t.status === "upcoming" || t.status === "closed");
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

                  {isWaitingRoom ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                      <p className="text-sm text-paper-dim">
                        Masih pendaftaran — belum ada bracket. Kelola di tab
                        Kelola Turnamen.
                      </p>
                      <Button size="sm" variant="ghost" onClick={() => setTab("kelola")}>
                        Kelola →
                      </Button>
                      <Link
                        href={`/turnamen/${t.slug}`}
                        target="_blank"
                        className="inline-flex min-h-[40px] items-center rounded-xl border border-white/25 px-3 text-sm font-semibold text-paper hover:bg-white/10"
                      >
                        Lihat Publik ↗
                      </Link>
                    </div>
                  ) : (
                    <>
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
                          {actions.includes("edit") ? (
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
                          ) : null}
                          <Link
                            href={`/turnamen/${t.slug}`}
                            target="_blank"
                            className="inline-flex min-h-[40px] items-center rounded-xl border border-white/25 px-3 text-sm font-semibold text-paper hover:bg-white/10"
                          >
                            Lihat Publik ↗
                          </Link>
                          {actions.includes("close") ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setConfirm({ kind: "close", t })}
                            >
                              Tutup Pendaftaran
                            </Button>
                          ) : null}
                          {actions.includes("cancel") ? (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() => setConfirm({ kind: "cancel", t })}
                            >
                              Batalkan
                            </Button>
                          ) : null}
                          {actions.includes("generate-bracket") ? (
                            <Button
                              size="sm"
                              variant="cyan"
                              disabled={busy}
                              onClick={() => setConfirm({ kind: "bracket", t })}
                            >
                              Generate Bracket
                            </Button>
                          ) : null}
                          {actions.includes("reshuffle") ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setConfirm({ kind: "reshuffle", t })}
                            >
                              🎲 Acak Ulang Bracket
                            </Button>
                          ) : null}
                        </div>
                      )}

                      {/* Bracket + mulai pertarungan (hanya turnamen berjalan / selesai) */}
                      {actions.includes("view-bracket") ? (
                        <div className="space-y-4 border-t border-white/10 pt-4">
                          <h4 className="font-display text-xl uppercase tracking-wide">
                            Bracket
                          </h4>
                          <AdminBracket
                            matches={bracket}
                            loading={!!bracketLoading[t.slug]}
                            showActions={actions.includes("draw-match")}
                            busyMatchId={busyMatchId}
                            onDrawMatch={(m) => drawMatch(t, m)}
                          />
                        </div>
                      ) : null}

                      {/* Undi satu ronde sekaligus — aksi sekunder. Alur utama
                          adalah tombol "Mulai Pertarungan" per match di atas. */}
                      {actions.includes("draw-round") ? (
                        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                          <label htmlFor={`draw-${id}`} className="text-sm font-semibold text-paper-dim">
                            Undi satu ronde sekaligus:
                          </label>
                          <select
                            id={`draw-${id}`}
                            value={drawRound[id] ?? defaultDrawRound(t, bracket)}
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
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              const round = drawRound[id] ?? defaultDrawRound(t, bracket);
                              return runAction(
                                t,
                                { round },
                                `/api/admin/tournaments/${id}/draw-round`,
                                `Ronde ${ROUND_LABELS[round]} diundi. Pemenang maju ke ronde berikut dan video task dibuat.`,
                              );
                            }}
                          >
                            Undi Ronde
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
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
            ? generateBracket(confirm.t)
            : undefined
        }
        busy={!!busyId}
      >
        <p>
          Bracket dibuat acak dari peserta yang terdaftar. Turnamen butuh
          minimal 4 peserta. Setelah bracket dibuat, status turnamen menjadi
          Berlangsung dan pendaftaran tidak bisa dibuka lagi. Bracket langsung
          ditampilkan di tab Turnamen Berlangsung.
        </p>
      </Modal>
      <Modal
        open={confirm?.kind === "reshuffle"}
        onClose={() => setConfirm(null)}
        title="Acak Ulang Bracket?"
        confirmLabel="Ya, Acak Ulang"
        onConfirm={() =>
          confirm && confirm.kind === "reshuffle"
            ? runAction(
                confirm.t,
                {},
                `/api/admin/tournaments/${getId(confirm.t)}/reshuffle-bracket`,
                `Bracket “${confirm.t.name}” diacak ulang — pasangan ronde pertama baru.`,
              )
            : undefined
        }
        busy={!!busyId}
      >
        <p>
          Pasangan ronde pertama akan diacak ulang secara acak (termasuk
          siapa yang dapat bye). Hanya bisa dilakukan sebelum ada
          pertandingan yang diundi — kalau sudah ada yang diundi, tombol ini
          akan ditolak server.
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
