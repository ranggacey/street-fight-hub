"use client";

import { useEffect, type ReactNode } from "react";
import Button from "./Button";

/** Modal konfirmasi / dialog kecil. */
export default function Modal({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel = "Batal",
  onConfirm,
  confirmVariant = "primary",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmVariant?: "primary" | "danger";
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass-strong w-full max-w-md animate-pop-in p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl uppercase tracking-wide text-paper">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-paper-dim">
          {children}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          {onConfirm && confirmLabel ? (
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? "Memproses…" : confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
