import type { Metadata } from "next";
import ShopClient from "@/components/ShopClient";

export const metadata: Metadata = {
  title: "Toko Gear",
  description:
    "Beli gear kosmetik untuk fighter dengan koin hasil bertarung — hanya tampilan, tanpa efek stat.",
};

export default function TokoPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl uppercase leading-tight tracking-wide sm:text-6xl">
          Toko <span className="text-amber-brand">Gear</span>
        </h1>
        <p className="mt-2 text-sm text-paper-dim">
          Belanja aksesoris dengan koin hasil bertarung. Gear hanya mengubah
          tampilan fighter di arena — menang tetap ditentukan latihan dan
          skill, bukan belanja.
        </p>
      </header>
      <ShopClient />
    </div>
  );
}
