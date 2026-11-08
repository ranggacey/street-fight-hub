"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import GlobalChat from "@/components/GlobalChat";
import { clientApi } from "@/components/api";
import type { ChatMessageItem } from "@/components/types";
import { CHAT_POLL_INTERVAL_MS, nextPollDelayMs } from "@/lib/polling";
import {
  countUnreadMessages,
  formatBadgeCount,
  latestMessageAt,
  loadLastReadAt,
  saveLastReadAt,
  totalBadgeCount,
} from "@/lib/chat-badge";

/**
 * Badge notifikasi (presentasional): lingkaran merah + angka putih.
 * count 0 -> tidak render apa-apa; >9 -> "9+".
 */
export function ChatBadge({ count }: { count: number }) {
  const label = formatBadgeCount(count);
  if (!label) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-brand px-1 text-[11px] font-bold leading-none text-white ring-2 ring-ink-900"
    >
      {label}
    </span>
  );
}

/**
 * Obrolan Global mengambang (FAB kanan bawah + panel pop-up).
 *
 * Menggantikan kartu chat yang dulu tertanam di halaman game: chat kini
 * tersedia di semua halaman lewat tombol bulat amber di kanan bawah, dan
 * panelnya muat penuh di HP 390px (lebar maks calc(100vw - 32px), daftar
 * pesan yang men-scroll, form kirim menempel di bawah panel).
 * Disembunyikan di /obrolan — di sana sudah ada halaman chat penuh.
 * Tema mengikuti Hub: kaca gelap hangat + amber #f5a623 sebagai satu aksen.
 *
 * Badge notifikasi (lingkaran merah + angka putih di pojok kanan atas
 * tombol): jumlah pesan chat global belum dibaca sejak terakhir kali
 * pop-up dibuka + tantangan masuk yang masih pending. 0 = badge hilang,
 * >9 = "9+". Badge ikut polling 10 detik saat tab aktif (sama seperti
 * GlobalChat); saat tab tidak aktif polling berhenti dan refresh sekali
 * saat kembali. Saat pop-up dibuka, penanda dibaca diperbarui (badge nol);
 * saat pop-up terbuka, pesan baru tidak menambah badge (sedang dibaca
 * langsung — GlobalChat memperbarui penanda saat pesan tampil).
 * Popup tantangan (ChallengeNotifications) tetap terpisah dan tidak diubah:
 * badge hanya menghitung tantangan pending, popup tetap berbunyi sendiri.
 */
export default function FloatingChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const failuresRef = useRef(0);
  // Penanda dibaca dibaca sekali saat mount; polling memakai ref supaya
  // tidak terjebak nilai lama di closure setTimeout.
  const lastReadRef = useRef<string | null>(null);
  if (lastReadRef.current === null) {
    lastReadRef.current = loadLastReadAt();
  }

  // Tutup dengan Escape saat panel terbuka.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Saat pop-up dibuka: tandai sudah dibaca (badge nol/hilang). Penanda
  // = waktu pesan terbaru saat ini; kalau belum ada pesan, pakai "now".
  // Saat pop-up terbuka, GlobalChat memperbarui penanda sendiri setiap
  // kali pesan baru tampil, jadi pesan baru tidak menambah badge.
  const markAsRead = useCallback(async () => {
    const res = await clientApi<{ messages: ChatMessageItem[] }>(
      "/api/chat/messages?limit=50",
    );
    const latest = res.ok ? latestMessageAt(res.data.messages) : null;
    const at = latest ?? new Date().toISOString();
    lastReadRef.current = at;
    saveLastReadAt(at);
    setBadgeCount(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    // setBadgeCount di markAsRead terjadi setelah await fetch (async),
    // bukan sinkron di badan effect — pola yang sama seperti load() di
    // GlobalChat.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void markAsRead();
  }, [open, markAsRead]);

  // Polling badge — HANYA saat pop-up tertutup (saat terbuka, GlobalChat
  // di dalam panel yang polling + memperbarui penanda; badge disembunyikan).
  // Pola sama seperti GlobalChat: berhenti total saat tab hidden, refresh
  // sekali saat kembali, backoff kalau fetch gagal.
  useEffect(() => {
    if (open) return;
    let alive = true;
    let timer: number | null = null;
    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    const schedule = (delay: number) => {
      clearTimer();
      timer = window.setTimeout(tick, delay);
    };
    const tick = async () => {
      if (!alive || document.hidden) return;
      const [chatRes, chRes] = await Promise.all([
        clientApi<{ messages: ChatMessageItem[] }>("/api/chat/messages?limit=50"),
        // Tantangan masuk pending — butuh login + fighter; kalau 401
        // (belum login / belum punya fighter) dihitung 0, bukan gagal.
        clientApi<{ challenges: unknown[] }>("/api/challenges?box=in&status=pending"),
      ]);
      if (!alive) return;
      const chatOk = chatRes.ok;
      if (chatOk) {
        const messages = chatRes.data.messages;
        // Inisialisasi pertama: belum ada penanda -> tandai pesan yang
        // sudah ada sebagai dibaca (badge mulai dari 0, hanya pesan BARU
        // yang dihitung; kalau tidak, badge langsung "9+" karena pesan lama).
        if (lastReadRef.current === null) {
          const latest = latestMessageAt(messages);
          if (latest) {
            lastReadRef.current = latest;
            saveLastReadAt(latest);
          }
        }
        const unread = countUnreadMessages(messages, lastReadRef.current);
        const pending = chRes.ok ? chRes.data.challenges.length : 0;
        setBadgeCount(totalBadgeCount(unread, pending));
      }
      failuresRef.current = chatOk ? 0 : failuresRef.current + 1;
      schedule(nextPollDelayMs(failuresRef.current));
    };
    const onVisible = () => {
      if (!alive || document.hidden) return;
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    void tick();
    schedule(CHAT_POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open]);

  // Halaman chat penuh sudah punya GlobalChat sendiri — jangan ganda.
  if (pathname === "/obrolan" || pathname?.startsWith("/obrolan/")) {
    return null;
  }

  const badgeLabel = formatBadgeCount(badgeCount);

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
        aria-label={
          open
            ? "Tutup obrolan global"
            : badgeLabel
              ? `Buka obrolan global, ${badgeCount} notifikasi belum dibaca`
              : "Buka obrolan global"
        }
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
        {/* Badge notifikasi: hanya saat pop-up tertutup dan ada yang belum
            dibaca. Menempel di pojok kanan atas tombol (di atas tombol,
            z-10), merah-putih, cukup besar dibaca di HP. */}
        {!open ? <ChatBadge count={badgeCount} /> : null}
      </button>
    </>
  );
}
