/**
 * Generates and hashes Launchly API keys. Only `key_hash` (and the short,
 * non-secret `key_prefix`) is ever persisted — the full secret exists only
 * in-memory for the single response that creates it.
 */

const KEY_PREFIX = 'lch_live_';

function toBase62(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** A cryptographically random full API key, e.g. `lch_live_M7s9Qk...`. */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${KEY_PREFIX}${toBase62(bytes)}`;
}

/** The short, safe-to-store/display prefix, e.g. `lch_live_M7s9`. */
export function keyPrefix(fullKey: string): string {
  return fullKey.slice(0, KEY_PREFIX.length + 4);
}

/** SHA-256 of the full key, hex-encoded — the only form ever stored. */
export async function hashApiKey(fullKey: string): Promise<string> {
  const data = new TextEncoder().encode(fullKey);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(KEY_PREFIX) && value.length > KEY_PREFIX.length + 16;
}
