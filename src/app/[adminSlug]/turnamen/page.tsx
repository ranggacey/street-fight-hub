import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AdminTournaments from "./AdminTournaments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kelola Turnamen — Admin",
  description: "Admin: buat, edit, dan undi turnamen.",
  robots: { index: false, follow: false },
};

export default async function AdminTournamentsPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (adminSlug !== process.env.ADMIN_SLUG) notFound();
  return <AdminTournaments slug={adminSlug} />;
}
