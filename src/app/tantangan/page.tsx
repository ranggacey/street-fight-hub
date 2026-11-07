import type { Metadata } from "next";
import TantanganClient from "./TantanganClient";

export const metadata: Metadata = {
  title: "Tantangan",
  description:
    "Tantang fighter lain 1v1, terima tantangan masuk, dan gelud di arena Street Fight Hub.",
};

export default function TantanganPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
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
