"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, formatWIB } from "@/components/api";
import GlassCard from "@/components/GlassCard";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/Input";

/**
 * Admin "Pertandingan": daftar fight per hari WIB + unduh poster + ekspor video.
 * - Poster diambil dari posterDataUrl yang sudah tersimpan (TIDAK render ulang).
 * - "Unduh semua poster" = satu ZIP dari server (poster-YYYY-MM-DD.zip).
 * - "Ekspor Video" = buka replay fight di /game/[id]?export=1 (mode auto-record).
 */
export interface AdminFightRow {
  fightId: string;
  fighterA: { displayName: string; igUsername: string };
  fighterB: { displayName: string; igUsername: string };
  score: { a: number | null; b: number | null };
  method: string | null;
  status: string;
  isTitleFight: boolean;
  createdAt: string;
  completedAt: string | null;
  hasPoster: boolean;
  posterDataUrl: string | null;
  posterFile: string;
}

function todayStr(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function scoreText(f: AdminFightRow): string {
  if (f.score.a === null || f.score.b === null) return "Belum ada skor";
  return `${f.score.a} - ${f.score.b}`;
}

/**
 * Satu baris riwayat fight (presentasional — tanpa fetch, supaya bisa dites
 * render statis): thumbnail + nama + skor + unduh poster satuan +
 * tombol "Ekspor Video" ke replay dengan mode export aktif (?export=1).
 */
export function AdminFightRowCard({ f }: { f: AdminFightRow }) {
  return (
    <GlassCard className="flex flex-wrap items-center gap-4">
      {f.posterDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={f.posterDataUrl}
          alt={`Poster ${f.fighterA.displayName} vs ${f.fighterB.displayName}`}
          className="h-28 w-[63px] rounded-lg object-cover object-top ring-1 ring-white/15"
        />
      ) : (
        <div className="flex h-28 w-[63px] items-center justify-center rounded-lg bg-white/5 text-center text-[11px] font-semibold text-paper-dim ring-1 ring-white/15">
          Belum ada poster
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="break-words font-display text-xl uppercase leading-tight tracking-wide">
          {f.fighterA.displayName}{" "}
          <span className="text-amber-brand">vs</span>{" "}
          {f.fighterB.displayName}
        </p>
        <p className="mt-1 text-sm font-bold text-paper">
          Skor: {scoreText(f)}
          {f.method ? ` • ${f.method === "KO" ? "KO" : f.method === "decision" ? "Menang angka" : "Seri"}` : ""}
          {f.isTitleFight ? " • Perebutan gelar" : ""}
        </p>
        <p className="mt-1 text-xs text-paper-dim">
          {formatWIB(f.completedAt ?? f.createdAt)} • Status: {f.status}
        </p>
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
  }, [date, slug]);

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
      </header>

      <GlassCard className="flex flex-wrap items-end gap-3">
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
        <p className="min-h-[44px] text-sm font-bold text-amber-brand" role="status">
          {date === todayStr() ? "Hari ini" : date}: {total} pertarungan
          {total > 0 ? ` • ${withPoster} punya poster` : ""}
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
              <AdminFightRowCard f={f} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
