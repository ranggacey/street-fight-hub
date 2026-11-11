"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi } from "@/components/api";
import GlassCard from "@/components/GlassCard";
import Button from "@/components/Button";

/**
 * Kotak prediksi penonton — taruhan 10 koin atas pemenang fight.
 * Benar → +20 koin; salah → stake hangus. Satu prediksi per user
 * per fight. Dipakai di halaman fight (/game/[id]) dan pertandingan
 * turnamen (/pertandingan/[id]) — ringkas, di bawah arena/hasil.
 */

export interface PredictFighter {
  id: string;
  displayName: string;
}

type PredictionsResponse = {
  counts: Record<string, number>;
  total: number;
  myPrediction: {
    predictedWinnerFighterId: string;
    status: string;
    payout: number;
  } | null;
};

export default function PredictionBox({
  fightId,
  kind,
  fighterA,
  fighterB,
  canPredict,
}: {
  fightId: string;
  kind: "game" | "tournament";
  fighterA: PredictFighter;
  fighterB: PredictFighter | null;
  /** false kalau fight sudah selesai / belum ada lawan. */
  canPredict: boolean;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [myPrediction, setMyPrediction] = useState<PredictionsResponse["myPrediction"]>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await clientApi<PredictionsResponse>(
      `/api/predictions?fightId=${encodeURIComponent(fightId)}&kind=${kind}`,
    );
    if (res.ok) {
      setCounts(res.data.counts ?? {});
      setTotal(res.data.total ?? 0);
      setMyPrediction(res.data.myPrediction ?? null);
    }
  }, [fightId, kind]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function predict(fighterId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    const res = await clientApi<{ coins: number }>("/api/predictions", {
      method: "POST",
      body: JSON.stringify({ fightId, kind, predictedWinnerFighterId: fighterId }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice(`Prediksi tercatat! Taruhan 10 koin — benar dapat +20 koin. Sisa koin: ${res.data.coins}.`);
    await load();
  }

  const fighters = [fighterA, fighterB].filter(
    (f): f is PredictFighter => Boolean(f),
  );
  const myPick = myPrediction?.predictedWinnerFighterId ?? null;

  return (
    <GlassCard className="px-4 py-4">
      <h2 className="font-display text-2xl uppercase tracking-wide">
        Prediksi <span className="text-amber-brand">Penonton</span>
      </h2>
      <p className="mt-1 text-sm text-paper-dim">
        Tebak pemenangnya — taruhan 10 koin, benar dapat +20 koin.{" "}
        {total > 0 ? `${total} prediksi masuk.` : "Belum ada prediksi."}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {fighters.map((f) => {
          const count = counts[f.id] ?? 0;
          const isMine = myPick === f.id;
          return (
            <div
              key={f.id}
              className={`rounded-xl border px-3 py-3 ${
                isMine
                  ? "border-amber-brand bg-amber-brand/10"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <p className="font-semibold text-paper">{f.displayName}</p>
              <p className="mt-0.5 text-sm text-paper-dim">
                {count} prediksi{isMine ? " • Pilihanmu" : ""}
                {isMine && myPrediction?.status === "won"
                  ? ` • Menang! +${myPrediction.payout} koin`
                  : ""}
                {isMine && myPrediction?.status === "lost" ? " • Kalah" : ""}
              </p>
              {canPredict && !myPick ? (
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={busy}
                  onClick={() => predict(f.id)}
                >
                  {busy ? "…" : `Prediksi ${f.displayName} (10 koin)`}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {myPick && canPredict ? (
        <p className="mt-2 text-sm text-paper-dim">
          Prediksimu sudah tercatat — satu prediksi per fight.
        </p>
      ) : null}
      {!canPredict ? (
        <p className="mt-2 text-sm text-paper-dim">
          Prediksi ditutup — fight sudah selesai atau belum ada lawan.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm font-semibold text-red-400">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-2 text-sm font-semibold text-emerald-400">{notice}</p>
      ) : null}
    </GlassCard>
  );
}
