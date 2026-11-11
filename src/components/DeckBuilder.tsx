'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { getMoveMeta, isFinisherMove, targetLabel } from '@/lib/game/move-meta';
import { styleColor } from '@/components/api';

/**
 * DeckBuilder — seluruh bagian "Deck jurus" di /latihan.
 *
 * Kartu jurus bergaya kartu karakter TCG: area art 4/3 di atas (animasi
 * MovePreview), pita nama di bawah art, badge stat DMG / target / STA,
 * border warna gaya (styleColor) dan frame emas untuk finisher +
 * signature. Angka kartu dari getMoveMeta (katalog engine), STA =
 * power x 6 (biaya stamina dasar engine).
 *
 * Aturan bisnis TIDAK diubah di sini — komponen ini murni presentasional:
 * maks 6 kartu, tanpa duplikat, signature di luar deck dan 1x/fight, dan
 * signature tidak boleh sama dengan kartu deck. Semua validasi tetap di
 * server (src/lib/game/deck.ts + PUT /api/deck); komponen hanya
 * menonaktifkan pilihan yang jelas-jelas tidak valid supaya user tidak
 * perlu menebak kenapa simpan gagal.
 *
 * Preview gerakan: komponen ini TIDAK mengimpor MovePreview (milik Worker B).
 * Koordinator memasangnya lewat prop `renderPreview(kind, opts)`; tanpa prop itu
 * tiap kartu menampilkan placeholder rapi.
 *
 * Interaksi preview (spesifikasi kartu jurus):
 * - Ketuk area preview = memainkan animasi DI TEMPAT (MovePreview mode
 *   'tap': diam → main satu putaran → diam lagi). Preview BUKAN tombol
 *   buka-panel — area preview di-render di <div>, bukan di <button>.
 * - Panel preview besar dibuka lewat tombol ⤢ terpisah di pojok kartu
 *   (atau "Lihat gerakan" di kartu signature). Di panel, preview
 *   memakai mode 'loop' supaya gerakannya bisa dipelajari berulang.
 * - Preview diam tidak menjalankan rAF — puluhan kartu di grid tetap ringan.
 */

export interface DeckKindOption {
  kind: string;
  label: string;
  style: string;
  styleLabel: string;
  /** Catatan teknik singkat dari moves.js — tampil satu baris di kartu. */
  note?: string;
  /** Damage dasar (opsional — tampil di kartu kalau API menyediakannya). */
  dmg?: number;
  /** Target ('head' | 'body' | 'leg') — tampil di kartu kalau ada. */
  target?: string;
}

export interface DeckSignatureOption {
  kind: string;
  label: string;
}

export interface DeckBuilderData {
  cards: string[];
  signature: string | null;
  style: string;
  availableKinds: DeckKindOption[];
  signatureOptions: DeckSignatureOption[];
}

export interface DeckBuilderProps {
  /** Data deck dari GET /api/deck (null = belum dimuat). */
  deck: DeckBuilderData | null;
  /** Kind kartu yang sedang dipilih, sesuai urutan dipilih (maks 6). */
  deckCards: string[];
  onToggleCard: (kind: string) => void;
  deckSignature: string | null;
  onSignatureChange: (kind: string | null) => void;
  onSave: () => void;
  saving: boolean;
  /** Pesan hasil simpan ('' = tidak ada pesan). */
  deckMsg: string;
  /** Maks kartu deck — default 6 (cermin DECK_MAX_CARDS di deck.ts). */
  maxCards?: number;
  /**
   * Slot preview gerakan. Dipanggil dengan mode yang sesuai konteks:
   * - kartu grid → `{ mode: 'tap' }` (diam, ketuk untuk main di tempat);
   * - panel besar → `{ mode: 'loop' }` (berputar supaya bisa dipelajari).
   * Kalau tidak diberikan, tampil placeholder "Ketuk untuk lihat gerakan".
   */
  renderPreview?: (
    kind: string,
    opts?: { mode?: 'loop' | 'tap' },
  ) => ReactNode;
}

const DEFAULT_MAX_CARDS = 6;

