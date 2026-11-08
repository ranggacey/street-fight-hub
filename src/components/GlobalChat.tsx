"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { clientApi } from "@/components/api";
import type { ChatMessageItem, SessionUser } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import FightLoader from "@/components/FightLoader";
import Button from "@/components/Button";
import { CHAT_POLL_INTERVAL_MS, nextPollDelayMs } from "@/lib/polling";
import { latestMessageAt, loadLastReadAt, saveLastReadAt } from "@/lib/chat-badge";
import ChatMessageRow from "@/components/ChatMessageRow";

/**
 * Chat global Hub (Fase 1): satu kolom chat, polling tiap 10 detik.
 * - Polling BERHENTI saat tab tidak aktif (visibilitychange) dan langsung
 *   refresh sekali saat tab kembali aktif — tab yang ditinggal terbuka
 *   tidak memborbardir server. Kalau fetch gagal, jeda membesar
 *   (backoff 10 → 20 → 40 → 60 detik) sampai sukses lagi.
 * - Kirim butuh login (tombol kirim disembunyikan kalau belum login).
 * - Batas 500 karakter (counter terlihat), error rate-limit terlihat.
 * - Teks dirender sebagai teks biasa (React escape default) — tidak ada
 *   dangerouslySetInnerHTML untuk chat.
 * - Prop `tall`: di halaman /obrolan chat diberi ruang lebih tinggi.
 * - Prop `fill` + `showHeader={false}`: dipakai panel pop-up FloatingChat —
 *   daftar pesan mengisi tinggi panel (form kirim menempel di bawah) dan
 *   header disembunyikan karena panel sudah punya header + tombol tutup
 *   sendiri.
 * - Baris input memakai flex-1 min-w-0 + tombol shrink-0 supaya input +
 *   tombol Kirim tidak pernah terpotong di layar HP 390px.
 * - Identitas pengirim = PP + nama fighter (ChatMessageRow); username
 *   hanya tampil kalau pengirim belum punya fighter.
 * - Auto-scroll hanya kalau user sudah di dekat bawah; kalau tidak, muncul
 *   pill "Pesan baru ↓" yang bisa di-tap untuk lompat ke bawah.
 */
