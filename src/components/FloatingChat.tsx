"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GlobalChat from "@/components/GlobalChat";

/**
 * Obrolan Global mengambang (FAB kanan bawah + panel pop-up).
 *
 * Menggantikan kartu chat yang dulu tertanam di halaman game: chat kini
 * tersedia di semua halaman lewat tombol bulat amber di kanan bawah, dan
 * panelnya muat penuh di HP 390px (lebar maks calc(100vw - 32px), daftar
 * pesan yang men-scroll, form kirim menempel di bawah panel).
 * Disembunyikan di /obrolan — di sana sudah ada halaman chat penuh.
 * Tema mengikuti Hub: kaca gelap hangat + amber #f5a623 sebagai satu aksen.
 */
export default function FloatingChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Tutup dengan Escape saat panel terbuka.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  // Halaman chat penuh sudah punya GlobalChat sendiri — jangan ganda.
  if (pathname === "/obrolan" || pathname?.startsWith("/obrolan/")) {
    return null;
  }

  return (
    <>
      {open ? (
        <section
          id="floating-chat-panel"
          aria-label="Obrolan global"
          className="fixed bottom-[92px] right-4 z-50 flex max-h-[calc(100dvh-7.5rem)] w-[min(380px,calc(100vw-32px))] animate-pop-in flex-col overflow-hidden rounded-2xl border border-white/15 bg-ink-900 shadow-[0_16px_48px_rgba(0,0,0,0.55)] sm:bottom-24 sm:right-6"
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <h2 className="font-display text-lg uppercase tracking-wide">
              Obrolan <span className="text-amber-brand">Global</span>
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup obrolan global"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-paper-dim transition-colors hover:bg-white/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-amber-brand"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                className="h-5 w-5"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col">
            <GlobalChat
              fill
              showHeader={false}
              className="rounded-none border-0 bg-transparent shadow-none"
            />
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Tutup obrolan global" : "Buka obrolan global"}
        aria-expanded={open}
        aria-controls="floating-chat-panel"
        className="fixed bottom-5 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-brand text-on-amber shadow-[0_8px_28px_rgba(245,166,35,0.45)] transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-brand sm:bottom-6 sm:right-6"
      >
        {open ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="h-6 w-6"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>
    </>
  );
}
