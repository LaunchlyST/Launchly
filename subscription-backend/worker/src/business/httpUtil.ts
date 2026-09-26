export const USER_AGENT = 'LaunchlyBusinessConnect/1.0 (+https://launchly.pazeruga.workers.dev)';

export class UpstreamTimeoutError extends Error {}
export class UpstreamError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** fetch with a hard timeout; a hung upstream never hangs the worker. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers as Record<string, string> | undefined) },
    });
  } catch (err) {
    if (controller.signal.aborted) throw new UpstreamTimeoutError(`Timed out fetching ${new URL(url).host}`);
    throw new UpstreamError(err instanceof Error ? err.message : 'fetch failed');
  } finally {
    clearTimeout(timer);
  }
}

/** Read at most maxBytes of a body as text, so a huge page can't exhaust memory. */
export async function readTextCapped(res: Response, maxBytes = 1_500_000): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (total >= maxBytes) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return out + decoder.decode();
}

/** Only public http(s) URLs — no private hosts, no other schemes. */
export function isSafePublicUrl(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^(\d+\.){3}\d+$/.test(h)) return false; // bare IPs
  if (h.includes(':')) return false; // IPv6 literals
  return true;
}

export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().split(/[;\s]/)[0];
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return isSafePublicUrl(s) ? new URL(s).toString() : null;
}
