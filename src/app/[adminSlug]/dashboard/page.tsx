import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Admin",
  description: "Dashboard admin Street Fight Tournament Hub.",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (adminSlug !== process.env.ADMIN_SLUG) notFound();
  return <AdminDashboard slug={adminSlug} />;
}
