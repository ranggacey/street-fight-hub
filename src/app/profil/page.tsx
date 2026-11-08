import type { Metadata } from "next";
import ProfilClient from "./ProfilClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profil Saya",
  description:
    "Profil fighter-mu di Street Fight Hub: akun, statistik kasual, gelar, dan riwayat fight — plus jalan cepat ke ubah warna dan aksesoris.",
};

export default function ProfilPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <ProfilClient />
    </div>
  );
}
