/**
 * Katalog gear (toko) — KOSMETIK SAJA, tanpa efek stat/damage.
 *
 * Setiap item gear memetakan ke SATU varian aksesoris di katalog yang
 * sudah ada (src/lib/game/accessories.ts): membeli gear = membuka
 * (unlock) varian aksesoris itu untuk fighter tersebut. Pemakaian
 * (equip) dilakukan lewat PATCH /api/fighters/[id] { accessories }
 * seperti biasa — gear hanya mengontrol APA yang boleh dipakai.
 *
 * Prinsip anti-monoton: menang ditentukan latihan/stat/deck, BUKAN
 * belanja. Karena itu tidak ada satu pun item di sini yang mengubah
 * stat, damage, atau peluang — hanya tampilan di arena.
 *
 * Varian default (sarung tinju, sepatu, tanpa aksesoris lain) TIDAK
 * dijual — semua fighter sudah memilikinya sejak awal.
 */
import type { AccessoryPart } from './accessories';

export interface GearItem {
  id: string;
  /** Bagian tubuh yang diubah item ini. */
  part: AccessoryPart;
  /** ID varian di ACCESSORY_CATALOG (accessories.ts). */
  variant: string;
  label: string;
  description: string;
  /** Harga dalam koin. */
  price: number;
}

export const GEAR_CATALOG: GearItem[] = [
  // --- Tangan (sarung) ---
  { id: 'gloves-big', part: 'hands', variant: 'big', label: 'Sarung Tinju Besar', description: 'Sarung oversize yang mencolok di arena.', price: 150 },
  { id: 'gloves-mma', part: 'hands', variant: 'mma', label: 'Sarung MMA', description: 'Sarung jari terbuka gaya MMA.', price: 150 },
  { id: 'gloves-wraps', part: 'hands', variant: 'wraps', label: 'Perban Tangan', description: 'Perban petarung jalanan, tanpa sarung.', price: 100 },
  { id: 'gloves-fingerless', part: 'hands', variant: 'fingerless', label: 'Sarung Tanpa Jari', description: 'Sarung separuh jari, grip penuh.', price: 120 },
  // --- Kaki ---
  { id: 'shoes-boots', part: 'feet', variant: 'boots', label: 'Sepatu Bot', description: 'Bot berat khas petarung gudang.', price: 150 },
  { id: 'shoes-martial', part: 'feet', variant: 'martial', label: 'Sepatu Bela Diri', description: 'Sepatu ringan khas dojo.', price: 150 },
  { id: 'shoes-sandals', part: 'feet', variant: 'sandals', label: 'Sandal', description: 'Sandal jepit — santai tapi berbahaya.', price: 80 },
  // --- Kepala ---
  { id: 'head-crown', part: 'head', variant: 'crown', label: 'Mahkota', description: 'Mahkota raja ring — untuk yang merasa juara.', price: 500 },
  { id: 'head-helmet', part: 'head', variant: 'helmet', label: 'Helm', description: 'Helm pelindung kepala.', price: 300 },
  { id: 'head-bandana', part: 'head', variant: 'bandana', label: 'Bandana', description: 'Bandana petarung jalanan.', price: 120 },
  { id: 'head-cap', part: 'head', variant: 'cap', label: 'Topi', description: 'Topi andalan.', price: 100 },
  { id: 'head-topknot', part: 'head', variant: 'topknot', label: 'Kuncir', description: 'Kuncir samurai.', price: 100 },
  // --- Badan ---
  { id: 'body-gi', part: 'body', variant: 'gi', label: 'Gi', description: 'Gi bela diri lengkap dengan sabuk.', price: 200 },
  { id: 'body-jacket', part: 'body', variant: 'jacket', label: 'Jaket', description: 'Jaket kulit jalanan.', price: 200 },
  { id: 'body-singlet', part: 'body', variant: 'singlet', label: 'Singlet', description: 'Singlet petarung.', price: 120 },
  { id: 'body-shirt', part: 'body', variant: 'shirt', label: 'Kaos', description: 'Kaos santai.', price: 100 },
  // --- Sabuk ---
  { id: 'belt-champion', part: 'belt', variant: 'champion', label: 'Sabuk Juara', description: 'Sabuk emas juara — tampil beda di arena.', price: 400 },
  { id: 'belt-rope', part: 'belt', variant: 'rope', label: 'Tali Pinggang', description: 'Tali pinggang sederhana.', price: 80 },
  // --- Senjata ---
  { id: 'weapon-nunchaku', part: 'weapon', variant: 'nunchaku', label: 'Nunchaku', description: 'Nunchaku — senjata andalan.', price: 400 },
  { id: 'weapon-wooden-sword', part: 'weapon', variant: 'wooden-sword', label: 'Pedang Kayu', description: 'Pedang kayu latihan.', price: 250 },
  { id: 'weapon-short-stick', part: 'weapon', variant: 'short-stick', label: 'Tongkat Pendek', description: 'Tongkat pendek eskrima.', price: 150 },
];

/** Cari item gear berdasarkan id, atau undefined. */
export function gearById(gearId: string): GearItem | undefined {
  return GEAR_CATALOG.find((g) => g.id === gearId);
}

/** Semua gear untuk satu bagian tubuh. */
export function gearForPart(part: AccessoryPart): GearItem[] {
  return GEAR_CATALOG.filter((g) => g.part === part);
}

/**
 * Apakah fighter boleh memakai varian aksesoris ini?
 * - Varian default tiap bagian (boxing/sneakers/none) selalu boleh.
 * - Varian lain hanya boleh kalau gear yang memetakannya sudah dibeli.
 */
export function isAccessoryUnlocked(
  part: AccessoryPart,
  variant: string,
  gearOwned: string[],
): boolean {
  if (variant === 'none') return true;
  if (part === 'hands' && variant === 'boxing') return true;
  if (part === 'feet' && variant === 'sneakers') return true;
  const gear = GEAR_CATALOG.find((g) => g.part === part && g.variant === variant);
  if (!gear) return false;
  return gearOwned.includes(gear.id);
}
