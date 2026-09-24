import type { Env } from './types';
import { apiError, json } from './types';
import { getAuthenticatedUserId } from './auth';
import { hasCreatorApiAccess } from './creatorApiSubscription';
import { CreatorSearchUnavailableError, searchCreators } from './creatorSearchService';

const MAX_QUERY_LENGTH = 100;
const REGION_PATTERN = /^[A-Z]{2}$/;

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
  const q = (url.searchParams.get('q') || '').trim().replace(/^@/, '');
  const region = (url.searchParams.get('region') || '').trim().toUpperCase();

  if (!q || q.length > MAX_QUERY_LENGTH) {
    return apiError('INVALID_REQUEST', 'q is required and must be 1–100 characters.', 400);
  }
  if (region && !REGION_PATTERN.test(region)) {
    return apiError('INVALID_REQUEST', 'region must be a 2-letter market code, e.g. GB.', 400);
  }

  try {
    const creators = await searchCreators(env, { q, region: region || undefined });
    return json({ success: true, data: { creators } });
  } catch (err) {
    if (err instanceof CreatorSearchUnavailableError) {
      return apiError('SERVICE_UNAVAILABLE', 'Creator search is temporarily unavailable.', 503);
    }
    return apiError('INTERNAL_ERROR', 'Something went wrong handling this request.', 500);
  }
}
