"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clientApi } from "@/components/api";

/**
 * Gas Tarung — tombol quick match mengambang (kiri bawah, berseberangan
 * dengan tombol chat kanan bawah).
 *
 * Satu ketuk → POST /api/quick-fight → server mencarikan lawan yang
 * tersedia → langsung masuk /game/[fightId]. Tanpa pilih lawan/arena,
 * tanpa nunggu accept. Kalau tidak ada lawan, panel menawarkan buat
 * tantangan terbuka (di /obrolan).
 *
 * Hanya tampil saat sudah login (dicek via /api/auth/me seperti Navbar)
 * dan disembunyikan di halaman game (/game/*) — di sana user sudah
 * berada dalam satu fight.
 */

export type QuickFightUiState =
  | "idle"
  | "searching"
  | "no_opponent"
  | "error"
  | "no_fighter"
  | "daily_limit";

interface QuickFightData {
  status: "matched" | "active_fight" | "no_opponent";
  gameFight?: { id: string };
  opponent?: { id: string; displayName: string; rating: number } | null;
}

export interface QuickFightFabProps {
  state: QuickFightUiState;
  errorMessage?: string;
  onGas: () => void;
  onRetry: () => void;
  onOpenChallenge: () => void;
  onCreateFighter: () => void;
  onClose: () => void;
}

/** Tombol + panel Gas Tarung (presentasional, props-driven — bisa diuji tanpa router). */
export function QuickFightFab({
  state,
  errorMessage,
  onGas,
  onRetry,
  onOpenChallenge,
  onCreateFighter,
  onClose,
}: QuickFightFabProps) {
  if (state === "searching") {
    return (
      <button
        type="button"
        disabled
        aria-label="Mencari lawan"
        className="fixed bottom-5 left-4 z-50 inline-flex h-14 animate-pulse items-center gap-2 rounded-full bg-amber-brand px-5 font-display text-lg tracking-wide text-on-amber shadow-[0_8px_28px_rgba(245,166,35,0.45)] sm:bottom-6 sm:left-6"
      >
        Mencari lawan…
      </button>
    );
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={onGas}
        aria-label="Gas Tarung — cari lawan acak dan langsung bertarung"
        className="fixed bottom-5 left-4 z-50 inline-flex h-14 items-center gap-2 rounded-full bg-amber-brand px-5 font-display text-lg tracking-wide text-on-amber shadow-[0_8px_28px_rgba(245,166,35,0.45)] transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-brand sm:bottom-6 sm:left-6"
      >
        GAS TARUNG
      </button>
    );
  }

  const card =
    "fixed bottom-5 left-4 z-50 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-white/15 bg-ink-900 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.55)] sm:bottom-6 sm:left-6";
  const primaryBtn =
    "w-full rounded-xl bg-amber-brand px-4 py-2.5 font-semibold text-on-amber transition-transform duration-150 hover:scale-[1.02] active:scale-95";
  const ghostBtn =
    "w-full rounded-xl border border-white/15 px-4 py-2.5 font-semibold text-white/80 transition-colors hover:bg-white/5";

  if (state === "no_opponent") {
    return (
      <div className={card} role="status">
        <p className="font-display text-lg tracking-wide text-white">
          Belum ada lawan sekarang
        </p>
        <p className="mt-1 text-sm text-white/70">
          Semua fighter lagi sibuk atau sudah habis jatah tarungnya hari
          ini. Buat tantangan terbuka biar ada yang nyaut.
        </p>
        <div className="mt-4 space-y-2">
          <button type="button" onClick={onOpenChallenge} className={primaryBtn}>
            Buat Tantangan Terbuka
          </button>
          <button type="button" onClick={onRetry} className={ghostBtn}>
            Coba Lagi
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl px-4 py-2 text-sm text-white/50 hover:text-white/80"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  if (state === "daily_limit") {
    return (
      <div className={card} role="status">
        <p className="font-display text-lg tracking-wide text-white">
          Jatah tarung hari ini habis
        </p>
        <p className="mt-1 text-sm text-white/70">
          Maks 3 fight per hari, reset tengah malam WIB. Besok gas lagi.
        </p>
        <div className="mt-4">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Tutup
          </button>
        </div>
      </div>
    );
  }

  if (state === "no_fighter") {
    return (
      <div className={card} role="status">
        <p className="font-display text-lg tracking-wide text-white">
          Buat fighter dulu
        </p>
        <p className="mt-1 text-sm text-white/70">
          Gas Tarung butuh fighter — buat dulu, baru cari lawan.
        </p>
        <div className="mt-4 space-y-2">
          <button type="button" onClick={onCreateFighter} className={primaryBtn}>
            Buat Fighter
          </button>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Tutup
          </button>
        </div>
      </div>
    );
  }

  // error
  return (
    <div className={card} role="alert">
      <p className="font-display text-lg tracking-wide text-white">
        Gagal mencari lawan
      </p>
      <p className="mt-1 text-sm text-white/70">
        {errorMessage ?? "Terjadi kesalahan. Coba lagi."}
      </p>
      <div className="mt-4 space-y-2">
        <button type="button" onClick={onRetry} className={primaryBtn}>
          Coba Lagi
        </button>
        <button type="button" onClick={onClose} className={ghostBtn}>
          Tutup
        </button>
      </div>
    </div>
  );
}

/** Container: cek login, panggil API, arahkan ke halaman game. */
export default function QuickFightButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [state, setState] = useState<QuickFightUiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    clientApi<{ user: unknown }>("/api/auth/me")
      .then((res) => {
        if (alive) setLoggedIn(res.ok && Boolean(res.data?.user));
      })
      .catch(() => {
        if (alive) setLoggedIn(false);
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (!loggedIn) return null;
  if (pathname?.startsWith("/game")) return null;

  const gas = async (retriesLeft: number) => {
    setState("searching");
    setErrorMessage(undefined);
    const res = await clientApi<QuickFightData>("/api/quick-fight", {
      method: "POST",
    });
    if (res.ok) {
      if (res.data.status === "matched" || res.data.status === "active_fight") {
        router.push(`/game/${res.data.gameFight?.id}`);
        setState("idle");
        return;
      }
      // no_opponent
      setState("no_opponent");
      return;
    }
    const code = res.error?.code;
    if (code === "DAILY_LIMIT_REACHED") {
      setState("daily_limit");
      return;
    }
    if (code === "NO_FIGHTER") {
      setState("no_fighter");
      return;
    }
    if (code === "QUICK_FIGHT_CONFLICT" && retriesLeft > 0) {
      // Lawan baru saja masuk fight lain — coba sekali lagi, server
      // akan mencarikan lawan lain.
      await gas(retriesLeft - 1);
      return;
    }
    setErrorMessage(res.error?.message ?? "Terjadi kesalahan. Coba lagi.");
    setState("error");
  };

  return (
    <QuickFightFab
      state={state}
      errorMessage={errorMessage}
      onGas={() => void gas(1)}
      onRetry={() => void gas(1)}
      onOpenChallenge={() => router.push("/obrolan")}
      onCreateFighter={() => router.push("/fighter-saya")}
      onClose={() => setState("idle")}
    />
  );
}
