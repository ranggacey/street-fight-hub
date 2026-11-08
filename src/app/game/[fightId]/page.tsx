import type { Metadata } from "next";
import GameArena from "@/components/GameArena";
import BackToHome from "@/components/BackToHome";

export const metadata: Metadata = {
  title: "Arena Game",
  description:
    "Tonton dan mainkan fight 1v1 Stickman Fight Arena di Street Fight Hub — hasil terverifikasi dari seed.",
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
  return (
    <div className="space-y-4">
      <BackToHome />
      <GameArena fightId={fightId} exportMode={exportMode} />
    </div>
  );
}
