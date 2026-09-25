import { createClient } from '@supabase/supabase-js';
import type { Env } from './types';
import { apiError, json } from './types';
import { getAuthenticatedUserId } from './auth';

const PRODUCT = 'search_creator_api';

/**
 * GET /api/creator-api-subscription/debug
 *
 * A small, authenticated-owner-only diagnostic for verifying the Search
 * Creator API flow is wired up — never returns secrets, price ID values,
 * API keys, or any other user's data.
 */
export async function handleCreatorApiDebug(request: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return apiError('UNAUTHENTICATED', 'Sign in required.', 401);

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const [{ data: sub }, { count: apiKeyCount }] = await Promise.all([
    supabase
      .from('api_subscriptions')
      .select('status')
      .eq('user_id', userId)
      .eq('product', PRODUCT)
      .maybeSingle(),
    supabase
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active'),
  ]);

  return json({
    success: true,
    data: {
      priceConfigured: Boolean(env.CREATOR_API_PRICE_ID),
      subscriptionStatus: sub?.status ?? 'none',
      apiKeyCount: apiKeyCount ?? 0,
      creatorDataConnected: Boolean(env.KALODATA_API_KEY),
      rateLimitKvBound: Boolean(env.API_RATE_LIMIT),
    },
  });
}
