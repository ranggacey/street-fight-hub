"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clientApi } from "./api";
import type { SessionUser } from "./types";
import Button, { ButtonLink } from "./Button";

const PUBLIC_SEGMENTS = new Set([
  "",
  "turnamen",
  "pertandingan",
  "fighter",
  "klasemen",
  "daftar",
  "masuk",
  "fighter-saya",
  "game",
  "tantangan",
  "gelar",
  "obrolan",
]);

const NAV_LINKS = [
  { href: "/turnamen", label: "Turnamen" },
  { href: "/klasemen", label: "Klasemen" },
  { href: "/tantangan", label: "Tantangan" },
  { href: "/obrolan", label: "Obrolan" },
  { href: "/gelar", label: "Gelar" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    clientApi<{ user: SessionUser }>("/api/auth/me").then((res) => {
      if (!alive) return;
      if (res.ok) setUser(res.data.user);
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [pathname]);

  // Sembunyikan navbar publik di halaman admin (path rahasia).
  const firstSegment = pathname.split("/")[1] ?? "";
  if (!PUBLIC_SEGMENTS.has(firstSegment)) return null;

  const logout = async () => {
    await clientApi("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur-xl">
      <nav
        className="mx-auto flex min-h-[64px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
        aria-label="Navigasi utama"
      >
        <Link
          href="/"
          className="flex items-center gap-2"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-brand font-display text-lg text-on-amber">
            SF
          </span>
          {/* Wordmark disembunyikan di layar kecil saat belum login, supaya
              tombol Masuk/Daftar muat di header tanpa buka hamburger. */}
          <span
            className={`font-display text-lg uppercase leading-none tracking-wide sm:text-xl ${
              checked && !user ? "max-sm:hidden" : ""
            }`}
          >
            Street Fight <span className="text-amber-brand">Hub</span>
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 ${
                pathname.startsWith(l.href) ? "text-amber-brand" : "text-paper-dim"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href="/fighter-saya"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 ${
                  pathname.startsWith("/fighter-saya")
                    ? "text-amber-brand"
                    : "text-paper-dim"
                }`}
              >
                Fighter Saya
              </Link>
              <span className="ml-2 hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-paper lg:inline-flex">
                @{user.username}
              </span>
              <Button variant="ghost" size="sm" onClick={logout} className="ml-2">
                Keluar
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/masuk"
                className="ml-2 rounded-lg px-3 py-2 text-sm font-semibold text-paper-dim transition-colors hover:bg-white/10 hover:text-paper"
              >
                Masuk
              </Link>
              <ButtonLink href="/daftar" size="sm" className="ml-1">
                Daftar
              </ButtonLink>
            </>
          )}
        </div>

        {/* Mobile: tombol Masuk/Daftar langsung terlihat di header saat
            belum login — tidak perlu buka hamburger dulu. */}
        <div className="flex items-center gap-2 md:hidden">
          {checked && !user ? (
            <>
              <Link
                href="/masuk"
                className="rounded-lg px-2 py-2 text-sm font-semibold text-paper-dim transition-colors hover:text-paper"
                onClick={() => setMenuOpen(false)}
              >
                Masuk
              </Link>
              <ButtonLink href="/daftar" size="sm">
                Daftar
              </ButtonLink>
            </>
          ) : null}
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/5 text-paper"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span aria-hidden="true" className="font-display text-xl">
              {menuOpen ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </nav>

      {/* Panel menu mobile */}
      {menuOpen ? (
        <div className="border-t border-white/10 bg-ink-950/95 px-4 pb-5 pt-3 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-base font-semibold text-paper-dim hover:bg-white/10 hover:text-paper"
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href="/fighter-saya"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-[44px] items-center rounded-lg px-3 text-base font-semibold text-paper-dim hover:bg-white/10 hover:text-paper"
                >
                  Fighter Saya (@{user.username})
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-2 flex min-h-[44px] items-center justify-center rounded-xl border border-white/25 font-semibold text-paper"
                >
                  Keluar
                </button>
              </>
            ) : (
              <div className="mt-2 flex gap-3">
                <ButtonLink
                  href="/masuk"
                  variant="ghost"
                  className="flex-1"
                  size="md"
                >
                  Masuk
                </ButtonLink>
                <ButtonLink href="/daftar" className="flex-1" size="md">
                  Daftar
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
