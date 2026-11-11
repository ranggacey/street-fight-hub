import type { Metadata } from "next";
import GameArena from "@/components/GameArena";
import BackToHome from "@/components/BackToHome";
import PredictionBox from "@/components/PredictionBox";
import { dataOr, serverApiGet } from "@/components/server-api";
import type { Fighter } from "@/components/types";

export const metadata: Metadata = {
  title: "Arena Game",
  description:
    "Tonton dan mainkan fight 1v1 Stickman Fight Arena di Street Fight Hub — hasil terverifikasi dari seed.",
};

type GameFightResponse = {
  fight: { id: string; status: string };
  fighterA: Fighter;
  fighterB: Fighter;
};

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ fightId: string }>;
  searchParams?: Promise<{ export?: string }>;
}) {
  const { fightId } = await params;
  // Mode ekspor video (dari admin "Ekspor Video"): ?export=1 -> GameArena
  // mengirim autoRecord ke Arena (rekam otomatis saat Tarung diklik).
  const sp = (await searchParams) ?? {};
  const exportMode = sp.export === "1";

  // Data fight untuk kotak prediksi (gagal fetch = kotak tidak tampil,
  // arena tetap jalan seperti biasa).
  let predict: GameFightResponse | null = null;
  try {
    const res = await serverApiGet<GameFightResponse>(`/api/game-fights/${fightId}`);
    predict = dataOr(res, null);
  } catch {
    predict = null;
  }
  const a = predict?.fighterA;
  const b = predict?.fighterB;
  const open =
    predict?.fight?.status === "pending" || predict?.fight?.status === "playing";

  // Badge rivalitas (head-to-head pasangan ini, kalau pernah bertemu).
  let rivalryLabel: string | null = null;
  const aId = a?.id ?? (a as { _id?: string } | undefined)?._id ?? "";
  const bId = b?.id ?? (b as { _id?: string } | undefined)?._id ?? "";
  if (aId && bId) {
    try {
      const rr = await serverApiGet<{ label: string | null; rivalry: { totalFights: number } }>(
        `/api/fighters/${aId}/rivalry?opponentId=${bId}`,
      );
      const rd = dataOr(rr, null);
      if (rd && rd.rivalry?.totalFights > 0) rivalryLabel = rd.label;
    } catch {
      rivalryLabel = null;
    }
  }

  return (
    <div className="space-y-4">
      <BackToHome />
      {rivalryLabel ? (
        <p className="glass px-4 py-2 text-center text-sm font-semibold text-amber-brand">
          ⚔️ {rivalryLabel}
        </p>
      ) : null}
      <GameArena fightId={fightId} exportMode={exportMode} />
      {a && b ? (
        <PredictionBox
          fightId={fightId}
          kind="game"
          fighterA={{ id: a.id ?? (a as { _id?: string })._id ?? "", displayName: a.displayName }}
          fighterB={{ id: b.id ?? (b as { _id?: string })._id ?? "", displayName: b.displayName }}
          canPredict={open}
        />
      ) : null}
    </div>
  );
}
