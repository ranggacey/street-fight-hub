import { notFound } from "next/navigation";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

/**
 * Layout admin: cek path rahasia di server. Jika slug URL tidak sama dengan
 * env ADMIN_SLUG → 404 (path tidak bocor). JANGAN hardcode slug di sini.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (adminSlug !== process.env.ADMIN_SLUG) notFound();
  return <AdminShell slug={adminSlug}>{children}</AdminShell>;
}
