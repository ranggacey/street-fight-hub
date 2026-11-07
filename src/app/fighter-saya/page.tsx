import type { Metadata } from "next";
import FighterSayaForm from "./FighterSayaForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fighter Saya",
  description:
    "Buat fighter stickman-mu, generate persona AI, lalu edit julukan, jurus, dan warna khasmu.",
};

export default function FighterSayaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Fighter Saya
        </h1>
        <p className="mt-2 text-paper-dim">
          Isi identitas fighter-mu, lalu biarkan AI membuatkan persona:
          julukan, kekuatan, kelemahan, jurus andalan, dan warna khas.
        </p>
      </header>
      <FighterSayaForm />
    </div>
  );
}
