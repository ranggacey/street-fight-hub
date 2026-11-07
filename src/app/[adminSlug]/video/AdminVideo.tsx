"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  asFighter,
  clientApi,
  formatWIB,
  getId,
  ROUND_LABELS,
  VIDEO_STATUS_LABELS,
} from "@/components/api";
import type { MatchItem, VideoTask, VideoTaskStatus } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import { Input, Textarea } from "@/components/Input";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "queued", label: "Antre" },
  { value: "in_production", label: "Diproduksi" },
  { value: "uploaded", label: "Terunggah" },
  { value: "blocked", label: "Terblokir" },
];

function statusTone(s: VideoTaskStatus): "amber" | "red" | "cyan" | "green" | "neutral" {
  if (s === "queued") return "amber";
  if (s === "in_production") return "cyan";
  if (s === "uploaded") return "green";
  if (s === "blocked") return "red";
  return "neutral";
}

export default function AdminVideo({ slug }: { slug: string }) {
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  // Input per task: reelUrl + note
  const [reelUrls, setReelUrls] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const headers = { "x-admin-path": slug };

  const load = useCallback(async () => {
    // Semua setState terjadi SETELAH await — aman dipanggil dari useEffect.
    const q = status ? `/api/admin/video-tasks?status=${status}` : "/api/admin/video-tasks";
    const res = await clientApi<{ videoTasks: VideoTask[] }>(q, {
      headers: { "x-admin-path": slug },
    });
    if (res.ok) setTasks(res.data.videoTasks);
    else setError(res.error.message);
    setLoading(false);
  }, [slug, status]);

  useEffect(() => {
    // Fetch awal: setState hanya di dalam .then() (callback async).
    const q = status
      ? `/api/admin/video-tasks?status=${status}`
      : "/api/admin/video-tasks";
    clientApi<{ videoTasks: VideoTask[] }>(q, {
      headers: { "x-admin-path": slug },
    }).then((res) => {
      if (res.ok) setTasks(res.data.videoTasks);
      else setError(res.error.message);
      setLoading(false);
    });
  }, [slug, status]);

  const patchTask = async (
    task: VideoTask,
    body: { status: VideoTaskStatus; reelUrl?: string; note?: string },
  ) => {
    const id = getId(task);
    if (body.status === "uploaded" && !(body.reelUrl ?? "").trim()) {
      setError("Status Terunggah wajib disertai URL Reel Instagram.");
      return;
    }
    if (
      body.status === "uploaded" &&
      !/instagram\.com\/(reel|p)\//.test(body.reelUrl ?? "")
    ) {
      setError("URL Reel harus tautan instagram.com/reel atau instagram.com/p.");
      return;
    }
    if (body.status === "blocked" && !(body.note ?? "").trim()) {
      setError("Status Terblokir wajib disertai catatan alasan.");
      return;
    }
    setBusyId(id);
    setError("");
    const res = await clientApi<{ videoTask: VideoTask }>(
      `/api/admin/video-tasks/${id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      },
    );
    setBusyId("");
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice("Video task diperbarui.");
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Antrean Video
        </h1>
        <p className="mt-2 text-paper-dim">
          Setiap pertandingan yang sudah diundi membuat satu video task.
          Tempel URL Reel Instagram saat video terunggah.
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

      <nav aria-label="Filter status video task" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.value === status;
          return (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => setStatus(f.value)}
              aria-pressed={active}
              className={`flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                active
                  ? "border-amber-brand bg-amber-brand font-bold text-on-amber"
                  : "border-white/20 bg-white/5 text-paper-dim hover:bg-white/10 hover:text-paper"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </nav>

      {loading ? (
        <div className="space-y-3" role="status" aria-label="Memuat…">
          {[0, 1].map((i) => (
            <div key={i} className="glass h-32 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Tidak Ada Video Task"
          description="Video task muncul otomatis setelah admin mengundi sebuah ronde. Belum ada yang perlu diproduksi."
        />
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const id = getId(task);
            const match =
              typeof task.match === "object"
                ? task.match
                : typeof task.matchId === "object"
                  ? (task.matchId as MatchItem)
                  : null;
            const a = match ? asFighter(match.fighterA ?? match.fighterAId) : null;
            const b = match ? asFighter(match.fighterB ?? match.fighterBId) : null;
            const busy = busyId === id;
            return (
              <GlassCard key={id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl uppercase leading-tight tracking-wide">
                      {a?.displayName ?? "TBD"} vs {b?.displayName ?? "TBD"}
                    </h3>
                    <p className="mt-1 text-xs text-paper-mute">
                      {match ? `${ROUND_LABELS[match.round] ?? match.round}` : ""}
                      {task.createdAt ? ` • Dibuat ${formatWIB(task.createdAt)}` : ""}
                      {match && getId(match) ? (
                        <>
                          {" • "}
                          <Link
                            href={`/pertandingan/${getId(match)}`}
                            target="_blank"
                            className="font-semibold text-amber-brand hover:underline"
                          >
                            Lihat pertandingan ↗
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {task.note ? (
                      <p className="mt-2 text-sm text-paper-dim">
                        Catatan: {task.note}
                      </p>
                    ) : null}
                    {task.reelUrl ? (
                      <p className="mt-1 text-sm">
                        <a
                          href={task.reelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-cyan-accent hover:underline"
                        >
                          Reel terunggah ↗
                        </a>
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={statusTone(task.status)}>
                    {VIDEO_STATUS_LABELS[task.status] ?? task.status}
                  </Badge>
                </div>

                <div className="space-y-3 border-t border-white/10 pt-4">
                  <Input
                    id={`reel-${id}`}
                    label="URL Reel Instagram"
                    hint="Wajib diisi saat menandai Terunggah. Format: instagram.com/reel/… atau /p/…"
                    value={reelUrls[id] ?? task.reelUrl ?? ""}
                    onChange={(e) =>
                      setReelUrls((prev) => ({ ...prev, [id]: e.target.value }))
                    }
                    placeholder="https://www.instagram.com/reel/…"
                  />
                  <Textarea
                    id={`note-${id}`}
                    label="Catatan (wajib jika Terblokir)"
                    value={notes[id] ?? task.note ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Contoh: footage rusak, perlu render ulang…"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="cyan"
                      disabled={busy}
                      onClick={() =>
                        patchTask(task, {
                          status: "in_production",
                          note: notes[id] ?? task.note,
                        })
                      }
                    >
                      Mulai Produksi
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        patchTask(task, {
                          status: "uploaded",
                          reelUrl: (reelUrls[id] ?? task.reelUrl ?? "").trim(),
                          note: notes[id] ?? task.note,
                        })
                      }
                    >
                      Tandai Terunggah
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        patchTask(task, {
                          status: "blocked",
                          note: (notes[id] ?? task.note ?? "").trim(),
                        })
                      }
                    >
                      Tandai Terblokir
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
