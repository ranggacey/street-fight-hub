"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { clientApi, formatWIB } from "@/components/api";
import type { ChatMessageItem, SessionUser } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Button from "@/components/Button";

/**
 * Chat global Hub (Fase 1): satu kolom chat, polling tiap 5 detik.
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
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await clientApi<{ messages: ChatMessageItem[] }>(
      "/api/chat/messages?limit=50",
    );
    if (!res.ok) {
      setLoadError(res.error.message);
      return;
    }
    setMessages(res.data.messages);
  }, []);

  useEffect(() => {
    let alive = true;
    clientApi<{ user: SessionUser }>("/api/auth/me").then((res) => {
      if (alive && res.ok) setUser(res.data.user);
    });
    // Fetch saat mount + polling 5 dtk — pola standar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [load]);

  // Scroll ke bawah saat pesan baru masuk.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

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
    await load();
  };

  return (
    <GlassCard className={`p-0 ${fill ? "flex min-h-0 flex-1 flex-col" : ""} ${className}`}>
      {showHeader ? (
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="font-display text-xl uppercase tracking-wide">
            Obrolan <span className="text-amber-brand">Global</span>
          </h3>
          <p className="mt-0.5 text-xs text-paper-mute">
            Ngobrol bareng semua fighter. Sopan, tanpa spam — maks 1 pesan / 3
            detik.
          </p>
        </div>
      ) : null}
      <div
        ref={listRef}
        className={`space-y-3 overflow-y-auto px-5 py-4 ${
          fill
            ? "min-h-0 flex-1"
            : tall
              ? "max-h-[32rem]"
              : "max-h-80"
        }`}
        aria-live="polite"
      >
        {loadError ? (
          <p className="text-sm text-paper-mute">
            Chat belum bisa dimuat ({loadError}).
          </p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-paper-mute">
            Belum ada pesan. Jadilah yang pertama menyapa arena!
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="break-words text-sm leading-relaxed">
              <span className="font-bold text-amber-brand">
                @{m.username ?? "—"}
              </span>
              <span className="ml-2 text-paper">{m.text}</span>
              <span className="ml-2 text-xs text-paper-mute">
                {formatWIB(m.createdAt ?? null)}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-white/10 px-5 py-4">
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
