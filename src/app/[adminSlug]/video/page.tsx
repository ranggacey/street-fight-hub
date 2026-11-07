import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AdminVideo from "./AdminVideo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Antrean Video — Admin",
  description: "Admin: kelola video task pertandingan.",
  robots: { index: false, follow: false },
};

export default async function AdminVideoPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (adminSlug !== process.env.ADMIN_SLUG) notFound();
  return <AdminVideo slug={adminSlug} />;
}
