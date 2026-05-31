// Order reference codes shown to the customer (e.g. "TM-7K3F9Q2X").
//
// Workers-safe: uses the Web Crypto API (globalThis.crypto.getRandomValues),
// NOT Node's crypto.randomBytes — the OpenNext Cloudflare runtime has no Node
// crypto by default. The code must be high-entropy because /track looks an
// order up by code + phone, and the code is the only secret the customer holds.

// No ambiguous characters (0/O, 1/I) so it's easy to read over the phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIX = "TM-";
const CODE_LENGTH = 8;

/**
 * Generate a random order reference code like "TM-7K3F9Q2X".
 * ~5 x 10^11 combinations over 8 chars; collisions are vanishingly unlikely,
 * but callers should still treat the column's UNIQUE constraint as the guard.
 */
export function generateReferenceCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return PREFIX + out;
}

/** Normalize user-typed codes for comparison (uppercase, trim, collapse spaces). */
export function normalizeReferenceCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
