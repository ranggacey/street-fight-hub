"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, formatWIB } from "@/components/api";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/Input";

/**
 * Admin "Pertandingan": daftar fight per hari WIB + unduh poster + ekspor video.
 * - Poster diambil dari posterDataUrl yang sudah tersimpan (TIDAK render ulang).
 * - "Unduh semua poster" = satu ZIP dari server (poster-YYYY-MM-DD.zip).
 * - "Lihat" = replay fight di /game/[id].
 * - "Ekspor Video" = buka replay fight di /game/[id]?export=1 (mode
 *   auto-record). Video DIREKAM DI BROWSER admin (client-side recording):
 *   buka halaman export, biarkan fight diputar sampai selesai, lalu unduh
 *   lewat tautan "Unduh video" yang muncul — TIDAK ada file video di server.
 * - "Tandai Terunggah" = tandai video fight sudah di-upload ke Instagram
 *   (pakai alur VideoTask yang sama dengan halaman Antrean Video).
 */
export interface AdminFightVideoTask {
  id: string;
  status: string;
  reelUrl: string | null;
}

export interface AdminFightRow {
  fightId: string;
  fighterA: { displayName: string; igUsername: string };
  fighterB: { displayName: string; igUsername: string };
  winnerName: string | null;
  score: { a: number | null; b: number | null };
  method: string | null;
  status: string;
  isTitleFight: boolean;
  createdAt: string;
  completedAt: string | null;
  hasPoster: boolean;
  posterDataUrl: string | null;
  posterFile: string;
  videoTask: AdminFightVideoTask | null;
}

