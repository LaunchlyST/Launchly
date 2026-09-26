import type { SocialPlatform, SocialProfileEvidence, SocialProfiles, SocialSource } from './businessTypes.ts';
import { SOCIAL_MIN_CONFIDENCE, SOCIAL_PLATFORMS } from './businessTypes.ts';

/**
 * Finds social profiles only where a business itself (or the data provider)
 * points at them. Nothing here guesses a handle from a business name: a URL
 * is accepted only if it was found as a real link and has the shape of a
 * profile page on that platform.
 */

const PROFILE_PATTERNS: Record<SocialPlatform, RegExp> = {
  instagram: /^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(\?.*)?$/i,
  facebook: /^https?:\/\/(www\.|m\.|business\.)?facebook\.com\/(?!sharer|share|dialog|plugins|tr\b|login)([A-Za-z0-9.\-]{2,80}|profile\.php\?id=\d+|people\/[^/]+\/\d+)\/?(\?.*)?$/i,
  youtube: /^https?:\/\/(www\.|m\.)?youtube\.com\/(@[A-Za-z0-9._\-]{2,}|channel\/[A-Za-z0-9_\-]{10,}|c\/[A-Za-z0-9._\-]+|user\/[A-Za-z0-9._\-]+)\/?(\?.*)?$/i,
  tiktok: /^https?:\/\/(www\.)?tiktok\.com\/@([A-Za-z0-9._]{2,24})\/?(\?.*)?$/i,
  linkedin: /^https?:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/(company|in|school)\/([A-Za-z0-9\-_%.]+)\/?(\?.*)?$/i,
};

const RESERVED = new Set(['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'watch', 'embed', 'share', 'home', 'about', 'help', 'privacy', 'legal', 'policies']);

/** Classify a URL as a social profile, or null if it isn't one. */
export function classifySocialUrl(raw: string): { platform: SocialPlatform; url: string; username: string | null } | null {
  let url = raw.trim().replace(/&amp;/g, '&');
  if (url.startsWith('//')) url = `https:${url}`;
  for (const platform of SOCIAL_PLATFORMS) {
    const m = url.match(PROFILE_PATTERNS[platform]);
    if (!m) continue;
    let username: string | null = null;
    if (platform === 'instagram' || platform === 'tiktok') username = m[2];
    else if (platform === 'facebook' && !/profile\.php|people\//.test(m[2])) username = m[2];
    else if (platform === 'youtube' && m[2].startsWith('@')) username = m[2].slice(1);
    else if (platform === 'linkedin') username = m[4];
    if (username && RESERVED.has(username.toLowerCase())) return null;
    const clean = url.replace(/[?#].*$/, '').replace(/\/+$/, '');
    return { platform, url: platform === 'facebook' && /profile\.php/.test(url) ? url : clean, username };
  }
  return null;
}

/**
 * OSM carries social links as `contact:instagram` etc. Some are full URLs,
 * some bare handles — a bare handle entered by an OSM mapper against that
 * specific business is provider data, not a guess, so it's accepted.
 */
export function socialsFromOsmTags(tags: Record<string, string>): SocialProfileEvidence[] {
  const out: SocialProfileEvidence[] = [];
  const bases: Record<SocialPlatform, string> = {
    instagram: 'https://www.instagram.com/',
    facebook: 'https://www.facebook.com/',
    youtube: 'https://www.youtube.com/',
    tiktok: 'https://www.tiktok.com/@',
    linkedin: 'https://www.linkedin.com/company/',
  };
  for (const platform of SOCIAL_PLATFORMS) {
    const raw = tags[`contact:${platform}`] ?? tags[platform];
    if (!raw) continue;
    let candidate = raw.trim();
    if (!/^https?:\/\//i.test(candidate)) {
      if (/\.(com|net)\//i.test(candidate)) candidate = `https://${candidate}`;
      else candidate = bases[platform] + candidate.replace(/^@/, '');
    }
    const hit = classifySocialUrl(candidate);
    if (hit && hit.platform === platform) {
      out.push({ ...hit, source: 'provider', confidence: 0.9 });
    }
  }
  return out;
}

/** Social profile links found in a business's own website HTML. */
export function socialsFromHtml(html: string): SocialProfileEvidence[] {
  const out: SocialProfileEvidence[] = [];
  const add = (url: string, source: SocialSource, confidence: number) => {
    const hit = classifySocialUrl(url);
    if (hit) out.push({ ...hit, source, confidence });
  };

  // JSON-LD "sameAs": the business explicitly declaring its own profiles.
  for (const block of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(walk);
        const same = node.sameAs;
        if (typeof same === 'string') add(same, 'structured_data', 1);
        else if (Array.isArray(same)) same.forEach((s: unknown) => typeof s === 'string' && add(s, 'structured_data', 1));
        Object.values(node).forEach(walk);
      };
      walk(JSON.parse(block[1]));
    } catch {
      /* malformed JSON-LD is common; ignore it */
    }
  }

  // Plain <a href> links on the business's own site.
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    add(m[1], 'business_website', 0.95);
  }
  return out;
}

/**
 * Merge evidence from all sources into one profile per platform. The highest
 * confidence wins; a platform where the site links two different accounts
 * with equal confidence is ambiguous and dropped rather than picked at random.
 */
export function mergeSocialEvidence(...lists: SocialProfileEvidence[][]): SocialProfileEvidence[] {
  const byPlatform = new Map<SocialPlatform, SocialProfileEvidence[]>();
  for (const e of lists.flat()) {
    if (e.confidence < SOCIAL_MIN_CONFIDENCE) continue;
    const arr = byPlatform.get(e.platform) ?? [];
    arr.push(e);
    byPlatform.set(e.platform, arr);
  }
  const out: SocialProfileEvidence[] = [];
  for (const [, arr] of byPlatform) {
    arr.sort((a, b) => b.confidence - a.confidence);
    const best = arr[0];
    const distinctTop = new Set(
      arr.filter((e) => e.confidence === best.confidence).map((e) => e.url.toLowerCase())
    );
    if (distinctTop.size > 1) continue;
    out.push(best);
  }
  return out.sort((a, b) => SOCIAL_PLATFORMS.indexOf(a.platform) - SOCIAL_PLATFORMS.indexOf(b.platform));
}

export function evidenceToProfiles(evidence: SocialProfileEvidence[]): SocialProfiles {
  const profiles: SocialProfiles = { instagram: null, facebook: null, youtube: null, tiktok: null, linkedin: null };
  for (const e of evidence) profiles[e.platform] = e.url;
  return profiles;
}
