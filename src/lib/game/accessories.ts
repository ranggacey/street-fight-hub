/**
 * Katalog aksesoris fighter — SPESIFIKASI TUNGGAL sisi Hub.
 *
 * Tiap bagian tubuh punya banyak pilihan aksesoris (bukan cuma warna).
 * ID internal di sini DIPAKAI BERSAMA agen Arena — jangan diubah.
 * Warna tiap bagian TETAP dari `colors` (head←headband, hands←gloves,
 * feet←shoes, body←body, belt←belt, weapon←weapon).
 *
 * Aturan fallback (fighter lama tanpa `accessories`): diturunkan dari
 * warna — headband/sabuk/senjata yang warnanya terpasang dianggap
 * memakai varian lamanya, sisanya default bagian itu.
 */

export type AccessoryPart = 'head' | 'hands' | 'feet' | 'body' | 'belt' | 'weapon';

export interface AccessoryVariant {
  id: string;
  label: string;
}

/** Semua varian per bagian, sesuai katalog (ID jangan diubah). */
export const ACCESSORY_CATALOG: Record<AccessoryPart, AccessoryVariant[]> = {
  head: [
    { id: 'none', label: 'Tanpa aksesoris' },
    { id: 'headband', label: 'Ikat kepala' },
    { id: 'bandana', label: 'Bandana' },
    { id: 'cap', label: 'Topi' },
    { id: 'crown', label: 'Mahkota' },
    { id: 'helmet', label: 'Helm' },
    { id: 'topknot', label: 'Kuncir' },
  ],
  hands: [
    { id: 'none', label: 'Tanpa sarung' },
    { id: 'boxing', label: 'Sarung tinju' },
    { id: 'big', label: 'Sarung besar' },
    { id: 'mma', label: 'Sarung MMA' },
    { id: 'wraps', label: 'Perban tangan' },
    { id: 'fingerless', label: 'Sarung tanpa jari' },
  ],
  feet: [
    { id: 'barefoot', label: 'Tanpa alas' },
    { id: 'sneakers', label: 'Sepatu' },
    { id: 'boots', label: 'Sepatu bot' },
    { id: 'sandals', label: 'Sandal' },
    { id: 'martial', label: 'Sepatu bela diri' },
  ],
  body: [
    { id: 'none', label: 'Tanpa baju' },
    { id: 'shirt', label: 'Kaos' },
    { id: 'singlet', label: 'Singlet' },
    { id: 'jacket', label: 'Jaket' },
    { id: 'gi', label: 'Gi' },
  ],
  belt: [
    { id: 'none', label: 'Tanpa sabuk' },
    { id: 'belt', label: 'Sabuk' },
    { id: 'champion', label: 'Sabuk juara' },
    { id: 'rope', label: 'Tali pinggang' },
  ],
  weapon: [
    { id: 'none', label: 'Tanpa senjata' },
    { id: 'stick', label: 'Tongkat' },
    { id: 'short-stick', label: 'Tongkat pendek' },
    { id: 'wooden-sword', label: 'Pedang kayu' },
    { id: 'nunchaku', label: 'Nunchaku' },
  ],
};

export const ACCESSORY_PARTS: AccessoryPart[] = [
  'head',
  'hands',
  'feet',
  'body',
  'belt',
  'weapon',
];

/** ID varian yang dikenal per bagian (untuk validasi + enum skema). */
export const ACCESSORY_IDS: Record<AccessoryPart, string[]> = {
  head: ACCESSORY_CATALOG.head.map((v) => v.id),
  hands: ACCESSORY_CATALOG.hands.map((v) => v.id),
  feet: ACCESSORY_CATALOG.feet.map((v) => v.id),
  body: ACCESSORY_CATALOG.body.map((v) => v.id),
  belt: ACCESSORY_CATALOG.belt.map((v) => v.id),
  weapon: ACCESSORY_CATALOG.weapon.map((v) => v.id),
};