function todayStr(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

/** Geser tanggal YYYY-MM-DD sejauh `deltaDays` hari (murni, bisa dites). */
export function shiftWibDate(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function scoreText(f: AdminFightRow): string {
  if (f.score.a === null || f.score.b === null) return "Belum ada skor";
  return `${f.score.a} - ${f.score.b}`;
}

function methodLabel(method: string | null): string {
  if (method === "KO") return "KO";
  if (method === "decision") return "Menang angka";
  if (method === "draw") return "Seri";
  return "";
}

function statusLabel(status: string): string {
  if (status === "completed") return "Selesai";
  if (status === "playing") return "Berlangsung";
  if (status === "pending") return "Menunggu";
  if (status === "disputed") return "Disputed";
  return status;
}

function statusTone(status: string): "green" | "cyan" | "amber" | "red" | "neutral" {
  if (status === "completed") return "green";
  if (status === "playing") return "cyan";
  if (status === "pending") return "amber";
  if (status === "disputed") return "red";
  return "neutral";
}

/** Cek client-side, cerminan isValidInstagramReelUrl di server. */
export function isValidReelUrl(url: string): boolean {
  return /^https:\/\/(www\.)?instagram\.com\/(reel|p)\//.test(url.trim());
}

/**
 * Satu baris riwayat fight: thumbnail + nama + skor + pemenang + badge
 * status/gelar + unduh poster satuan + Lihat (replay) + Ekspor Video
 * (replay mode export) + Tandai Terunggah (VideoTask).
 * `onVideoTaskChange` dipanggil setelah status terunggah berhasil disimpan,
 * supaya daftar induk me-refresh dari server.
 */
export function AdminFightRowCard({
  f,
  slug,
  onVideoTaskChange,
}: {
  f: AdminFightRow;
  slug?: string;
  onVideoTaskChange?: () => void;
}) {
  const [reelUrl, setReelUrl] = useState(f.videoTask?.reelUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");

  const uploaded = f.videoTask?.status === "uploaded";
  const canMark = f.status === "completed" && !!slug;

  const markUploaded = async () => {
    if (!slug) return;
    const url = reelUrl.trim();
    if (!isValidReelUrl(url)) {
      setFormError("URL Reel harus tautan https://instagram.com/reel/… atau /p/…");
      return;
    }
    setBusy(true);
    setFormError("");
    setNotice("");
    const res = f.videoTask
      ? await clientApi<{ videoTask: AdminFightVideoTask }>(
          `/api/admin/video-tasks/${f.videoTask.id}`,
          {
            method: "PATCH",
            headers: { "x-admin-path": slug },
            body: JSON.stringify({ status: "uploaded", reelUrl: url }),
          },
        )
      : await clientApi<{ videoTask: AdminFightVideoTask }>(
          "/api/admin/video-tasks",
          {
            method: "POST",
            headers: { "x-admin-path": slug },
            body: JSON.stringify({ gameFightId: f.fightId, reelUrl: url }),
          },
        );
    setBusy(false);
    if (!res.ok) {
      setFormError(res.error.message);
      return;
    }
    setNotice("Video ditandai terunggah.");
    onVideoTaskChange?.();
  };

  return (
    <GlassCard className="flex flex-wrap items-start gap-4">
      {f.posterDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={f.posterDataUrl}
          alt={`Poster ${f.fighterA.displayName} vs ${f.fighterB.displayName}`}
          className="h-28 w-[63px] shrink-0 rounded-lg object-cover object-top ring-1 ring-white/15"
        />
      ) : (
        <div className="flex h-28 w-[63px] shrink-0 items-center justify-center rounded-lg bg-white/5 text-center text-[11px] font-semibold text-paper-dim ring-1 ring-white/15">
          Belum ada poster
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(f.status)}>{statusLabel(f.status)}</Badge>
          {f.isTitleFight ? <Badge tone="amber">Perebutan gelar</Badge> : null}
          {uploaded ? <Badge tone="green">Video terunggah</Badge> : null}
        </div>
        <p className="mt-2 break-words font-display text-xl uppercase leading-tight tracking-wide">
          {f.fighterA.displayName}{" "}
          <span className="text-amber-brand">vs</span>{" "}
          {f.fighterB.displayName}
        </p>
        <p className="mt-1 text-xs text-paper-dim">
          @{f.fighterA.igUsername || "-"} vs @{f.fighterB.igUsername || "-"}
        </p>
        <p className="mt-1 text-sm font-bold text-paper">
          Skor: {scoreText(f)}
          {f.method ? ` • ${methodLabel(f.method)}` : ""}
        </p>
        <p className="mt-1 text-sm text-paper">
          Pemenang:{" "}
          <span className="font-bold text-amber-brand">
            {f.winnerName ?? "Belum ada"}
          </span>
        </p>
        <p className="mt-1 text-xs text-paper-dim">
          {formatWIB(f.completedAt ?? f.createdAt)}
          {f.completedAt ? " (selesai)" : " (dibuat)"}
        </p>

        {f.status === "completed" ? (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            {uploaded && f.videoTask?.reelUrl ? (
              <p className="text-sm">
                <a
                  href={f.videoTask.reelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-cyan-accent hover:underline"
                >
                  Lihat Reel terunggah ↗
                </a>
              </p>
            ) : canMark ? (
              <>
                <Input
                  id={`reel-${f.fightId}`}
                  label="URL Reel Instagram"
                  hint="Tempel URL Reel, lalu tekan Tandai Terunggah. Format: instagram.com/reel/… atau /p/…"
                  value={reelUrl}
                  onChange={(e) => setReelUrl(e.target.value)}
                  placeholder="https://www.instagram.com/reel/…"
                />
                <Button size="sm" disabled={busy} onClick={markUploaded}>
                  {busy ? "Menyimpan…" : "Tandai Terunggah"}
                </Button>
              </>
            ) : (
              <p className="text-xs text-paper-dim">
                Tandai Terunggah butuh login admin (buka halaman ini lewat
                jalur admin).
              </p>
            )}
            {formError ? (
              <p role="alert" className="text-xs font-semibold text-red-400">
                {formError}
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="text-xs font-semibold text-emerald-400">
                {notice}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 border-t border-white/10 pt-3 text-xs text-paper-dim">
            Video bisa ditandai terunggah setelah fight selesai.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {f.posterDataUrl ? (
          <a
            href={f.posterDataUrl}
            download={f.posterFile}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-brand px-4 text-sm font-bold text-[#171310] transition-colors hover:bg-[#ffb63d]"
          >
            Unduh poster
          </a>
        ) : null}
        <Link
          href={`/game/${f.fightId}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-bold text-paper transition-colors hover:bg-white/10"
        >
          Lihat
        </Link>
        <Link
          href={`/game/${f.fightId}?export=1`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-bold text-paper transition-colors hover:bg-white/10"
        >
          Ekspor Video
        </Link>
      </div>
    </GlassCard>
  );
}

export default function AdminFights({ slug }: { slug: string }) {
  const [date, setDate] = useState(todayStr);
  const [fights, setFights] = useState<AdminFightRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zipBusy, setZipBusy] = useState(false);
  const [zipNotice, setZipNotice] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  // Fetch daftar saat tanggal berubah — pola AdminVideo: setState hanya di
  // dalam .then() (callback async), bukan sinkron di badan effect.
  useEffect(() => {
    let alive = true;
    clientApi<{
      date: string;
      total: number;
      fights: AdminFightRow[];
    }>(`/api/admin/fights?date=${date}`, { headers: { "x-admin-path": slug } }).then(
      (res) => {
        if (!alive) return;
        if (res.ok) {
          setFights(res.data.fights);
          setTotal(res.data.total);
          setError("");
        } else {
          setError(res.error.message);
        }
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [date, slug, refreshTick]);

  const shiftDate = (delta: number) => {
    setDate((d) => shiftWibDate(d, delta));
    setLoading(true);
  };

  const downloadZip = async () => {
    setZipBusy(true);
    setZipNotice("");
    try {
      const res = await fetch(`/api/admin/fights/posters-zip?date=${date}`, {
        headers: { "x-admin-path": slug },
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setZipNotice(j?.error?.message ?? "Gagal mengunduh ZIP.");
        return;
      }
      const blob = await res.blob();
      const count = res.headers.get("X-Poster-Count") ?? "?";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poster-${date}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setZipNotice(`ZIP terunduh: ${count} poster (${date}).`);
    } catch {
      setZipNotice("Gagal mengunduh ZIP. Periksa koneksi lalu coba lagi.");
    } finally {
      setZipBusy(false);
    }
  };

  const withPoster = fights.filter((f) => f.hasPoster).length;
  const countBy = (s: string) => fights.filter((f) => f.status === s).length;
  const isToday = date === todayStr();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Pertandingan
        </h1>
        <p className="mt-2 text-paper-dim">
          Daftar fight per hari (WIB) — unduh poster untuk upload harian, atau
          ekspor video tiap riwayat.
        </p>
        <p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-paper-dim">
          Cara unduh video: tekan{" "}
          <span className="font-bold text-paper">Ekspor Video</span> — replay
          terbuka dalam mode auto-record, biarkan fight diputar sampai
          selesai, lalu tekan tautan{" "}
          <span className="font-bold text-paper">Unduh video</span> yang
          muncul di halaman replay. Video direkam di browser admin, bukan di
          server — jadi tidak ada file video yang bisa diunduh langsung dari
          daftar ini.
        </p>
      </header>

      <GlassCard className="flex flex-wrap items-end gap-3">
        <div className="flex items-end gap-2">
          <Button
            variant="glass"
            className="min-h-[44px]"
            onClick={() => shiftDate(-1)}
            aria-label="Hari sebelumnya"
          >
            ← Kemarin
          </Button>
          <label className="grid gap-1 text-sm font-semibold">
            <span>Tanggal (WIB)</span>
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setLoading(true);
              }}
              aria-label="Tanggal pertandingan"
            />
          </label>
          <Button
            variant="glass"
            className="min-h-[44px]"
            onClick={() => shiftDate(1)}
            aria-label="Hari berikutnya"
          >
            Besok →
          </Button>
          <Button
            variant="glass"
            className="min-h-[44px]"
            onClick={() => {
              setDate(todayStr());
              setLoading(true);
            }}
            disabled={isToday}
          >
            Hari ini
          </Button>
        </div>
        <p className="min-h-[44px] text-sm font-bold text-amber-brand" role="status">
          {isToday ? "Hari ini" : date}: {total} pertarungan
          {total > 0 ? ` • ${withPoster} punya poster` : ""}
          {total > 0
            ? ` • Selesai ${countBy("completed")} • Berlangsung ${countBy("playing")} • Menunggu ${countBy("pending")}`
            : ""}
        </p>
        <div className="ms-auto">
          <Button
            onClick={downloadZip}
            disabled={zipBusy || withPoster === 0}
            className="min-h-[44px]"
          >
            {zipBusy ? "Menyiapkan ZIP…" : "Unduh semua poster"}
          </Button>
        </div>
      </GlassCard>
      {zipNotice ? (
        <p className="text-sm font-semibold text-paper-dim" role="status">
          {zipNotice}
        </p>
      ) : null}

      {error ? (
        <EmptyState title="Daftar Belum Bisa Dimuat" description={error} />
      ) : loading ? (
        <div className="space-y-3" role="status" aria-label="Memuat pertandingan…">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-24 animate-pulse" />
          ))}
        </div>
      ) : fights.length === 0 ? (
        <EmptyState
          title="Belum Ada Pertandingan"
          description={`Tidak ada fight yang dibuat pada ${date} (WIB).`}
        />
      ) : (
        <ul className="space-y-3">
          {fights.map((f) => (
            <li key={f.fightId}>
              <AdminFightRowCard
                f={f}
                slug={slug}
                onVideoTaskChange={() => setRefreshTick((t) => t + 1)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
