"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, getId, styleLabel } from "@/components/api";
import type { AdminUserRow, Fighter } from "@/components/types";
import GlassCard from "@/components/GlassCard";
import Badge from "@/components/Badge";
import { Input } from "@/components/Input";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";

export default function AdminFighters({ slug }: { slug: string }) {
  const [q, setQ] = useState("");
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  // Konfirmasi ubah role
  const [roleTarget, setRoleTarget] = useState<AdminUserRow | null>(null);

  const headers = { "x-admin-path": slug };

  const search = useCallback(
    async (query: string) => {
      // Semua setState terjadi SETELAH await — aman dipanggil dari useEffect.
      const param = query ? `?q=${encodeURIComponent(query)}` : "";
      const adminHeaders = { "x-admin-path": slug };
      const [fRes, uRes] = await Promise.all([
        clientApi<{ fighters: Fighter[] }>(`/api/admin/fighters${param}`, {
          headers: adminHeaders,
        }),
        clientApi<{ users: AdminUserRow[] }>(`/api/admin/users${param}`, {
          headers: adminHeaders,
        }),
      ]);
      setLoading(false);
      setSearched(true);
      if (fRes.ok) setFighters(fRes.data.fighters);
      else setError(fRes.error.message);
      if (uRes.ok) setUsers(uRes.data.users);
      else if (!fRes.ok) setError(uRes.error.message);
    },
    [slug],
  );

  useEffect(() => {
    // Fetch awal: setState hanya di dalam .then() (callback async).
    const adminHeaders = { "x-admin-path": slug };
    Promise.all([
      clientApi<{ fighters: Fighter[] }>("/api/admin/fighters", {
        headers: adminHeaders,
      }),
      clientApi<{ users: AdminUserRow[] }>("/api/admin/users", {
        headers: adminHeaders,
      }),
    ]).then(([fRes, uRes]) => {
      setLoading(false);
      setSearched(true);
      if (fRes.ok) setFighters(fRes.data.fighters);
      else setError(fRes.error.message);
      if (uRes.ok) setUsers(uRes.data.users);
      else if (!fRes.ok) setError(uRes.error.message);
    });
  }, [slug]);

  const changeRole = async (u: AdminUserRow) => {
    const id = getId(u);
    const nextRole = u.role === "admin" ? "user" : "admin";
    setBusyId(id);
    const res = await clientApi<{
      user: { id: string; username: string; role: string };
    }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ role: nextRole }),
    });
    setBusyId("");
    setRoleTarget(null);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice(`Role @${u.username} diubah menjadi ${nextRole}.`);
    search(q);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
          Fighter & Pengguna
        </h1>
        <p className="mt-2 text-paper-dim">
          Cari fighter untuk melihat data, dan pengguna untuk mengubah role
          user ↔ admin.
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setLoading(true);
          search(q);
        }}
        className="flex gap-2"
      >
        <div className="flex-1">
          <Input
            id="admin-search"
            label="Cari fighter / pengguna"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nama tampil atau username…"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Mencari…" : "Cari"}
          </Button>
        </div>
      </form>

      {/* Fighter */}
      <section aria-labelledby="fighter-heading">
        <h2 id="fighter-heading" className="mb-4 font-display text-2xl uppercase tracking-wide">
          Fighter <span className="text-amber-brand">({fighters.length})</span>
        </h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2" role="status" aria-label="Memuat…">
            {[0, 1].map((i) => (
              <div key={i} className="glass h-36 animate-pulse" />
            ))}
          </div>
        ) : fighters.length === 0 ? (
          <EmptyState
            title={searched ? "Tidak Ditemukan" : "Belum Ada Fighter"}
            description="Coba kata kunci lain, atau kosongkan pencarian untuk melihat semua fighter."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {fighters.map((f) => {
              const id = getId(f);
              const record = f.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 };
              return (
                <GlassCard key={id} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-xl uppercase leading-tight tracking-wide">
                        {f.displayName}
                      </p>
                      <p className="text-sm text-paper-dim">
                        @{f.igUsername} •{" "}
                        {styleLabel(f.style, f.styleOther)}
                      </p>
                      <p className="mt-1 text-xs text-paper-mute">
                        Rekor: {record.wins}M / {record.losses}K / {record.draws}S / {record.kos} KO
                      </p>
                    </div>
                    {f.status === "retired" ? <Badge tone="neutral">Pensiun</Badge> : null}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/fighter/${id}`}
                      target="_blank"
                      className="inline-flex min-h-[40px] items-center rounded-xl border border-white/25 px-3 text-sm font-semibold text-paper hover:bg-white/10"
                    >
                      Profil ↗
                    </Link>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>

      {/* Pengguna */}
      <section aria-labelledby="pengguna-heading">
        <h2 id="pengguna-heading" className="mb-4 font-display text-2xl uppercase tracking-wide">
          Pengguna <span className="text-amber-brand">({users.length})</span>
        </h2>
        {users.length === 0 ? (
          <EmptyState
            title="Tidak Ada Pengguna"
            description="Belum ada pengguna yang cocok dengan pencarian."
          />
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              const id = getId(u);
              return (
                <GlassCard key={id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-semibold text-paper">
                      @{u.username}{" "}
                      <Badge tone={u.role === "admin" ? "red" : "neutral"}>
                        {u.role}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-paper-mute">
                      {u.fighter
                        ? `Fighter: ${u.fighter.displayName}`
                        : "Belum punya fighter"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === id}
                    onClick={() => setRoleTarget(u)}
                  >
                    {u.role === "admin" ? "Jadikan User" : "Jadikan Admin"}
                  </Button>
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal konfirmasi ubah role */}
      <Modal
        open={roleTarget !== null}
        onClose={() => setRoleTarget(null)}
        title="Ubah Role Pengguna?"
        confirmLabel="Ya, Ubah"
        onConfirm={() => roleTarget && changeRole(roleTarget)}
        busy={busyId !== ""}
      >
        <p>
          Role @{roleTarget?.username} akan diubah menjadi{" "}
          <strong>{roleTarget?.role === "admin" ? "user" : "admin"}</strong>.
          {roleTarget?.role === "user"
            ? " Akun tersebut akan mendapat akses penuh ke panel admin."
            : " Akun tersebut akan kehilangan akses admin."}
        </p>
      </Modal>
    </div>
  );
}
