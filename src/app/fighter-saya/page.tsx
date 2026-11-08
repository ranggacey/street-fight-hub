import type { Metadata } from "next";
import FighterSayaForm from "./FighterSayaForm";
import BackToHome from "@/components/BackToHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fighter Saya",
  description:
    "Buat fighter stickman-mu: nama tampil, username IG, gaya bertarung, dan deskripsi diri — lalu gabung turnamen.",
};

export default function FighterSayaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Profil adalah hub-nya: kembali ke profil, atau ke Beranda. */}
      <div className="flex flex-wrap items-center gap-1">
        <BackToHome href="/profil" label="Profil" />
        <BackToHome />
      </div>
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Fighter Saya
        </h1>
        <p className="mt-2 text-paper-dim">
          Isi identitas fighter-mu — cuma 4 isian — lalu gabung turnamen.
        </p>
      </header>
      <FighterSayaForm />
    </div>
  );
}
