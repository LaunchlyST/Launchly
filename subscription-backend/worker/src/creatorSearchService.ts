/**
 * Launchly's own creator-search orchestration: normalize → DB freshness
 * check → public TikTok collector → normalize → persist → return. This is
 * the one function both the external Bearer-API-key endpoint and any
 * in-app search call — there is exactly one creator dataset and one
 * collection path, not one per caller.
 */
import type { Env } from './types';
import type { LaunchlyCreatorSearchResult } from './creatorTypes';
import { normalizeTikTokUsername } from './usernameNormalizer';
import { CollectorUnavailableError, CreatorNotFoundError, collectTikTokProfile } from './tiktokPublicCollector';
import { normalizeCreator, normalizeCreatorVideos } from './creatorNormalizer';
import {
  getCreatorByUsername,
  getFreshCreator,
  getRecentVideos,
  insertCreatorSnapshot,
  storedCreatorToLaunchlyCreator,
  upsertCreator,
  upsertCreatorVideos,
} from './creatorRepository';

export interface CreatorSearchParams {
  /** Raw, not-yet-normalized user input. */
  q: string;
}

/** Thrown for a genuinely nonexistent/removed public profile. Maps to 404. */
export class CreatorSearchNotFoundError extends Error {}
/** Thrown for input that fails validation before any lookup happens. Maps to 400. */
export class CreatorSearchInvalidQueryError extends Error {}
/** Thrown when collection fails and there is no usable stored data to fall back to. Maps to 503. */
export class CreatorSearchUnavailableError extends Error {}

const PROFILE_FRESHNESS_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function searchCreators(env: Env, params: CreatorSearchParams): Promise<LaunchlyCreatorSearchResult> {
  const normalized = normalizeTikTokUsername(params.q);
  if (!normalized.ok) {
    throw new CreatorSearchInvalidQueryError('Invalid creator username.');
  }
  const username = normalized.username;

  const fresh = await getFreshCreator(env, username, PROFILE_FRESHNESS_MS);
  if (fresh) {
    console.log(`[creator-search] cache hit username=${username}`);
    const creator = storedCreatorToLaunchlyCreator(fresh);
    const recentVideos = await getRecentVideos(env, fresh.row.id);
    return { creator, recentVideos };
  }

  console.log(`[creator-search] refresh started username=${username}`);
  const startedAt = Date.now();

  try {
    const raw = await collectTikTokProfile(username);
    const recentVideos = normalizeCreatorVideos(raw);
    const creator = normalizeCreator(raw, recentVideos);

    const creatorId = await upsertCreator(env, creator);
    if (creatorId) {
      await upsertCreatorVideos(env, creatorId, recentVideos);
      // Only on a real, fresh collection — never on a cache hit — so
      // history reflects actual change points, not request volume.
      await insertCreatorSnapshot(env, creatorId, creator);
    }

    console.log(`[creator-search] collector success username=${username} durationMs=${Date.now() - startedAt}`);
    return { creator, recentVideos };
  } catch (err) {
    if (err instanceof CreatorNotFoundError) {
      console.log(`[creator-search] not found username=${username} durationMs=${Date.now() - startedAt}`);
      throw new CreatorSearchNotFoundError('Creator not found.');
    }

    console.error(
      `[creator-search] collector failure username=${username} durationMs=${Date.now() - startedAt} reason=${err instanceof Error ? err.message : 'unknown'}`
    );

    // Live collection failed — serve stale stored data rather than an error
    // if we have anything at all for this username, and say so honestly.
    const stale = await getCreatorByUsername(env, username);
    if (stale) {
      console.log(`[creator-search] serving stale data username=${username}`);
      const creator = storedCreatorToLaunchlyCreator(stale);
      const recentVideos = await getRecentVideos(env, stale.row.id);
      return { creator, recentVideos, stale: true };
    }

    if (err instanceof CollectorUnavailableError) {
      throw new CreatorSearchUnavailableError('Creator data is temporarily unavailable.');
    }
    throw new CreatorSearchUnavailableError('Creator data is temporarily unavailable.');
  }
}
