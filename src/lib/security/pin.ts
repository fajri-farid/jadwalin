export const PIN_REGEX = /^\d{4}$/;

const PIN_HASH_REGEX = /^[a-f0-9]{64}$/i;

export function isValidPin(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API (crypto.subtle) tidak tersedia pada runtime ini.");
  }
  return subtle;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Menghasilkan hash SHA-256 bersalt untuk PIN opsional 4 digit peserta Guest.
 * Jangan pernah menyimpan PIN dalam bentuk plaintext ke Firestore atau localStorage.
 */
export async function hashParticipantPin(pin: string, salt: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new RangeError("PIN peserta harus terdiri dari tepat 4 digit angka.");
  }
  if (!salt || !salt.trim()) {
    throw new RangeError("Salt untuk hashing PIN tidak boleh kosong.");
  }

  const subtle = getSubtleCrypto();
  const payload = new TextEncoder().encode(`jadwalin:pin:v1:${salt}:${pin}`);
  const digest = await subtle.digest("SHA-256", payload);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyParticipantPin(
  pin: string,
  salt: string,
  expectedPinHash: string | null | undefined
): Promise<boolean> {
  if (!expectedPinHash || !PIN_HASH_REGEX.test(expectedPinHash)) return false;
  if (!isValidPin(pin) || !salt || !salt.trim()) return false;

  const actualHash = await hashParticipantPin(pin, salt);
  return constantTimeHexEqual(actualHash, expectedPinHash.toLowerCase());
}
