"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { clientApi } from "@/components/api";
import Button from "@/components/Button";

/** Kerangka admin: nav internal + tombol keluar. Nav disembunyikan di halaman login. */
export default function AdminShell({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLoginPage = pathname === `/${slug}`;

  const links = [
    { href: `/${slug}/dashboard`, label: "Dashboard" },
    { href: `/${slug}/pertandingan`, label: "Pertandingan" },
    { href: `/${slug}/turnamen`, label: "Turnamen" },
    { href: `/${slug}/video`, label: "Video" },
    { href: `/${slug}/fighter`, label: "Fighter & Pengguna" },
    { href: `/${slug}/pengumuman`, label: "Pengumuman" },
  ];

  const logout = async () => {
    await clientApi("/api/auth/logout", { method: "POST" });
    router.push(`/${slug}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xl uppercase tracking-wide">
          Panel Admin <span className="text-red-brand">• Rahasia</span>
        </p>
        <Link
          href="/"
          className="text-sm font-semibold text-paper-dim hover:text-amber-brand"
        >
          ← Lihat Situs
        </Link>
      </div>

      {!isLoginPage ? (
        <nav aria-label="Navigasi admin" className="glass-strong px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="hidden flex-wrap gap-1 md:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className={`flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold transition-colors hover:bg-white/10 ${
                    pathname === l.href ? "text-amber-brand" : "text-paper-dim"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/5 font-display text-lg text-paper md:hidden"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Tutup menu admin" : "Buka menu admin"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
            <Button variant="ghost" size="sm" onClick={logout} className="hidden md:inline-flex">
              Keluar
            </Button>
          </div>
          {menuOpen ? (
            <div className="flex flex-col gap-1 border-t border-white/10 pt-2 md:hidden">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-[44px] items-center rounded-lg px-3 text-base font-semibold ${
                    pathname === l.href ? "text-amber-brand" : "text-paper-dim"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={logout}
                className="mt-1 flex min-h-[44px] items-center justify-center rounded-xl border border-white/25 font-semibold text-paper"
              >
                Keluar
              </button>
            </div>
          ) : null}
        </nav>
      ) : null}

      {children}
    </div>
  );
}
