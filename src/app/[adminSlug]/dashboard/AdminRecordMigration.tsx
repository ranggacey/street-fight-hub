"use client";

import { useState } from "react";
import { clientApi } from "@/components/api";
import type { FighterRecord } from "@/components/types";
import { recordsEqual } from "@/lib/admin/record-migration";
import GlassCard from "@/components/GlassCard";
import EmptyState from "@/components/EmptyState";

/**
 * Migrasi rekor satu kali (2026-11-08): satukan `record` + `casualRecord`
 * lama menjadi SATU record. Tombol ini menggantikan cara konsol DevTools
 * (browser task tidak bisa membuka konsol) — dry-run + apply cukup diklik
 * dari dashboard admin ini.
 *
 * Auth: sesi admin (cookie, otomatis terkirim) + header x-admin-path yang
 * diambil dari slug halaman ini sendiri (prop `slug` = path /{slug}/...).
 * JANGAN hardcode slug/token di kode — pola itu memicu alert GitGuardian.
 *
 * Gate ketat (cek sebelum klik Terapkan): kolom Gabungan HARUS sama dengan
 * Hitung ulang GABUNGAN (kasual + turnamen) untuk SEMUA fighter, dan angka
 * gabungan HARUS cocok dengan tabel harapan di bawah. Kalau ada satu angka
 * saja beda, JANGAN terapkan.
 *
 * Catatan: Hitung ulang gabungan = GameFight completed + Match turnamen
 * yang sudah diputuskan (decided/video_done). GameFight saja tidak cukup
 * karena `record` lama juga berisi hasil turnamen simulasi (draw.ts) yang
 * tidak punya dokumen GameFight.
 */

interface MigrationFighterPlan {
  fighterId: string;
  displayName: string;
  storedRecord: FighterRecord;
  storedCasual: FighterRecord;
  recountFromGameFights: FighterRecord;
  recountFromTournament: FighterRecord;
  recountTotal: FighterRecord;
  casualMatchesRecount: boolean;
  mergedRecord: FighterRecord;
  alreadyMigrated: boolean;
}

interface MigrationPlanResponse {
  dryRun: boolean;
  decidedMatches: number;
  completedFights: number;
  fighters: MigrationFighterPlan[];
}

interface MigrationApplyResponse extends MigrationPlanResponse {
  applied: number;
  skipped: number;
}

/** Tabel harapan hasil gabungan (2026-11-11, 13 fight, 6 turnamen decided). */
const EXPECTED = [
  "Dayrot jagoan 5-3-0, 2 KO",
  "Sijagoan Batak 3-0-0, 2 KO",
  "Nope boy 1-1-0, 1 KO",
  "Jamal geng sebelah 2-4-0",
  "STRIVOX 1-2-0",
  "zahran petarung 1-0-0",
  "Pitung 1-2-0, 1 KO",
  "pemuda licik 3-3-0, 1 KO",
  "Lang 0-1-0",
  "the prince 2-2-0, 1 KO",
  "esje 0-1-0",
  "sisanya 0-0-0",
].join(" • ");

function fmt(r: FighterRecord): string {
  return `${r.wins}-${r.losses}-${r.draws} • ${r.kos}KO`;
}

