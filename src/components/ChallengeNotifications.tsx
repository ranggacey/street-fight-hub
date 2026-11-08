"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, getId } from "@/components/api";
import type { AppNotification, SessionUser } from "@/components/types";
import {
  CHALLENGE_NOTIF_MUTED_KEY,
  CHALLENGE_NOTIF_SEEN_KEY,
  CHALLENGE_POLL_INTERVAL_MS,
  CHALLENGE_POPUP_DURATION_MS,
  formatChallengeNotification,
  notificationId,
  pickUnseenNotifications,
} from "@/lib/game/challenge-notifications";

/**
 * Notifikasi tantangan custom (popup + suara) — global, dipasang di root
 * layout di samping <FloatingChat />.
 *
 * - Polling GET /api/notifications?unread=1 tiap 15 detik, hanya saat
 *   login dan hanya saat tab aktif (document.hidden dilewati).
 * - Polling PERTAMA hanya jadi baseline: notifikasi unread lama tidak
 *   dipopup-kan; hanya yang muncul SETELAH mount yang berbunyi.
 * - Satu kejadian = satu popup; antrean ditampilkan satu per satu.
 * - Popup custom ala Hub (kartu kaca + amber), BUKAN window.alert dan
 *   bukan notifikasi browser. Posisi kanan ATAS supaya tidak menutupi
 *   FAB chat kanan bawah. Auto-hilang ~7 detik, atau ditutup/diklik.
 * - SUARA: chime WebAudio (tiga nada naik, oscillator — tanpa file
 *   audio). AudioContext hanya dibuka setelah interaksi pertama user
 *   (pointerdown/keydown) sesuai kebijakan autoplay browser; sebelum
 *   itu popup tetap tampil tanpa bunyi. Toggle bisu kecil di popup,
 *   pilihan disimpan di localStorage.
 * - ANTI-SPAM: id yang sudah ditampilkan disimpan di localStorage
 *   (kapasitas 200 id terbaru) + server ditandai read saat popup
 *   diklik/ditutup, jadi notifikasi tidak pernah muncul dua kali.
 */

const MAX_SEEN_STORED = 200;

/** Tiga nada naik (E5 → G#5 → B5): chime pendek khas arena, bukan bunyi default. */
const CHIME_NOTES_HZ = [659.25, 830.61, 987.77];
const CHIME_NOTE_GAP_MS = 90;
const CHIME_NOTE_LEN_SEC = 0.45;

function loadSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CHALLENGE_NOTIF_SEEN_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(CHALLENGE_NOTIF_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function ChallengeNotifications() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const [current, setCurrent] = useState<AppNotification | null>(null);
  const [muted, setMuted] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const seenRef = useRef<Set<string> | null>(null);
  const baselineDoneRef = useRef(false);
  const currentRef = useRef<AppNotification | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const queueRef = useRef<AppNotification[]>([]);

  // Sinkronkan ref SETELAH commit (bukan saat render) — react-hooks/refs.
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const persistSeen = useCallback(() => {
    const seen = seenRef.current;
    if (!seen) return;
    try {
      const arr = [...seen].slice(-MAX_SEEN_STORED);
      localStorage.setItem(CHALLENGE_NOTIF_SEEN_KEY, JSON.stringify(arr));
    } catch {
      // localStorage penuh/tidak tersedia — dedup in-memory tetap jalan.
    }
  }, []);

  const markRead = useCallback((id: string) => {
    if (!id) return;
    void clientApi("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ action: "read", ids: [id] }),
    });
  }, []);

  /* ---------- suara: unlock sekali di interaksi pertama ---------- */
  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        audioRef.current = ctx;
        if (ctx.state === "suspended") void ctx.resume();
      } catch {
        audioRef.current = null;
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const playChime = useCallback(() => {
    if (muted) return;
    const ctx = audioRef.current;
    if (!ctx || !unlockedRef.current) return;
    if (ctx.state === "suspended") void ctx.resume();
    try {
      const master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      const now = ctx.currentTime;
      CHIME_NOTES_HZ.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.value = freq;
        const start = now + (i * CHIME_NOTE_GAP_MS) / 1000;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(1, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          start + CHIME_NOTE_LEN_SEC,
        );
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + CHIME_NOTE_LEN_SEC + 0.05);
      });
    } catch {
      // Suara gagal (mis. AudioContext diblokir) — popup tetap tampil.
    }
  }, [muted]);

  /* ---------- login dulu: belum login = tidak polling sama sekali ---------- */
  useEffect(() => {
    let alive = true;
    // Muat pilihan bisu setelah mount (bukan saat render) supaya tidak ada
    // hydration mismatch; ditunda satu tick supaya tidak setState sinkron
    // di dalam effect (react-hooks/set-state-in-effect).
    const mutedTimer = window.setTimeout(() => {
      try {
        setMuted(loadMuted());
      } catch {
        /* abaikan */
      }
    }, 0);
    clientApi<{ user: SessionUser }>("/api/auth/me").then((res) => {
      if (alive && res.ok) setLoggedIn(true);
    });
    return () => {
      alive = false;
      window.clearTimeout(mutedTimer);
    };
  }, []);

  /* ---------- tampilkan antrean satu per satu ---------- */
  const showNext = useCallback(() => {
    const next = queueRef.current[0];
    if (!next) {
      setCurrent(null);
      setQueueCount(0);
      return;
    }
    queueRef.current = queueRef.current.slice(1);
    setQueue(queueRef.current);
    setQueueCount(queueRef.current.length);
    setCurrent(next);
    playChime();
  }, [playChime]);

  const dismissCurrent = useCallback(
    (markAsRead: boolean) => {
      const item = currentRef.current;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (item && markAsRead) markRead(notificationId(item));
      setCurrent(null);
      // Beri jeda singkat sebelum popup berikutnya supaya tidak menumpuk.
      window.setTimeout(showNext, 250);
    },
    [markRead, showNext],
  );

  // Auto-hilang setelah beberapa detik.
  useEffect(() => {
    if (!current) return;
    timerRef.current = window.setTimeout(() => {
      dismissCurrent(true);
    }, CHALLENGE_POPUP_DURATION_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [current, dismissCurrent]);

  // Tutup dengan Escape.
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissCurrent(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, dismissCurrent]);

  /* ---------- polling ---------- */
  useEffect(() => {
    if (!loggedIn) return;
    if (seenRef.current === null) seenRef.current = loadSeenIds();

    let alive = true;
    const poll = async () => {
      if (!alive || document.hidden) return;
      const res = await clientApi<{ notifications: AppNotification[] }>(
        "/api/notifications?unread=1",
      );
      if (!alive || !res.ok) return;
      const seen = seenRef.current ?? new Set<string>();
      // Polling pertama = baseline: tandai semua yang sudah ada sebagai
      // dilihat, tanpa popup (notifikasi lama tidak dibunyikan ulang).
      if (!baselineDoneRef.current) {
        baselineDoneRef.current = true;
        for (const n of res.data.notifications) {
          const id = notificationId(n);
          if (id) seen.add(id);
        }
        seenRef.current = seen;
        persistSeen();
        return;
      }
      const fresh = pickUnseenNotifications(res.data.notifications, seen);
      if (fresh.length === 0) return;
      for (const n of fresh) {
        const id = notificationId(n);
        if (id) seen.add(id);
      }
      seenRef.current = seen;
      persistSeen();
      queueRef.current = [...queueRef.current, ...fresh];
      setQueue(queueRef.current);
      setQueueCount(queueRef.current.length);
      if (!currentRef.current) showNext();
    };

    void poll();
    const timer = window.setInterval(poll, CHALLENGE_POLL_INTERVAL_MS);
    // Segera cek lagi saat tab kembali aktif (tanpa menunggu interval).
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loggedIn, persistSeen, showNext]);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CHALLENGE_NOTIF_MUTED_KEY, next ? "1" : "0");
      } catch {
        /* abaikan */
      }
      return next;
    });
  };

  if (!current) return null;

  const text = formatChallengeNotification(current.type ?? "", current.detail);
  const id = getId(current);
  const remaining = queueCount;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={text.title}
      className="fixed right-4 top-20 z-50 w-[min(360px,calc(100vw-32px))] animate-pop-in motion-reduce:animate-none sm:right-6 sm:top-24"
    >
      <div className="overflow-hidden rounded-2xl border border-amber-brand/50 bg-ink-900 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
        {/* Garis aksen amber — satu-satunya elemen berani, sisanya tenang. */}
        <div className="h-1 w-full bg-amber-brand" aria-hidden="true" />
        <div className="flex items-start gap-3 p-4">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-brand/15 text-amber-brand"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg uppercase leading-tight tracking-wide">
              {text.title}
            </p>
            <p className="mt-1 text-sm leading-snug text-paper-dim">
              {text.body}
            </p>
            {remaining > 0 ? (
              <p className="mt-1 text-xs text-paper-mute">
                {remaining} notifikasi lagi menunggu
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const item = currentRef.current;
                  if (item) markRead(notificationId(item));
                  dismissCurrent(false);
                  router.push(text.href);
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-brand px-4 text-sm font-bold text-on-amber transition-transform duration-150 hover:scale-[1.02] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-brand"
              >
                Lihat tantangan
              </button>
              <button
                type="button"
                onClick={toggleMute}
                aria-pressed={muted}
                aria-label={muted ? "Bunyikan notifikasi" : "Bisukan notifikasi"}
                title={muted ? "Bunyikan notifikasi" : "Bisukan notifikasi"}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/15 text-paper-dim transition-colors hover:bg-white/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-amber-brand"
              >
                {muted ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
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
                    className="h-5 w-5"
                  >
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismissCurrent(true)}
            aria-label="Tutup notifikasi"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-paper-dim transition-colors hover:bg-white/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-amber-brand"
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
        </div>
        {/* Sisa waktu tampil — menyusut selama 7 detik. */}
        <div
          key={id}
          aria-hidden="true"
          className="h-0.5 w-full origin-left bg-amber-brand/70 motion-reduce:hidden"
          style={{ animation: `countdown-shrink ${CHALLENGE_POPUP_DURATION_MS}ms linear forwards` }}
        />
      </div>
    </div>
  );
}
