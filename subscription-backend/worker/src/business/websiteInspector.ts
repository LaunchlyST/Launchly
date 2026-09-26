import type { WebsiteInspection } from './businessTypes.ts';
import { fetchWithTimeout, isSafePublicUrl, readTextCapped } from './httpUtil.ts';
import { mergeSocialEvidence, socialsFromHtml } from './socialDiscovery.ts';

/**
 * Reads a business's public homepage the way any browser would: title,
 * description, favicon, social links, mailto: emails, and whether its own
 * headers allow it to be shown inside an iframe. We honour those headers —
 * if a site forbids framing, Launchly shows a native preview instead and
 * never proxies or strips the protection.
 */

/** Pure: do these response headers allow the page to be framed by `frontendOrigin`? */
export function isEmbeddable(headers: Headers, frontendOrigin: string): boolean {
  const xfo = headers.get('x-frame-options')?.toLowerCase().trim();
  if (xfo === 'deny' || xfo === 'sameorigin' || xfo?.startsWith('allow-from')) return false;

  const csp = headers.get('content-security-policy');
  if (csp) {
    const directive = csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.toLowerCase().startsWith('frame-ancestors'));
    if (directive) {
      const sources = directive.split(/\s+/).slice(1).map((s) => s.toLowerCase());
      if (sources.includes("'none'")) return false;
      if (sources.includes('*')) return true;
      const origin = frontendOrigin.toLowerCase();
      const host = new URL(origin).host;
      return sources.some(
        (s) => s === origin || s === host || (s.startsWith('*.') && host.endsWith(s.slice(1))) || s === 'https:'
      );
    }
  }
  return true;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function meta(html: string, key: string): string | null {
  const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["']`, 'i');
  const m = html.match(re1) ?? html.match(re2);
  return m && m[1].trim() ? decodeEntities(m[1]) : null;
}

function absolute(href: string | null, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

/** Pure: everything we can learn from homepage HTML. */
export function parseWebsiteHtml(html: string, finalUrl: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = meta(html, 'og:title') ?? (titleMatch ? decodeEntities(titleMatch[1].replace(/\s+/g, ' ')) || null : null);
  const metaDescription = meta(html, 'description');
  const description = metaDescription ?? meta(html, 'og:description');

  const iconMatch =
    html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["']/i);
  const favicon = absolute(iconMatch?.[1] ?? '/favicon.ico', finalUrl);
  const image = absolute(meta(html, 'og:image'), finalUrl);

  const emails = new Set<string>();
  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) {
    const e = decodeURIComponent(m[1]).trim().toLowerCase();
    if (EMAIL_RE.test(e)) emails.add(e);
  }
  for (const m of html.matchAll(/"email"\s*:\s*"([^"]+)"/gi)) {
    const e = m[1].replace(/^mailto:/i, '').trim().toLowerCase();
    if (EMAIL_RE.test(e)) emails.add(e);
  }

  const adSignals: string[] = [];
  if (/googletagmanager\.com\/gtag\/js\?id=AW-|gtag\(\s*['"]config['"]\s*,\s*['"]AW-/i.test(html)) adSignals.push('google_ads');
  if (/connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init/i.test(html)) adSignals.push('meta_pixel');
  if (/googletagmanager\.com\/gtm\.js/i.test(html)) adSignals.push('google_tag_manager');
  if (/analytics\.tiktok\.com/i.test(html)) adSignals.push('tiktok_pixel');

  const host = new URL(finalUrl).host;
  const keyLinks: { label: string; url: string }[] = [];
  const wanted = /^(about|about us|services|our services|menu|contact|contact us|book|book now|booking|pricing|prices|team|treatments|gallery)$/i;
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    if (!wanted.test(text)) continue;
    const url = absolute(m[1], finalUrl);
    if (!url || new URL(url).host !== host) continue;
    if (keyLinks.some((l) => l.label.toLowerCase() === text.toLowerCase())) continue;
    keyLinks.push({ label: text, url });
    if (keyLinks.length >= 6) break;
  }

  return {
    title,
    description,
    favicon,
    image,
    hasViewportMeta: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasMetaDescription: !!metaDescription,
    adSignals,
    emails: [...emails].slice(0, 5),
    socials: mergeSocialEvidence(socialsFromHtml(html)),
    keyLinks,
  };
}

export async function inspectWebsite(url: string, frontendOrigin: string, fetchImpl: typeof fetch = fetch): Promise<WebsiteInspection> {
  const domain = (() => {
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return url;
    }
  })();
  const failed: WebsiteInspection = {
    url,
    finalUrl: url,
    domain,
    ok: false,
    title: null,
    description: null,
    favicon: null,
    image: null,
    hasViewportMeta: false,
    hasMetaDescription: false,
    adSignals: [],
    emails: [],
    socials: [],
    keyLinks: [],
    embeddable: false,
  };
  if (!isSafePublicUrl(url)) return failed;

  try {
    const res = await fetchWithTimeout(url, { redirect: 'follow', headers: { Accept: 'text/html' } }, 8000, fetchImpl);
    const finalUrl = res.url || url;
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) {
      return { ...failed, finalUrl };
    }
    const html = await readTextCapped(res);
    const parsed = parseWebsiteHtml(html, finalUrl);
    return {
      url,
      finalUrl,
      domain: new URL(finalUrl).host.replace(/^www\./, ''),
      ok: true,
      ...parsed,
      // A plain-http page can never be framed inside the https app.
      embeddable: finalUrl.startsWith('https:') && isEmbeddable(res.headers, frontendOrigin),
    };
  } catch {
    return failed;
  }
}

/**
 * Generic public profile page preview (Instagram, Facebook, YouTube, LinkedIn)
 * from its OpenGraph tags. Those sites all forbid framing, and often return
 * little to signed-out visitors — whatever they don't give us stays null.
 */
export async function inspectProfilePage(url: string, frontendOrigin: string, fetchImpl: typeof fetch = fetch) {
  const base = { url, title: null as string | null, description: null as string | null, image: null as string | null, embeddable: false };
  if (!isSafePublicUrl(url)) return base;
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: 'text/html' } }, 7000, fetchImpl);
    if (!res.ok) return base;
    const html = await readTextCapped(res, 800_000);
    return {
      url,
      title: meta(html, 'og:title'),
      description: meta(html, 'og:description') ?? meta(html, 'description'),
      image: absolute(meta(html, 'og:image'), url),
      embeddable: isEmbeddable(res.headers, frontendOrigin),
    };
  } catch {
    return base;
  }
}
