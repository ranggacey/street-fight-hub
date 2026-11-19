"use client";

import { useEffect } from "react";
import Link from "next/link";
import GlassCard from "./GlassCard";
import Button from "./Button";

/**
 * Tutorial sekali untuk pengguna pertama di /tantangan.
 * Modal overlay di tengah layar: 4 langkah cara bertarung, dengan
 * tombol "Mengerti" dan "Lewati" yang sama-sama menutup modal.
 * Menandai sudah-dilihat dilakukan pemanggil lewat onClose (supaya
 * flag tersimpan sekali, di satu tempat).
 *
 * Pola overlay mengikuti src/components/Modal.tsx: backdrop gelap +
 * blur, klik backdrop menutup, Escape menutup, scroll body dikunci
 * selama modal terbuka, panel GlassCard responsif untuk HP.
 */

type Step = {
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "Siapkan deck dulu",
    body: "Pilih kartu jurusmu di halaman latihan sebelum menantang, supaya petarungmu siap bertarung.",
  },
  {
    title: "Pilih lawan",
    body: "Pilih satu fighter dari daftar lawan yang tersedia, atau tantang banyak orang sekaligus.",
  },
  {
    title: "Pilih arena",
    body: "Tentukan arena tempat pertarungan berlangsung: ring tinju, gudang, jalanan malam, atau dojo.",
  },
  {
    title: "Kirim tantangan",
    body: "Kirim tantanganmu. Yang menerima duluan yang bertarung, tantangan ke yang lain otomatis batal.",
  },
];

export default function TantanganTutorial({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <GlassCard
        strong
        className="w-full max-w-md animate-pop-in motion-reduce:animate-none"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cara Bertarung"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-2xl uppercase tracking-wide text-paper">
            Cara <span className="text-amber-brand">Bertarung</span>
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-paper-dim">
            Empat langkah singkat sebelum tantangan pertamamu.
          </p>

          <ol className="mt-5 space-y-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-brand/15 font-display text-base text-amber-brand"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-bold leading-snug text-paper">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-paper-dim">
                    {step.body}
                  </p>
                  {i === 0 ? (
                    <Link
                      href="/latihan"
                      onClick={onClose}
                      className="mt-1 inline-block text-sm font-semibold text-amber-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-amber-brand"
                    >
                      Buka halaman latihan
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>
              Lewati
            </Button>
            <Button variant="primary" onClick={onClose}>
              Mengerti
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
