import type { Env } from './types';
import { apiError, json } from './types';
import { getAuthenticatedUserId } from './auth';
import { hasCreatorApiAccess } from './creatorApiSubscription';
import {
  CreatorSearchInvalidQueryError,
  CreatorSearchNotFoundError,
  CreatorSearchUnavailableError,
  searchCreators,
} from './creatorSearchService';

/**
 * GET /api/creator-api/search
 *
 * The in-app search used from Settings → Developer's own search box (and any
 * future dedicated Search Creator API page) — session-authenticated, as
 * opposed to GET /api/v1/creators/search, which is the Bearer-API-key
 * gateway external customers' own backends call. Both end up calling the
 * same searchCreators() so there is exactly one search implementation.
 */
export async function handleCreatorApiSearch(request: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return apiError('UNAUTHENTICATED', 'Sign in required.', 401);

  if (!(await hasCreatorApiAccess(env, userId))) {
    return apiError(
      'CREATOR_API_SUBSCRIPTION_REQUIRED',
      'Creator API subscription required.',
      403
    );
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';

  try {
    const result = await searchCreators(env, { q });
    return json({
      success: true,
      ...(result.stale ? { stale: true } : {}),
      data: { creator: result.creator, recentVideos: result.recentVideos },
    });
  } catch (err) {
    if (err instanceof CreatorSearchInvalidQueryError) {
      return apiError('INVALID_QUERY', 'Invalid creator username.', 400);
    }
    if (err instanceof CreatorSearchNotFoundError) {
      return apiError('CREATOR_NOT_FOUND', 'Creator not found.', 404);
    }
    if (err instanceof CreatorSearchUnavailableError) {
      return apiError('CREATOR_DATA_UNAVAILABLE', 'Creator data is temporarily unavailable.', 503);
    }
    console.error('[creator-api-search] unexpected error', err instanceof Error ? err.message : err);
    return apiError('SERVER_ERROR', 'Something went wrong handling this request.', 500);
  }
}
