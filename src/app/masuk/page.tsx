"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "@/components/api";
import type { SessionUser } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import { Input } from "@/components/Input";
import Button from "@/components/Button";

export default function MasukPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");
    setBusy(true);
    const res = await clientApi<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.status === 401) {
        setServerError("Username atau password salah.");
      } else if (res.error.status === 429) {
        setServerError(
          "Terlalu banyak percobaan gagal. Tunggu 15 menit lalu coba lagi.",
        );
      } else {
        setServerError(res.error.message);
      }
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="text-center">
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Masuk
        </h1>
        <p className="mt-2 text-paper-dim">
          Masuk untuk mengelola fighter-mu dan ikut turnamen.
        </p>
      </header>

      <GlassCard strong>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input
            id="username"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoComplete="username"
            placeholder="username-mu"
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />

          {serverError ? (
            <p role="alert" className="rounded-xl border border-red-brand/50 bg-red-brand/10 px-3 py-2 text-sm font-semibold text-red-400">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Memeriksa…" : "Masuk"}
          </Button>
        </form>
      </GlassCard>

      <p className="text-center text-sm text-paper-dim">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-amber-brand hover:underline">
          Daftar di sini
        </Link>
      </p>
    </div>
  );
}
