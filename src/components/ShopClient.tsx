"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi } from "@/components/api";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";

/**
 * Toko gear — klien. Gear KOSMETIK SAJA: membeli = membuka varian
 * aksesoris untuk fighter. Tidak ada efek stat/damage.
 * Pakai gear: edit fighter (aksesoris) seperti biasa.
 */

type GearItem = {
  id: string;
  part: string;
  variant: string;
  label: string;
  description: string;
  price: number;
};

type ShopResponse = {
  catalog: GearItem[];
  coins: number | null;
  gearOwned: string[];
  myFighterId: string | null;
};

const PART_LABELS: Record<string, string> = {
  head: "Kepala",
  hands: "Tangan",
  feet: "Kaki",
  body: "Badan",
  belt: "Sabuk",
  weapon: "Senjata",
};

export default function ShopClient() {
  const [shop, setShop] = useState<ShopResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await clientApi<ShopResponse>("/api/shop");
    if (res.ok) setShop(res.data);
    else setError(res.error.message);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function buy(gearId: string) {
    setBusyId(gearId);
    setError("");
    setNotice("");
    const res = await clientApi<{ progress: { coins: number } }>("/api/shop/buy", {
      method: "POST",
      body: JSON.stringify({ gearId }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice("Gear dibeli! Pasang lewat edit fighter (aksesoris).");
    await load();
  }

  if (!shop) {
    return (
      <GlassCard>
        <p className="text-paper-dim">{error || "Memuat toko…"}</p>
      </GlassCard>
    );
  }

  if (!shop.myFighterId) {
    return (
      <EmptyState
        title="Buat Fighter Dulu"
        description="Kamu butuh fighter untuk belanja gear. Buat fighter dulu, menangkan fight untuk dapat koin."
      />
    );
  }

  const parts = [...new Set(shop.catalog.map((g) => g.part))];

  return (
    <div className="space-y-6">
      <GlassCard className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="font-semibold text-paper">
          Koinmu: <span className="text-amber-brand">🪙 {shop.coins ?? 0}</span>
        </p>
        <p className="text-sm text-paper-dim">
          Gear hanya mengubah tampilan — tidak ada efek stat atau damage.
        </p>
      </GlassCard>
      {error ? (
        <p className="text-sm font-semibold text-red-400">{error}</p>
      ) : null}
      {notice ? (
        <p className="text-sm font-semibold text-emerald-400">{notice}</p>
      ) : null}
      {parts.map((part) => (
        <section key={part} aria-label={PART_LABELS[part] ?? part}>
          <h2 className="mb-3 font-display text-2xl uppercase tracking-wide">
            {PART_LABELS[part] ?? part}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shop.catalog
              .filter((g) => g.part === part)
              .map((g) => {
                const owned = shop.gearOwned.includes(g.id);
                const afford = (shop.coins ?? 0) >= g.price;
                return (
                  <GlassCard key={g.id} className="flex flex-col justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-paper">{g.label}</p>
                        {owned ? <Badge tone="amber">Dimiliki</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-paper-dim">{g.description}</p>
                      <p className="mt-2 font-display text-lg text-amber-brand">
                        🪙 {g.price} koin
                      </p>
                    </div>
                    {owned ? (
                      <p className="text-sm text-paper-dim">
                        Sudah dimiliki — pasang lewat edit fighter.
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!afford || busyId === g.id}
                        onClick={() => buy(g.id)}
                      >
                        {busyId === g.id
                          ? "…"
                          : afford
                            ? `Beli (${g.price} koin)`
                            : "Koin tidak cukup"}
                      </Button>
                    )}
                  </GlassCard>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