/** Angka kartu ala Indonesia: bulat tampil bulat, desimal 1 angka (2,5). */
function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function groupKindsByStyle(kinds: DeckKindOption[], fighterStyle: string) {
  const groups = new Map<string, { style: string; styleLabel: string; kinds: DeckKindOption[] }>();
  for (const k of kinds) {
    let g = groups.get(k.styleLabel);
    if (!g) {
      g = { style: k.style, styleLabel: k.styleLabel, kinds: [] };
      groups.set(k.styleLabel, g);
    }
    g.kinds.push(k);
  }
  const list = [...groups.values()];
  for (const g of list) {
    g.kinds.sort((a, b) => a.label.localeCompare(b.label, 'id'));
  }
  // Gaya fighter sendiri paling atas, sisanya abjad — user paling sering
  // memakai jurus gayanya sendiri, jadi tidak perlu scroll jauh.
  list.sort((a, b) => {
    if (a.style === fighterStyle && b.style !== fighterStyle) return -1;
    if (b.style === fighterStyle && a.style !== fighterStyle) return 1;
    return a.styleLabel.localeCompare(b.styleLabel, 'id');
  });
  return list;
}

export default function DeckBuilder({
  deck,
  deckCards,
  onToggleCard,
  deckSignature,
  onSignatureChange,
  onSave,
  saving,
  deckMsg,
  maxCards = DEFAULT_MAX_CARDS,
  renderPreview,
}: DeckBuilderProps) {
  const [expandedKind, setExpandedKind] = useState<string | null>(null);

  const groups = useMemo(
    () => (deck ? groupKindsByStyle(deck.availableKinds, deck.style) : []),
    [deck],
  );

  const selectedCount = deckCards.length;
  const isFull = selectedCount >= maxCards;
  const selectedSet = useMemo(() => new Set(deckCards), [deckCards]);
  const expandedKindData = expandedKind
    ? deck?.availableKinds.find((k) => k.kind === expandedKind) ?? null
    : null;
  const expandedLabel = expandedKind
    ? expandedKindData?.label ??
      deck?.signatureOptions.find((o) => o.kind === expandedKind)?.label ??
      expandedKind
    : null;

  return (
    <section id="deck" className="glass p-4" aria-labelledby="deck-heading">
      <h2 id="deck-heading" className="font-display text-lg font-semibold uppercase tracking-wide text-paper">
        Deck jurus
      </h2>
      <p className="mt-0.5 text-sm text-paper-dim">
        Maks {maxCards} kartu dari gaya apa pun — kartu dipakai 2x lebih sering di fight. Jurus khas
        (signature) di luar deck, dipakai 1x/fight.
      </p>

      {!deck ? (
        <p className="mt-3 text-sm text-paper-dim">Memuat daftar jurus…</p>
      ) : (
        <>
          {/* Header deck: jumlah + progress + strip deck terpilih */}
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-paper-dim">
                Dipilih: <strong className="text-paper">{selectedCount} / {maxCards}</strong>
              </span>
              <span className="text-xs text-paper-mute">
                {isFull ? 'Deck penuh' : `Sisa ${maxCards - selectedCount} slot`}
              </span>
            </div>
            <div
              className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink-700"
              role="progressbar"
              aria-valuenow={selectedCount}
              aria-valuemin={0}
              aria-valuemax={maxCards}
              aria-label="Kartu deck terpilih"
            >
              <div
                className="h-full rounded-full bg-amber-brand transition-all duration-300"
                style={{ width: `${(selectedCount / maxCards) * 100}%` }}
              />
            </div>
          </div>

          {/* Strip "Deck saya" — urutan kartu terlihat jelas, ketuk ✕ untuk batal */}
          <div className="mt-3 rounded-xl bg-ink-800 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-paper-mute">Deck saya</p>
            {selectedCount === 0 ? (
              <p className="mt-1.5 text-sm text-paper-dim">
                Belum ada kartu — ketuk kartu jurus di bawah untuk memilih.
              </p>
            ) : (
              <ol className="mt-2 flex flex-wrap gap-2">
                {deckCards.map((kind, i) => {
                  const label = deck.availableKinds.find((k) => k.kind === kind)?.label ?? kind;
                  return (
                    <li key={kind}>
                      <button
                        type="button"
                        onClick={() => onToggleCard(kind)}
                        aria-label={`Hapus ${label} dari deck (urutan ${i + 1})`}
                        className="flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-brand px-2.5 py-1 text-sm font-semibold text-[#1a1206]"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a1206] font-display text-xs text-amber-brand">
                          {i + 1}
                        </span>
                        {label}
                        <span aria-hidden="true">✕</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            {isFull && (
              <p className="mt-2 text-xs leading-relaxed text-paper-dim">
                Deck penuh — batalkan salah satu kartu di atas untuk mengganti jurus.
              </p>
            )}
          </div>

          {/* Panel preview besar — dibuka tombol ⤢ di kartu / "Lihat
              gerakan" di signature. Di sini preview berputar (mode loop)
              supaya gerakannya bisa dipelajari; di kartu grid ia diam
              (mode tap) dan dimainkan di tempat. */}
          {expandedKind && (
            <div className="mt-3 rounded-xl border border-amber-brand/60 bg-ink-800 p-3 shadow-xl shadow-black/40">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-lg font-semibold uppercase tracking-wide text-paper">
                  {expandedLabel}
                </p>
                <button
                  type="button"
                  onClick={() => setExpandedKind(null)}
                  aria-label="Tutup preview gerakan"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-ink-700 text-lg text-paper transition-colors hover:bg-ink-700/70"
                >
                  ✕
                </button>
              </div>
              {expandedKindData?.note && (
                <p className="mt-0.5 text-sm leading-relaxed text-paper-dim">
                  {expandedKindData.note}
                </p>
              )}
              <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg bg-ink-950">
                {renderPreview ? (
                  renderPreview(expandedKind, { mode: 'loop' })
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
                    <span aria-hidden="true" className="font-display text-4xl text-amber-brand">▶</span>
                    <p className="text-sm text-paper-dim">
                      Preview gerakan {expandedLabel} belum tersedia.
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-paper-mute">
                Ketuk kartu jurus di bawah untuk memilih / membatalkan — preview di sini hanya
                untuk melihat gerakannya.
              </p>
            </div>
          )}

          {/* Kartu jurus, dikelompokkan per gaya */}
          {groups.map((group) => (
            <div key={group.styleLabel} className="mt-4">
              <h3 className="flex items-baseline gap-2 font-display text-base font-semibold uppercase tracking-wide text-paper">
                {group.styleLabel}
                <span className="font-body text-xs font-normal normal-case tracking-normal text-paper-mute">
                  {group.kinds.length} jurus
                </span>
                {group.style === deck.style && (
                  <span className="rounded-md bg-amber-brand px-1.5 py-0.5 font-body text-[11px] font-semibold normal-case tracking-normal text-[#1a1206]">
                    Gaya kamu
                  </span>
                )}
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.kinds.map((k) => {
                  const selected = selectedSet.has(k.kind);
                  const order = selected ? deckCards.indexOf(k.kind) + 1 : null;
                  const disabled = !selected && isFull;
                  // Angka kartu dari katalog engine (move-meta.ts), bukan
                  // karangan: dmg + target dari STYLES, STA = power x 6
                  // (biaya stamina dasar, lihat fight.js: power*6*rate).
                  const meta = getMoveMeta(k.kind);
                  const accent = styleColor(k.style);
                  const gold = isFinisherMove(k.kind);
                  const borderColor = selected ? '#EAB308' : gold ? '#FDE047' : accent;
                  return (
                    <article
                      key={k.kind}
                      style={{ borderColor }}
                      className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-ink-800 shadow-md shadow-black/40 transition-all duration-200 ${
                        selected
                          ? 'shadow-lg shadow-amber-brand/20 ring-2 ring-amber-brand/50'
                          : disabled
                            ? 'opacity-40'
                            : gold
                              ? 'shadow-lg shadow-yellow-400/10 ring-1 ring-yellow-300/50 hover:-translate-y-0.5'
                              : 'hover:-translate-y-0.5 hover:shadow-lg'
                      }`}
                    >
                      {/* Badge terpilih + nomor urut — status harus terlihat sekilas */}
                      {selected && (
                        <span className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-brand px-2 py-0.5 text-xs font-bold text-[#1a1206] shadow-md shadow-black/40">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1a1206] font-display text-[10px] text-amber-brand">
                            {order}
                          </span>
                          Dipilih
                        </span>
                      )}

                      {/* Area art kartu TCG — rasio 4/3 (sama dengan kanvas
                          MovePreview) + frame dalam + gradient gelap,
                          supaya terasa seperti kotak art kartu koleksi.
                          <div>, BUKAN tombol: ketuk preview = mainkan
                          animasi DI TEMPAT (MovePreview mode tap).
                          Panel besar dibuka tombol ⤢ terpisah di pojok. */}
                      <div className="relative m-2 mb-0 aspect-[4/3] overflow-hidden rounded-lg bg-gradient-to-b from-ink-700 via-ink-800 to-ink-950 ring-1 ring-white/15">
                        {renderPreview ? (
                          renderPreview(k.kind, { mode: 'tap' })
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedKind(k.kind)}
                            aria-label={`Lihat gerakan ${k.label}`}
                            className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center"
                          >
                            <span aria-hidden="true" className="font-display text-3xl leading-none text-amber-brand">
                              ▶
                            </span>
                            <span className="text-[11px] leading-tight text-paper-mute">
                              Ketuk untuk lihat gerakan
                            </span>
                          </button>
                        )}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setExpandedKind(k.kind)}
                          aria-label={`Perbesar preview ${k.label}`}
                          title="Perbesar preview"
                          className="absolute bottom-2 right-2 z-20 flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-ink-950/80 text-base text-paper backdrop-blur-sm transition-colors hover:bg-amber-brand hover:text-[#1a1206]"
                        >
                          <span aria-hidden="true">⤢</span>
                        </button>
                      </div>

                      {/* Badan kartu — ketuk untuk pilih / batal pilih */}
                      <button
                        type="button"
                        onClick={() => onToggleCard(k.kind)}
                        disabled={disabled}
                        aria-pressed={selected}
                        aria-label={
                          selected
                            ? `Batal pilih ${k.label} (urutan ${order} di deck)`
                            : disabled
                              ? `${k.label} — deck sudah penuh (${maxCards}/${maxCards})`
                              : `Pilih ${k.label} ke deck`
                        }
                        className="flex min-h-11 flex-1 flex-col items-stretch pb-3 text-left"
                      >
                        {/* Pita nama ala TCG: band gelap + aksen gaya di kiri */}
                        <span
                          className="mx-2 mt-2 block rounded-lg border-l-4 bg-ink-950/70 px-2.5 py-1.5 ring-1 ring-white/10"
                          style={{ borderLeftColor: borderColor }}
                        >
                          <span className="block font-display text-lg font-semibold uppercase leading-tight tracking-wide text-paper">
                            {k.label}
                          </span>
                          <span className="block text-[11px] font-medium text-paper-dim">
                            {k.styleLabel}
                            {gold ? ' • ★ Finisher' : meta.isSpecial ? ' • ★ Spesial' : ''}
                          </span>
                        </span>
                        {/* Badge stat — hanya yang ada datanya di katalog */}
                        {meta.found && (meta.dmg > 0 || meta.target || meta.power > 0) && (
                          <span className="mt-1.5 flex flex-wrap gap-1 px-2">
                            {meta.dmg > 0 && (
                              <span className="rounded-md bg-amber-brand/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-brand">
                                DMG {fmtNum(meta.dmg)}
                              </span>
                            )}
                            {meta.target ? (
                              <span className="rounded-md bg-ink-700 px-1.5 py-0.5 text-[11px] font-medium text-paper-dim">
                                🎯 {targetLabel(meta.target)}
                              </span>
                            ) : null}
                            {meta.power > 0 && (
                              <span className="rounded-md bg-ink-700 px-1.5 py-0.5 text-[11px] font-medium text-paper-dim">
                                STA {fmtNum(meta.power * 6)}
                              </span>
                            )}
                          </span>
                        )}
                        {k.note && (
                          <span className="mt-1.5 line-clamp-2 px-2 text-xs leading-relaxed text-paper-dim">
                            {k.note}
                          </span>
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Signature — deretan kartu kecil, bukan dropdown polos */}
          <div className="mt-5 border-t border-ink-700 pt-4">
            <h3 className="font-display text-base font-semibold uppercase tracking-wide text-paper">
              Jurus khas (signature)
            </h3>
            <p className="mt-0.5 text-sm text-paper-dim">
              Di luar deck, dipakai 1x/fight. Tidak boleh sama dengan kartu deck.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => onSignatureChange(null)}
                aria-pressed={deckSignature === null}
                className={`flex min-h-11 flex-col items-start justify-center gap-0.5 rounded-2xl border-2 p-2.5 text-left shadow-md shadow-black/40 transition-all duration-200 ${
                  deckSignature === null
                    ? 'border-amber-brand bg-amber-brand/10 shadow-lg shadow-amber-brand/10 ring-1 ring-amber-brand/40'
                    : 'border-transparent bg-ink-800 hover:border-amber-brand/40'
                }`}
              >
                <span className="font-display text-base font-semibold uppercase leading-tight text-paper">
                  Tanpa signature
                </span>
                <span className="text-xs text-paper-dim">Tidak pakai jurus khas</span>
              </button>
              {deck.signatureOptions.map((o) => {
                const inDeck = selectedSet.has(o.kind);
                const selected = deckSignature === o.kind;
                // Kartu signature = kartu TCG berframe emas (bukan border
                // gaya): angka stat sama sumbernya dengan kartu deck.
                const sigMeta = getMoveMeta(o.kind);
                const sigBorder = selected ? '#EAB308' : '#FDE047';
                return (
                  <div
                    key={o.kind}
                    style={{ borderColor: sigBorder }}
                    className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-ink-800 shadow-md shadow-black/40 transition-all duration-200 ${
                      selected
                        ? 'shadow-lg shadow-amber-brand/20 ring-2 ring-amber-brand/50'
                        : 'shadow-lg shadow-yellow-400/10 ring-1 ring-yellow-300/50 hover:-translate-y-0.5'
                    } ${inDeck && !selected ? 'opacity-40' : ''}`}
                  >
                    {selected && (
                      <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-brand px-2 py-0.5 text-xs font-bold text-[#1a1206]">
                        Dipilih
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onSignatureChange(o.kind)}
                      disabled={inDeck && !selected}
                      aria-pressed={selected}
                      aria-label={
                        inDeck
                          ? `${o.label} sudah ada di kartu deck — tidak bisa jadi signature`
                          : selected
                            ? `Batal pilih signature ${o.label}`
                            : `Pilih ${o.label} sebagai signature`
                      }
                      className="flex min-h-11 flex-1 flex-col items-stretch pb-2.5 text-left"
                    >
                      <span className="mx-2 mt-2 block rounded-lg border-l-4 border-yellow-300 bg-ink-950/70 px-2.5 py-1.5 ring-1 ring-white/10">
                        <span className="block font-display text-base font-semibold uppercase leading-tight tracking-wide text-paper">
                          {o.label}
                        </span>
                        <span className="block text-[11px] font-medium text-paper-dim">
                          ★ Jurus khas • 1x/fight
                        </span>
                      </span>
                      {sigMeta.found && (sigMeta.dmg > 0 || sigMeta.target || sigMeta.power > 0) && (
                        <span className="mt-1.5 flex flex-wrap gap-1 px-2">
                          {sigMeta.dmg > 0 && (
                            <span className="rounded-md bg-amber-brand/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-brand">
                              DMG {fmtNum(sigMeta.dmg)}
                            </span>
                          )}
                          {sigMeta.target ? (
                            <span className="rounded-md bg-ink-700 px-1.5 py-0.5 text-[11px] font-medium text-paper-dim">
                              🎯 {targetLabel(sigMeta.target)}
                            </span>
                          ) : null}
                          {sigMeta.power > 0 && (
                            <span className="rounded-md bg-ink-700 px-1.5 py-0.5 text-[11px] font-medium text-paper-dim">
                              STA {fmtNum(sigMeta.power * 6)}
                            </span>
                          )}
                        </span>
                      )}
                      <span className="mt-1.5 px-2 text-xs text-paper-dim">
                        {inDeck ? 'Sudah di deck — pilih jurus lain' : 'Di luar deck'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedKind(o.kind)}
                      aria-label={`Lihat gerakan ${o.label}`}
                      className="flex min-h-11 items-center gap-1 border-t border-ink-700 px-2.5 text-xs font-medium text-amber-brand"
                    >
                      <span aria-hidden="true">▶</span> Lihat gerakan
                    </button>
                  </div>
                );
              })}
            </div>
            {deckSignature && selectedSet.has(deckSignature) && (
              <p className="mt-2 text-sm text-red-brand" role="alert">
                Signature sama dengan kartu deck — pilih jurus lain sebelum menyimpan.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="mt-4 min-h-12 w-full rounded-xl bg-amber-brand font-display text-lg font-semibold uppercase tracking-wide text-[#1a1206] disabled:opacity-40"
          >
            {saving ? 'Menyimpan…' : 'Simpan deck'}
          </button>
          {deckMsg && (
            <p className="mt-2 text-sm text-paper-dim" aria-live="polite">
              {deckMsg}
            </p>
          )}
        </>
      )}
    </section>
  );
}
