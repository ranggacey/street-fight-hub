"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const FightScene = dynamic(() => import("./FightScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[52vh] items-center justify-center rounded-2xl border border-white/10 bg-ink-900 md:h-[60vh]">
      <p className="text-paper-dim">Memuat arena 3D…</p>
    </div>
  ),
});

/**
 * /3d-fight — wrapper client untuk scene 3D.
 * Scene dimuat dinamis tanpa SSR (WebGL hanya ada di browser).
 */
export default function ThreeDFightClient() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl uppercase tracking-wide text-paper md:text-5xl">
            Gelud <span className="text-amber-brand">3D</span>
          </h1>
          <span className="rounded-full border border-amber-brand/40 bg-amber-brand/10 px-3 py-1 text-xs font-semibold text-amber-brand">
            Eksperimen 3D — bukan arena utama
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-dim">
          Coba-coba pergerakan gelud 3D. Petarung merah menyerang,
          petarung biru bertahan. Seret untuk memutar kamera, scroll
          untuk zoom, atau pakai tombol dan keyboard di bawah.
        </p>
      </header>

      <FightScene />

      <p className="mt-4 text-center text-sm text-paper-mute">
        Halaman eksperimen — tidak memengaruhi arena 2D atau data
        pertarungan.{" "}
        <Link href="/" className="font-semibold text-amber-brand underline">
          Kembali ke Beranda
        </Link>
      </p>
    </div>
  );
}
