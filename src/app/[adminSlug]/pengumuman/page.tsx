import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AdminAnnouncement from "./AdminAnnouncement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buat Pengumuman — Admin",
  description: "Admin: terbitkan banner pengumuman beranda.",
  robots: { index: false, follow: false },
};

export default async function AdminAnnouncementPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (adminSlug !== process.env.ADMIN_SLUG) notFound();
  return <AdminAnnouncement slug={adminSlug} />;
}
