import type { Metadata } from "next";
import GlobalChat from "@/components/GlobalChat";
import OpenChallenges from "@/components/OpenChallenges";
import BackToHome from "@/components/BackToHome";

export const metadata: Metadata = {
  title: "Obrolan Global",
  description:
    "Ngobrol bareng semua fighter dan terima tantangan terbuka — siapa cepat, dia yang gelud.",
};

export default function ObrolanPage() {
  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <BackToHome />
      <header className="min-w-0">
        {/*
          Judul terpotong di HP sebelumnya: Anton (display) punya kap
          huruf yang tinggi sementara text-4xl memakai leading 2.5rem —
          di layar kecil glyph atas/bawah keluar dari kotak baris dan
          terpotong di bawah navbar sticky. Perbaiki: ukuran dasar
          lebih kecil (2rem), leading eksplisit 1.15 + ruang bawah
          untuk descender, dan break-words supaya tidak overflow
          horizontal di 390px.
        */}
        <h1 className="overflow-visible break-words font-display text-[2rem] uppercase leading-[1.15] tracking-wide sm:text-4xl sm:leading-[1.1] lg:text-5xl">
          Obrolan <span className="text-amber-brand">Global</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-dim sm:text-base">
          Ngobrol bareng semua fighter — dan kalau sudah panas, buka tantangan
          terbuka: bukan ke 1 orang tertentu, tapi ke semua orang. Yang pertama
          menerima yang gelud.
        </p>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="chat-heading" className="min-w-0">
          <h2 id="chat-heading" className="sr-only">
            Obrolan Global
          </h2>
          <GlobalChat tall />
        </section>
        <div className="min-w-0">
          <OpenChallenges />
        </div>
      </div>
    </div>
  );
}
