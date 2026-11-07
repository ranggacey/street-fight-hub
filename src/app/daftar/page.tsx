"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "@/components/api";
import type { SessionUser } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import { Input } from "@/components/Input";
import Button from "@/components/Button";

export default function DaftarPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      nextErrors.username =
        "Username 3–20 karakter, huruf kecil, angka, dan underscore saja.";
    }
    if (password.length < 8) {
      nextErrors.password = "Password minimal 8 karakter.";
    }
    if (password !== confirm) {
      nextErrors.confirm = "Konfirmasi password tidak sama.";
    }
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    const res = await clientApi<{ user: SessionUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === "CONFLICT") {
        setServerError("Username sudah dipakai. Coba username lain.");
      } else {
        setServerError(res.error.message);
      }
      return;
    }
    router.push("/fighter-saya");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="text-center">
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Daftar Akun
        </h1>
        <p className="mt-2 text-paper-dim">
          Satu akun untuk satu fighter. Gratis, tanpa email.
        </p>
      </header>

      <GlassCard strong>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input
            id="username"
            label="Username"
            hint="3–20 karakter: huruf kecil, angka, underscore."
            error={errors.username}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoComplete="username"
            placeholder="contoh: jagoan123"
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            hint="Minimal 8 karakter."
            error={errors.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
          <Input
            id="confirm"
            label="Konfirmasi Password"
            type="password"
            error={errors.confirm}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />

          {serverError ? (
            <p role="alert" className="rounded-xl border border-red-brand/50 bg-red-brand/10 px-3 py-2 text-sm font-semibold text-red-400">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Mendaftarkan…" : "Buat Akun"}
          </Button>
        </form>
      </GlassCard>

      <p className="text-center text-sm text-paper-dim">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-semibold text-amber-brand hover:underline">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
