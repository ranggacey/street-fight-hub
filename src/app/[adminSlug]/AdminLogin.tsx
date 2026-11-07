"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { clientApi } from "@/components/api";
import type { SessionUser } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import { Input } from "@/components/Input";
import Button from "@/components/Button";

/** Form login admin — hanya akun role admin yang diteruskan ke dashboard. */
export default function AdminLogin({ slug }: { slug: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await clientApi<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.status === 401) {
        setError("Username atau password salah.");
      } else if (res.error.status === 429) {
        setError("Terlalu banyak percobaan gagal. Tunggu 15 menit.");
      } else {
        setError(res.error.message);
      }
      return;
    }
    if (res.data.user.role !== "admin") {
      // Bukan admin: hapus sesi yang barusan dibuat, tolak masuk.
      await clientApi("/api/auth/logout", { method: "POST" });
      setError("Akun ini bukan admin. Halaman ini khusus admin.");
      return;
    }
    router.push(`/${slug}/dashboard`);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md space-y-6 pt-4">
      <header className="text-center">
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Login Admin
        </h1>
        <p className="mt-2 text-paper-dim">
          Halaman ini hanya untuk admin turnamen.
        </p>
      </header>
      <GlassCard strong>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input
            id="admin-username"
            label="Username Admin"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoComplete="username"
            required
          />
          <Input
            id="admin-password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error ? (
            <p role="alert" className="rounded-xl border border-red-brand/50 bg-red-brand/10 px-3 py-2 text-sm font-semibold text-red-400">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Memeriksa…" : "Masuk Dashboard"}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