export default function AdminRecordMigration({ slug }: { slug: string }) {
  const [plan, setPlan] = useState<MigrationPlanResponse | null>(null);
  const [result, setResult] = useState<MigrationApplyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const allMergedMatchRecount =
    plan !== null &&
    plan.fighters.length > 0 &&
    plan.fighters.every((f) =>
      recordsEqual(f.mergedRecord, f.recountTotal),
    );

  async function loadDryRun() {
    setLoading(true);
    setError("");
    setResult(null);
    const res = await clientApi<MigrationPlanResponse>(
      "/api/admin/migrate-record",
      { headers: { "x-admin-path": slug } },
    );
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setPlan(res.data);
  }

  async function applyMigration() {
    if (!plan || !allMergedMatchRecount) return;
    const ok = window.confirm(
      "Terapkan migrasi rekor? Rekor tiap fighter akan digabung (rekor lama + kasual lama) dan field kasual lama dihapus. Periksa dulu tabel dry-run di atas cocok dengan tabel harapan.",
    );
    if (!ok) return;
    setApplying(true);
    setError("");
    const res = await clientApi<MigrationApplyResponse>(
      "/api/admin/migrate-record",
      { method: "POST", headers: { "x-admin-path": slug } },
    );
    setApplying(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setResult(res.data);
    setPlan(res.data);
  }

  return (
    <GlassCard className="border-amber-brand/40">
      <h2 className="font-display text-xl uppercase tracking-wide text-amber-brand">
        Migrasi Rekor (Satu Kali)
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
        Menyatukan rekor lama (turnamen) + rekor kasual menjadi SATU rekor
        untuk semua fight. Data lama TIDAK direset — hanya digabung. Cek
        dry-run dulu, bandingkan dengan tabel harapan, baru terapkan.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
        <span className="font-bold text-paper">Tabel harapan:</span> {EXPECTED}.
        Total 13 fight, 6 match turnamen decided.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-paper-mute">
        Tanda ✗ di kolom &ldquo;Kasual cocok?&rdquo; wajar untuk fighter yang
        sudah main SETELAH update penyatuan rekor — fight barunya sudah
        tercatat di kolom Rekor, jadi hitung ulang kasual (semua fight) lebih
        besar dari kasual tersimpan. Yang penting: kolom Gabungan SAMA dengan
        Hitung ulang GABUNGAN (kasual + turnamen) untuk semua fighter.
      </p>

      {error ? (
        <div className="mt-4">
          <EmptyState title="Migrasi Belum Bisa Dijalankan" description={error} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={loadDryRun}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-brand px-5 py-2.5 text-sm font-bold text-on-amber transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Memuat…" : "Lihat Dry-Run"}
        </button>
        <button
          type="button"
          onClick={applyMigration}
          disabled={!plan || !allMergedMatchRecount || applying || result !== null}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-red-brand bg-red-brand/15 px-5 py-2.5 text-sm font-bold text-red-brand transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {applying ? "Menerapkan…" : "Terapkan Migrasi"}
        </button>
      </div>

      {plan ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-paper-dim">
            Fight selesai: <strong className="text-paper">{plan.completedFights}</strong>
            {" • "}
            Match turnamen decided:{" "}
            <strong className="text-paper">{plan.decidedMatches}</strong>
            {" • "}
            Gabungan == Hitung ulang gabungan (semua fighter):{" "}
            <strong className={allMergedMatchRecount ? "text-green-400" : "text-red-brand"}>
              {allMergedMatchRecount ? "YA" : "TIDAK — JANGAN TERAPKAN"}
            </strong>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wider text-paper-mute">
                  <th className="py-2 pr-2">Fighter</th>
                  <th className="py-2 pr-2">Rekor</th>
                  <th className="py-2 pr-2">Kasual</th>
                  <th className="py-2 pr-2">Hitung ulang</th>
                  <th className="py-2 pr-2">Gabungan</th>
                  <th className="py-2 pr-2">Kasual cocok?</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {plan.fighters.map((f) => (
                  <tr key={f.fighterId} className="border-b border-white/5">
                    <td className="py-2 pr-2 font-semibold text-paper">
                      {f.displayName}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{fmt(f.storedRecord)}</td>
                    <td className="py-2 pr-2 tabular-nums">{fmt(f.storedCasual)}</td>
                    <td className="py-2 pr-2 tabular-nums">
                      {fmt(f.recountFromGameFights)}
                    </td>
                    <td className="py-2 pr-2 font-bold tabular-nums text-amber-brand">
                      {fmt(f.mergedRecord)}
                    </td>
                    <td className="py-2 pr-2">
                      {f.casualMatchesRecount ? "✓" : "✗"}
                    </td>
                    <td className="py-2 text-paper-dim">
                      {f.alreadyMigrated ? "Sudah" : "Belum"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-green-400/40 bg-green-400/10 px-4 py-3">
          <p className="font-bold text-green-400">
            Migrasi selesai: {result.applied} diterapkan, {result.skipped} dilewati.
          </p>
          <p className="mt-1 text-sm text-paper-dim">
            Cek /klasemen dan home — rekor tiap fighter harus sama dengan
            tabel harapan. Setelah terverifikasi, route migrasi ini akan
            dimatikan.
          </p>
        </div>
      ) : null}
    </GlassCard>
  );
}
