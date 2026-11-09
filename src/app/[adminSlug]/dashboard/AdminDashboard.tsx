"use client";

import { useEffect, useState } from "react";
import { clientApi } from "@/components/api";
import type { AdminStats } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import StatChip from "@/components/StatChip";
import EmptyState from "@/components/EmptyState";
import { ButtonLink } from "@/components/Button";
import AdminRecordMigration from "./AdminRecordMigration";

/** Normalisasi stats — nama field backend bisa bervariasi, pakai fallback. */
function normalizeStats(raw: Record<string, unknown>): AdminStats {
  const n = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;
  return {
    liveTournaments: n(raw.liveTournaments ?? raw.tournamentsLive ?? raw.live),
    totalFighters: n(raw.totalFighters ?? raw.fighters),
    totalUsers: n(raw.totalUsers ?? raw.users),
    videoQueueDepth: n(raw.videoQueueDepth ?? raw.queueDepth ?? raw.queue),
    pendingTasks: n(raw.pendingTasks ?? raw.pending),
  };
}

export default function AdminDashboard({ slug }: { slug: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    clientApi<Record<string, unknown>>("/api/admin/stats", {
      headers: { "x-admin-path": slug },
    }).then((res) => {
      if (!alive) return;
      if (res.ok) setStats(normalizeStats(res.data));
      else setError(res.error.message);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Dashboard Admin
        </h1>
        <p className="mt-2 text-paper-dim">
          Ringkasan turnamen, fighter, pengguna, dan antrean video.
        </p>
      </header>

      {error ? (
        <EmptyState
          title="Stats Belum Bisa Dimuat"
          description={error}
        />
      ) : !stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" role="status" aria-label="Memuat stats…">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatChip label="Turnamen Live" value={stats.liveTournaments} tone="red" />
          <StatChip label="Total Fighter" value={stats.totalFighters} tone="amber" />
          <StatChip label="Total Pengguna" value={stats.totalUsers} tone="paper" />
          <StatChip label="Antrean Video" value={stats.videoQueueDepth} tone="cyan" />
          <StatChip label="Tugas Pending" value={stats.pendingTasks} tone="amber" />
        </div>
      )}

      <AdminRecordMigration slug={slug} />

      <GlassCard>
        <h2 className="font-display text-xl uppercase tracking-wide text-amber-brand">
          Jalan Pintas
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ButtonLink href={`/${slug}/turnamen`} variant="glass">
            Kelola Turnamen
          </ButtonLink>
          <ButtonLink href={`/${slug}/video`} variant="glass">
            Antrean Video
          </ButtonLink>
          <ButtonLink href={`/${slug}/fighter`} variant="glass">
            Fighter & Pengguna
          </ButtonLink>
          <ButtonLink href={`/${slug}/pengumuman`} variant="glass">
            Buat Pengumuman
          </ButtonLink>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-paper-mute">
          Setiap aksi admin tercatat di log audit. Jangan bagikan path halaman
          ini ke siapa pun — path ini rahasia.
        </p>
      </GlassCard>
    </div>
  );
}
