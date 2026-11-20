export const ROOM_CODE_REGEX = /^\d{6}$/;

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
}

/** Membersihkan input kode room pengguna hingga maksimal 6 digit angka. */
export function sanitizeRoomCodeInput(raw: string): string {
  return raw.replace(/\D+/g, "").slice(0, 6);
}

/** Memformat 6 digit kode menjadi dua kelompok agar nyaman dibaca (mis. "482910" -> "482 910"). */
export function formatRoomCodeDisplay(code: string): string {
  const digits = sanitizeRoomCodeInput(code);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** Menghasilkan kode room 6 digit ("000000".."999999"). */
export function generateRoomCode(randomInt?: (maxExclusive: number) => number): string {
  let value: number;
  if (randomInt) {
    value = randomInt(1_000_000);
  } else if (globalThis.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0] % 1_000_000;
  } else {
    value = Math.floor(Math.random() * 1_000_000);
  }

  const normalized = Math.abs(Math.trunc(value)) % 1_000_000;
  return String(normalized).padStart(6, "0");
}

export function normalizeParticipantName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function createRandomSuffix(length = 4): string {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    suffix += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return suffix;
}

/** Menghasilkan slug URL ramah baca (mis. "Rapat Kelompok Bab 3" -> "rapat-kelompok-bab-3-x8k2"). */
export function generateRoomSlug(title: string, randomSuffix?: string): string {
  const asciiTitle = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

  const base = asciiTitle || "jadwal";
  const rawSuffix = randomSuffix ? randomSuffix.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const suffix = rawSuffix || createRandomSuffix(4);
  return `${base}-${suffix}`;
}
