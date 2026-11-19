import type { Metadata } from "next";
import ThreeDFightClient from "./ThreeDFightClient";

export const metadata: Metadata = {
  title: "Gelud 3D — Eksperimen",
  description:
    "Arena eksperimen 3D untuk mencoba pergerakan gelud stickman. Bukan arena utama.",
};

/**
 * /3d-fight — halaman eksperimen 3D (bukan arena utama).
 * Semua logika 3D ada di FightScene.tsx (client, dynamic import ssr:false).
 * Tidak ada import dari engine Arena 2D dan tidak ada perubahan pada
 * route, komponen, atau logika game yang sudah ada.
 */
export default function ThreeDFightPage() {
  return <ThreeDFightClient />;
}
