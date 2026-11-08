import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AdminFights from "./AdminFights";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pertandingan — Admin",
  description: "Admin: daftar fight per hari, unduh semua poster, dan ekspor video tiap riwayat.",
  robots: { index: false, follow: false },
};

export default async function AdminFightsPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (adminSlug !== process.env.ADMIN_SLUG) notFound();
  return <AdminFights slug={adminSlug} />;
}
