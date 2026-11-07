"use client";

import { useState, type FormEvent } from "react";
import { clientApi } from "@/components/api";
import GlassCard from "@/components/GlassCard";
import { Textarea } from "@/components/Input";
import Button from "@/components/Button";

const MAX_TEXT = 200;

export default function AdminAnnouncement({ slug }: { slug: string }) {
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Teks pengumuman wajib diisi.");
      return;
    }
    if (trimmed.length > MAX_TEXT) {
      setError(`Pengumuman maksimal ${MAX_TEXT} karakter.`);
      return;
    }
    setBusy(true);
    setError("");
    const res = await clientApi("/api/admin/announce", {
      method: "POST",
      headers: { "x-admin-path": slug },
      body: JSON.stringify({ text: trimmed }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice("Pengumuman baru tayang di beranda. Pengumuman lama otomatis dinonaktifkan.");
    setText("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Buat Pengumuman
        </h1>
        <p className="mt-2 text-paper-dim">
          Banner pengumuman tampil di bagian atas beranda. Hanya satu
          pengumuman yang aktif — yang baru otomatis menggantikan yang lama.
        </p>
      </header>

      {notice ? (
        <p role="status" className="rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-400">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-brand/50 bg-red-brand/10 px-4 py-3 text-sm font-semibold text-red-400">
          {error}
        </p>
      ) : null}

      <GlassCard strong>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Textarea
            id="announce-text"
            label={`Teks Pengumuman (maks ${MAX_TEXT} karakter)`}
            hint={`${text.length}/${MAX_TEXT} karakter`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Contoh: Pendaftaran Night Fight Championship #2 dibuka sampai 15 November 2026!"
            maxLength={MAX_TEXT}
            rows={3}
            required
          />
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Menerbitkan…" : "Terbitkan Pengumuman"}
          </Button>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className="font-display text-xl uppercase tracking-wide text-amber-brand">
          Tips
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-paper-dim">
          <li>Tulis satu informasi penting saja — tanggal, link, atau perubahan jadwal.</li>
          <li>Hindari teks terlalu panjang; banner beranda memotong teks yang berlebihan.</li>
          <li>Pengumuman lama tidak bisa diaktifkan kembali — buat yang baru bila perlu.</li>
        </ul>
      </GlassCard>
    </div>
  );
}