export default function GlobalChat({
  tall = false,
  fill = false,
  showHeader = true,
  className = "",
}: {
  tall?: boolean;
  fill?: boolean;
  showHeader?: boolean;
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  // Loading awal (hanya fetch pertama): tampilkan GIF stickman gelud
  // sampai daftar pesan pertama selesai dimuat — polling 10 detik
  // berikutnya TIDAK memunculkan loader lagi.
  const [loading, setLoading] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const prevLengthRef = useRef(0);
  const loadedOnceRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const load = useCallback(async (): Promise<boolean> => {
    const res = await clientApi<{ messages: ChatMessageItem[] }>(
      "/api/chat/messages?limit=50",
    );
    // Fetch pertama selesai (sukses/gagal) -> loader awal hilang.
    // Set di sini supaya loader tidak nempel kalau fetch gagal.
    setLoading(false);
    if (!res.ok) {
      setLoadError(res.error.message);
      return false;
    }
    setLoadError("");
    setMessages(res.data.messages);
    // Pesan sedang DITAMPILKAN (di pop-up maupun di /obrolan) -> tandai
    // sudah dibaca: penanda = waktu pesan terbaru. Badge FloatingChat
    // membaca penanda ini, jadi pesan yang tampil di sini tidak dihitung
    // belum dibaca (termasuk pesan baru saat pop-up terbuka).
    const latest = latestMessageAt(res.data.messages);
    if (latest) {
      const prev = loadLastReadAt();
      if (!prev || Date.parse(latest) > Date.parse(prev)) saveLastReadAt(latest);
    }
    return true;
  }, []);

  // Jumlah kegagalan fetch beruntun (untuk backoff polling).
  const failuresRef = useRef(0);

  useEffect(() => {
    let alive = true;
    clientApi<{ user: SessionUser }>("/api/auth/me").then((res) => {
      if (alive && res.ok) setUser(res.data.user);
    });
    // Fetch saat mount + polling terjadwal (bukan setInterval kaku):
    // - berhenti total saat tab hidden (tidak ada request sama sekali);
    // - langsung refresh saat tab kembali aktif;
    // - jeda membesar kalau fetch gagal (backoff), reset saat sukses.
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
      const okRes = await load();
      if (!alive) return;
      failuresRef.current = okRes ? 0 : failuresRef.current + 1;
      schedule(nextPollDelayMs(failuresRef.current));
    };
    const onVisible = () => {
      if (!alive || document.hidden) return;
      void load().then((okRes) => {
        if (!alive) return;
        failuresRef.current = okRes ? 0 : failuresRef.current + 1;
        schedule(nextPollDelayMs(failuresRef.current));
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    schedule(CHAT_POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Lacak apakah user sedang di dekat bawah daftar (untuk auto-scroll).
  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    nearBottomRef.current = nearBottom;
    if (nearBottom) setNewCount(0);
  }, []);

  // Pesan baru: scroll ke bawah hanya kalau user sudah di dekat bawah;
  // kalau sedang membaca ke atas, hitung pesan baru untuk pill.
  useEffect(() => {
    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      prevLengthRef.current = messages.length;
      scrollToBottom();
      return;
    }
    const grew = messages.length - prevLengthRef.current;
    prevLengthRef.current = messages.length;
    if (grew <= 0) return;
    if (nearBottomRef.current) {
      scrollToBottom();
    } else {
      setNewCount((c) => c + grew);
    }
  }, [messages.length, messages, scrollToBottom]);

  const jumpToBottom = useCallback(() => {
    nearBottomRef.current = true;
    setNewCount(0);
    scrollToBottom();
  }, [scrollToBottom]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    const res = await clientApi<{ message: ChatMessageItem }>("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({ text: trimmed }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setText("");
    // Pesan sendiri: langsung lompat ke bawah, jangan tunggu polling.
    nearBottomRef.current = true;
    setNewCount(0);
    await load();
    scrollToBottom();
  };

  return (
    <GlassCard className={`p-0 ${fill ? "flex min-h-0 flex-1 flex-col" : ""} ${className}`}>
      {showHeader ? (
        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
          <h3 className="font-display text-xl uppercase tracking-wide">
            Obrolan <span className="text-amber-brand">Global</span>
          </h3>
          <p className="mt-0.5 text-xs text-paper-mute">
            Ngobrol bareng semua fighter. Sopan, tanpa spam — maks 1 pesan / 3
            detik.
          </p>
        </div>
      ) : null}
      <div className={`relative min-h-0 ${fill ? "flex flex-1 flex-col" : ""}`}>
        <div
          ref={listRef}
          onScroll={onScroll}
          className={`space-y-4 overflow-y-auto px-4 py-4 sm:px-5 ${
            fill
              ? "min-h-0 flex-1"
              : tall
                ? "h-[32rem] max-h-[62dvh]"
                : "max-h-80"
          }`}
          role="log"
          aria-live="polite"
          aria-label="Pesan obrolan global"
        >
          {loading ? (
            <FightLoader size="sm" label="Memuat obrolan…" />
          ) : loadError ? (
            <div role="alert" className="rounded-xl border border-red-brand/40 bg-red-brand/10 px-4 py-4 text-center">
              <p className="text-sm font-semibold text-red-400">
                Chat belum bisa dimuat.
              </p>
              <p className="mt-1 text-xs text-paper-dim">{loadError}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setLoadError("");
                  load();
                }}
              >
                Coba lagi
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span
                aria-hidden="true"
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-brand/40 bg-amber-brand/10 text-amber-brand"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </span>
              <p className="font-display text-lg uppercase tracking-wide text-paper">
                Arena masih sepi
              </p>
              <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-paper-dim">
                Belum ada pesan. Jadilah yang pertama menyapa para fighter —
                tantang mereka, atau sekadar bilang halo.
              </p>
              {!user ? (
                <p className="mt-3 text-sm text-paper-dim">
                  <Link href="/masuk" className="font-semibold text-amber-brand hover:underline">
                    Masuk
                  </Link>{" "}
                  dulu untuk ikut mengobrol.
                </p>
              ) : null}
            </div>
          ) : (
            messages.map((m) => (
              <ChatMessageRow
                key={m.id}
                message={m}
                isOwn={!!user && !!m.userId && m.userId === user.id}
              />
            ))
          )}
        </div>
        {newCount > 0 ? (
          <button
            type="button"
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 inline-flex min-h-[44px] -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-brand px-4 text-sm font-bold text-on-amber shadow-[0_8px_24px_rgba(245,166,35,0.45)]"
          >
            ↓ {newCount} pesan baru
          </button>
        ) : null}
      </div>
      <div className="border-t border-white/10 px-4 py-4 sm:px-5">
        {user ? (
          <form onSubmit={send} className="space-y-2">
            <div className="flex min-w-0 gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                placeholder="Tulis pesan… (maks 500 karakter)"
                maxLength={500}
                aria-label="Pesan chat"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-paper placeholder:text-paper-mute focus:border-amber-brand focus:outline-none focus:ring-2 focus:ring-amber-brand/40"
              />
              <Button
                type="submit"
                disabled={busy || text.trim().length === 0}
                className="shrink-0"
              >
                {busy ? "…" : "Kirim"}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-paper-mute">
                {text.length}/500 karakter
              </p>
              {error ? (
                <p role="alert" className="text-xs font-semibold text-red-400">
                  {error}
                </p>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="text-sm text-paper-dim">
            <Link href="/masuk" className="font-semibold text-amber-brand hover:underline">
              Masuk
            </Link>{" "}
            dulu untuk ikut mengobrol.
          </p>
        )}
      </div>
    </GlassCard>
  );
}