/** Aksesoris lengkap satu fighter (semua bagian terisi). */
export interface FighterAccessories {
  head: string;
  hands: string;
  feet: string;
  body: string;
  belt: string;
  weapon: string;
}

/** Default tiap bagian (dipakai kalau ID tak dikenal / tidak ada info warna). */
export const ACCESSORY_DEFAULTS: FighterAccessories = {
  head: 'none',
  hands: 'boxing',
  feet: 'sneakers',
  body: 'none',
  belt: 'none',
  weapon: 'none',
};

/** Label varian, atau label default bagian itu kalau ID tak dikenal. */
export function accessoryLabel(part: AccessoryPart, id: string): string {
  return (
    ACCESSORY_CATALOG[part].find((v) => v.id === id)?.label ??
    ACCESSORY_CATALOG[part].find((v) => v.id === ACCESSORY_DEFAULTS[part])!.label
  );
}

/** Apakah `id` varian yang dikenal untuk bagian ini? */
export function isKnownAccessory(part: AccessoryPart, id: string): boolean {
  return ACCESSORY_IDS[part].includes(id);
}

/**
 * Normalisasi satu pilihan: ID tak dikenal → default bagian itu.
 * Dipakai resolver supaya data lama / kiriman liar tidak pernah
 * menghasilkan varian yang tidak bisa digambar.
 */
export function normalizeAccessory(part: AccessoryPart, id: unknown): string {
  return typeof id === 'string' && isKnownAccessory(part, id)
    ? id
    : ACCESSORY_DEFAULTS[part];
}

/** Warna dianggap "terpasang" kalau ada dan bukan 'none'. */
export function isColorSet(value: string | null | undefined): boolean {
  return typeof value === 'string' && value !== 'none' && value.trim() !== '';
}

/** Warna per bagian yang dipakai resolver fallback. */
export interface AccessoryColorHints {
  headband?: string | null;
  belt?: string | null;
  weapon?: string | null;
}

/**
 * Default turunan warna untuk satu bagian (aturan fallback katalog):
 * kepala/sabuk/senjata mengikuti apakah warnanya terpasang, sisanya
 * default tetap (tangan tinju, kaki sepatu, badan tanpa baju).
 */
export function fallbackAccessory(
  part: AccessoryPart,
  colors?: AccessoryColorHints | null,
): string {
  switch (part) {
    case 'head':
      return isColorSet(colors?.headband) ? 'headband' : 'none';
    case 'hands':
      return 'boxing';
    case 'feet':
      return 'sneakers';
    case 'body':
      return 'none';
    case 'belt':
      return isColorSet(colors?.belt) ? 'belt' : 'none';
    case 'weapon':
      return isColorSet(colors?.weapon) ? 'stick' : 'none';
  }
}

/**
 * Resolusi lengkap: pilihan tersimpan (partial) + fallback turunan warna
 * untuk bagian yang belum dipilih. ID tak dikenal → default bagian itu.
 */
export function resolveAccessories(
  input?: Partial<FighterAccessories> | null,
  colors?: AccessoryColorHints | null,
): FighterAccessories {
  const out = {} as FighterAccessories;
  for (const part of ACCESSORY_PARTS) {
    const chosen = input?.[part];
    out[part] =
      typeof chosen === 'string' && isKnownAccessory(part, chosen)
        ? chosen
        : fallbackAccessory(part, colors);
  }
  return out;
}

/** Pemetaan legacy tangan → `gloves.type` di objek engine. */
export const GLOVES_TYPE_MAP: Record<string, string> = {
  none: 'none',
  boxing: 'boxing',
  big: 'big',
  mma: 'mma',
  wraps: 'wraps',
  fingerless: 'fingerless',
};

/** Pemetaan legacy kaki → `shoes.model` di objek engine. */
export const SHOES_MODEL_MAP: Record<string, string> = {
  barefoot: 'barefoot',
  sneakers: 'sneakers',
  boots: 'boots',
  sandals: 'sandals',
  martial: 'martial',
};
