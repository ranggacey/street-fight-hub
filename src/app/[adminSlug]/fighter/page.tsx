import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AdminFighters from "./AdminFighters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fighter & Pengguna — Admin",
  description: "Admin: lihat data fighter dan ubah role pengguna.",
  robots: { index: false, follow: false },
};

export default async function AdminFightersPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (adminSlug !== process.env.ADMIN_SLUG) notFound();
  return <AdminFighters slug={adminSlug} />;
}
