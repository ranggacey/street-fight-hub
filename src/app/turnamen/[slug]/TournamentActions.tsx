"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi } from "@/components/api";
import type { SessionUser } from "@/components/types";
import Button, { ButtonLink } from "@/components/Button";
import Modal from "@/components/Modal";

/**
 * Tombol Join / Leave turnamen (butuh login + fighter).
 * Konfirmasi 1x via modal sebelum memanggil API.
 */
export default function TournamentActions({
  slug,
  status,
  regCloseAt,
  entryUserIds,
}: {
  slug: string;
  status: string;
  regCloseAt: string;
  /** userId para peserta aktif — dipakai untuk menandai apakah user sudah join. */
  entryUserIds: string[];
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [regOpen, setRegOpen] = useState(false);
  const [modal, setModal] = useState<"join" | "leave" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  // Cek sesi login + status pendaftaran saat komponen tampil.
  useEffect(() => {
    let alive = true;
    clientApi<{ user: SessionUser }>("/api/auth/me").then((res) => {
      if (!alive) return;
      setUser(res.ok ? res.data.user : null);
      // Di dalam callback async (bukan saat render) — aman dari aturan purity.
      setRegOpen(new Date(regCloseAt).getTime() > Date.now());
    });
    return () => {
      alive = false;
    };
  }, [regCloseAt]);

  const joined = !!user && entryUserIds.includes(user.id);
  const canJoin = status === "upcoming" && regOpen && !joined;
  const canLeave = joined && status === "upcoming" && regOpen;

  if (user === undefined) {
    return (
      <div className="glass animate-pulse px-4 py-3 text-sm text-paper-mute">
        Memeriksa sesi login…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="glass space-y-3 px-4 py-4">
        <p className="text-sm text-paper-dim">
          Masuk dulu untuk ikut turnamen ini.
        </p>
        <div className="flex gap-3">
          <ButtonLink href="/masuk" size="sm">
            Masuk
          </ButtonLink>
          <ButtonLink href="/daftar" variant="ghost" size="sm">
            Daftar Akun
          </ButtonLink>
        </div>
      </div>
    );
  }

  const submit = async (action: "join" | "leave") => {
    setBusy(true);
    setError("");
    const res = await clientApi<{ entry?: unknown }>(
      `/api/tournaments/${slug}/${action}`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === "CONFLICT" || res.error.message.includes("sudah")) {
        setError("Kamu sudah terdaftar di turnamen ini.");
      } else if (res.error.code === "BAD_REQUEST") {
        setError(
          "Belum bisa bergabung — pastikan kamu sudah membuat fighter aktif di halaman Fighter Saya.",
        );
      } else {
        setError(res.error.message);
      }
      setModal(null);
      return;
    }
    setDone(
      action === "join"
        ? "Berhasil bergabung! Sampai jumpa di ring."
        : "Kamu sudah keluar dari turnamen ini.",
    );
    setModal(null);
    router.refresh();
  };

  return (
    <div className="glass space-y-3 px-4 py-4">
      {done ? (
        <p role="status" className="text-sm font-semibold text-emerald-400">
          {done}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-400">
          {error}
        </p>
      ) : null}

      {joined ? (
        <>
          <p className="text-sm font-semibold text-amber-brand">
            Kamu sudah terdaftar di turnamen ini.
          </p>
          {canLeave ? (
            <Button
              variant="danger"
              onClick={() => setModal("leave")}
              disabled={busy}
            >
              Keluar dari Turnamen
            </Button>
          ) : (
            <p className="text-xs text-paper-mute">
              Pendaftaran sudah ditutup — kamu tidak bisa keluar lagi.
            </p>
          )}
        </>
      ) : canJoin ? (
        <>
          <p className="text-sm text-paper-dim">
            Pendaftaran masih dibuka. Pastikan fighter-mu sudah dibuat.
          </p>
          <Button onClick={() => setModal("join")} disabled={busy}>
            Ikut Turnamen Ini
          </Button>
        </>
      ) : (
        <p className="text-sm text-paper-dim">
          {status === "upcoming"
            ? "Pendaftaran turnamen ini sudah ditutup."
            : "Turnamen ini tidak lagi menerima peserta."}
        </p>
      )}

      <Modal
        open={modal === "join"}
        onClose={() => setModal(null)}
        title="Ikut Turnamen?"
        confirmLabel="Ya, Ikut!"
        onConfirm={() => submit("join")}
        busy={busy}
      >
        <p>
          Fighter-mu akan didaftarkan ke turnamen ini. Bracket dibuat acak
          oleh admin setelah pendaftaran ditutup — kamu tidak bisa memilih
          lawan.
        </p>
      </Modal>

      <Modal
        open={modal === "leave"}
        onClose={() => setModal(null)}
        title="Keluar dari Turnamen?"
        confirmLabel="Ya, Keluar"
        confirmVariant="danger"
        onConfirm={() => submit("leave")}
        busy={busy}
      >
        <p>
          Slot-mu akan dikosongkan dan kamu tidak lagi masuk daftar peserta.
          Kamu masih bisa bergabung lagi selama pendaftaran belum ditutup.
        </p>
      </Modal>
    </div>
  );
}
