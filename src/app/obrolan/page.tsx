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
    <div className="space-y-8">
      <BackToHome />
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Obrolan <span className="text-amber-brand">Global</span>
        </h1>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Ngobrol bareng semua fighter — dan kalau sudah panas, buka tantangan
          terbuka: bukan ke 1 orang tertentu, tapi ke semua orang. Yang pertama
          menerima yang gelud.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="chat-heading">
          <h2 id="chat-heading" className="sr-only">
            Obrolan Global
          </h2>
          <GlobalChat tall />
        </section>
        <OpenChallenges />
      </div>
    </div>
  );
}
