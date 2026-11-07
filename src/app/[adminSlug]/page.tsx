import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AdminLogin from "./AdminLogin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login Admin",
  description: "Login admin Street Fight Tournament Hub.",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (adminSlug !== process.env.ADMIN_SLUG) notFound();
  return <AdminLogin slug={adminSlug} />;
}
