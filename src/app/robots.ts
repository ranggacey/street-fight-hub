import type { MetadataRoute } from "next";

/**
 * Robots: blokir path admin rahasia dari crawler. Slug dibaca dari env —
 * JANGAN hardcode. Jika env kosong, tidak ada path admin yang di-expose.
 *
 * WAJIB force-dynamic: slug admin adalah secret runtime. Kalau route ini
 * di-prerender statis saat build, nilai ADMIN_SLUG saat build (bisa jadi
 * kosong) yang akan terpakai — bukan nilai runtime. Dengan dynamic, tiap
 * request membaca env runtime.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const adminSlug = process.env.ADMIN_SLUG;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: adminSlug ? [`/${adminSlug}`] : [],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
