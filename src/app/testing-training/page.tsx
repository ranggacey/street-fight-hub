import type { Metadata } from "next";
import BackToHome from "@/components/BackToHome";
import TrainingArena from "@/components/TrainingArena";

export const metadata: Metadata = {
  title: "Testing Training",
  description:
    "Sandbox training Street Fight Hub — coba tarung 1v1 dengan bela diri pilihan di kedua sisi, tanpa login, tanpa jatah, tanpa rekor. Hasil tidak dicatat.",
  // Halaman owner-only, tidak terdaftar di navbar/sitemap: jangan diindeks.
  robots: { index: false, follow: false },
};

export default function TestingTrainingPage() {
  return (
    <div className="space-y-4">
      <BackToHome />
      <TrainingArena />
    </div>
  );
}
