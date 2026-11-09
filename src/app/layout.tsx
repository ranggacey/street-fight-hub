import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingChat from "@/components/FloatingChat";
import QuickFightButton from "@/components/QuickFightButton";
import ChallengeNotifications from "@/components/ChallengeNotifications";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Street Fight Tournament Hub",
    template: "%s | Street Fight Hub",
  },
  description:
    "Turnamen stickman fight — daftar, buat fighter, dan tonton pertarunganmu di @streetfightstickman.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <head>
        {/*
          Font Anton + Inter via Google Fonts <link> (bukan next/font/google)
          agar build TIDAK pernah gagal saat fetch font gagal — fallback
          stack sudah didefinisikan di globals.css (@theme --font-display /
          --font-body). Jika stylesheet gagal dimuat di runtime, fallback
          Arial Narrow / system font langsung dipakai.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/*
          Aturan no-page-custom-font adalah false positive di App Router:
          <link> font di root layout adalah cara yang didukung untuk font
          eksternal (next/font/google tidak dipakai supaya build tidak gagal
          saat fetch font gagal — lihat komentar di atas).
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="arena-backdrop" aria-hidden="true" />
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <Footer />
        <FloatingChat />
        <QuickFightButton />
        <ChallengeNotifications />
      </body>
    </html>
  );
}
