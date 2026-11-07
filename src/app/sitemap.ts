import type { MetadataRoute } from "next";

/** Sitemap: URL publik statis saja (detail dinamis di-skip, sesuai CONTRACT §11). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();

  const urls = ["/", "/turnamen", "/klasemen", "/daftar", "/masuk"];
  return urls.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.8,
  }));
}
