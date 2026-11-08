import { formatTimeWIB, formatWIB, styleLabel } from "@/components/api";
import FighterAvatar from "@/components/FighterAvatar";
import type { ChatMessageItem } from "@/components/types";

/**
 * Satu baris pesan chat global — presentasional murni (tanpa fetch).
 *
 * Identitas pengirim = karakter petarung: PP FighterAvatar + nama fighter.
 * Username akun HANYA tampil kalau pengirim belum punya fighter (fighter
 * null) — itu satu-satunya kasus username boleh tampil di chat.
 *
 * Pesan sendiri: rata kanan, bubble amber. Pesan orang lain: rata kiri,
 * bubble kaca gelap. Nama + gaya + jam selalu di atas bubble.
 */
export default function ChatMessageRow({
  message,
  isOwn,
}: {
  message: ChatMessageItem;
  isOwn: boolean;
}) {
  const fighter = message.fighter ?? null;
  const name = fighter?.displayName ?? (message.username ? `@${message.username}` : "—");
  const style = fighter?.style ? styleLabel(fighter.style) : "";
  const time = formatTimeWIB(message.createdAt ?? null);
  const fullTime = formatWIB(message.createdAt ?? null);

  return (
    <div className={`flex items-start gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}>
      <FighterAvatar fighter={fighter} username={message.username} size={40} />
      <div className={`min-w-0 max-w-[80%] sm:max-w-[75%] ${isOwn ? "text-right" : ""}`}>
        <p className="mb-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
          <span className="min-w-0 truncate font-bold text-paper">{name}</span>
          {style ? <span className="shrink-0 text-paper-mute">• {style}</span> : null}
          <span className="shrink-0 text-paper-mute" title={fullTime}>
            {time}
          </span>
        </p>
        <p
          className={`inline-block break-words rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed ${
            isOwn
              ? "rounded-tr-sm bg-amber-brand font-medium text-on-amber"
              : "rounded-tl-sm border border-white/10 bg-white/5 text-paper"
          }`}
        >
          {message.text}
        </p>
      </div>
    </div>
  );
}
