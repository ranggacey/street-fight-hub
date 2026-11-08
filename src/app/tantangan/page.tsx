import type { Metadata } from "next";
import TantanganClient from "./TantanganClient";
import BackToHome from "@/components/BackToHome";

export const metadata: Metadata = {
  title: "Tantangan",
  description:
    "Tantang fighter lain 1v1, terima tantangan masuk, dan gelud di arena Street Fight Hub.",
};

export default function TantanganPage() {
  return (
    <div className="min-w-0 space-y-6">
      <BackToHome />
      <header className="min-w-0">
        {/*
          Pola yang sama dengan perbaikan judul /obrolan: Anton (display)
          punya kap huruf yang tinggi sementara text-4xl memakai leading
          2.5rem — di layar kecil glyph atas/bawah keluar dari kotak baris
          dan terpotong di bawah navbar sticky. Perbaiki: ukuran dasar
          lebih kecil (2rem), leading eksplisit 1.15, break-words.
        */}
        <h1 className="overflow-visible break-words font-display text-[2rem] uppercase leading-[1.15] tracking-wide sm:text-4xl sm:leading-[1.1] lg:text-5xl">
          Tantangan
        </h1>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Tantang fighter lain, terima tantangan yang masuk, lalu gelud di
          arena — hasil terverifikasi server, foto poster untuk game biasa,
          video untuk perebutan gelar.
        </p>
      </header>
      <TantanganClient />
    </div>
  );
}
