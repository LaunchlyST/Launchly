/**
 * Turns whatever a customer typed — `creatorname`, `@creatorname`, or a full
 * TikTok profile URL — into a bare username Launchly's collector can use.
 * Pure function, no I/O, so it's cheap to unit test directly.
 */

const USERNAME_PATTERN = /^[a-zA-Z0-9._]{2,24}$/;

export type NormalizeResult = { ok: true; username: string } | { ok: false; reason: string };

export function normalizeTikTokUsername(input: string): NormalizeResult {
  let value = (input ?? '').trim();

  if (!value) return { ok: false, reason: 'empty' };

  // https://www.tiktok.com/@creatorname[?/...]
  const urlMatch = value.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/i);
  if (urlMatch) {
    value = urlMatch[1];
  } else {
    value = value.replace(/^@/, '');
  }

  value = value.trim();

  if (!USERNAME_PATTERN.test(value)) {
    return { ok: false, reason: 'invalid_username' };
  }

  return { ok: true, username: value.toLowerCase() };
}
