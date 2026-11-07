import Link from "next/link";
import type { Metadata } from "next";
import { dataOr, serverApiGet } from "@/components/server-api";
import { formatWIB, TOURNAMENT_STATUS_LABELS } from "@/components/api";
import type { Tournament } from "@/components/types";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turnamen",
  description:
    "Daftar turnamen Night Fight Championship — yang sedang dibuka, berlangsung, dan sudah selesai.",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "upcoming", label: "Pendaftaran Dibuka" },
  { value: "in_progress", label: "Berlangsung" },
  { value: "closed", label: "Pendaftaran Ditutup" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

function statusTone(status: string): "amber" | "red" | "green" | "neutral" {
  if (status === "in_progress") return "red";
  if (status === "upcoming") return "amber";
  if (status === "completed") return "green";
  return "neutral";
}

export default async function TurnamenListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const query = status ? `/api/tournaments?status=${status}` : "/api/tournaments";
  const res = await serverApiGet<{ tournaments: Tournament[] }>(query);
  const tournaments = dataOr(res, { tournaments: [] }).tournaments;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Turnamen
        </h1>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Semua turnamen Night Fight Championship. Pilih yang pendaftarannya
          masih dibuka, lalu daftarkan fighter-mu.
        </p>
      </header>

      {/* Filter status */}
      <nav
        aria-label="Filter status turnamen"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((f) => {
          const active = f.value === status;
          const href = f.value ? `/turnamen?status=${f.value}` : "/turnamen";
          return (
            <Link
              key={f.value || "all"}
              href={href}
              aria-current={active ? "true" : undefined}
              className={`flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                active
                  ? "border-amber-brand bg-amber-brand font-bold text-on-amber"
                  : "border-white/20 bg-white/5 text-paper-dim hover:bg-white/10 hover:text-paper"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {res === null ? (
        <EmptyState
          title="Data Turnamen Belum Bisa Dimuat"
          description="Server atau database mungkin belum siap. Coba muat ulang halaman ini sebentar lagi."
        />
      ) : tournaments.length === 0 ? (
        <EmptyState
          title="Tidak Ada Turnamen"
          description={
            status
              ? `Tidak ada turnamen dengan status “${TOURNAMENT_STATUS_LABELS[status] ?? status}”. Coba filter lain.`
              : "Belum ada turnamen yang dibuat. Pantau Instagram @streetfightstickman untuk pengumuman turnamen berikutnya."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tournaments.map((t) => (
            <Link
              key={t.slug}
              href={`/turnamen/${t.slug}`}
              className="glass group block p-5 transition-transform duration-150 hover:scale-[1.02]"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-2xl uppercase leading-tight tracking-wide group-hover:text-amber-brand">
                  {t.name}
                </h2>
                <Badge tone={statusTone(t.status)}>
                  {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
                </Badge>
              </div>
              <dl className="mt-3 space-y-1 text-sm text-paper-dim">
                <div className="flex justify-between gap-2">
                  <dt>Ukuran bracket</dt>
                  <dd className="font-semibold text-paper">
                    {t.bracketSize} fighter
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Peserta</dt>
                  <dd className="font-semibold text-paper">
                    {t.participantCount ?? 0} / {t.bracketSize}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Pendaftaran</dt>
                  <dd className="text-right font-semibold text-paper">
                    {formatWIB(t.regOpenAt)} — {formatWIB(t.regCloseAt)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm font-bold text-amber-brand">
                Lihat detail →
              </p>
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-paper-mute">
        Belum punya fighter?{" "}
        <Link href="/fighter-saya" className="font-semibold text-amber-brand hover:underline">
          Buat dulu di sini
        </Link>
        .
      </p>
    </div>
  );
}
