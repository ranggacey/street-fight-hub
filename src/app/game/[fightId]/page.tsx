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
}: {
  params: Promise<{ fightId: string }>;
}) {
  const { fightId } = await params;
  return (
    <div className="space-y-4">
      <BackToHome />
      <GameArena fightId={fightId} />
    </div>
  );
}
