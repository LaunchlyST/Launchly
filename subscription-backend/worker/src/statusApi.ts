import type { Env } from './types';
import { json } from './types';

/**
 * GET /api/v1/status
 *
 * Unauthenticated, public health check for the Creator API — safe for
 * anyone to call. Never returns keys, price IDs, or any secret.
 */
export async function handleStatus(env: Env): Promise<Response> {
  // No third-party creator-data key to check today (Launchly's own public
  // TikTok collector needs none) — this only reflects whether the worker
  // has what it needs to serve billing/auth, since a real search would fail
  // without those regardless of collector health.
  const databaseConnected = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const billingConfigured = Boolean(env.CREATOR_API_PRICE_ID);

  return json({
    service: 'Launchly Creator API',
    status: databaseConnected ? 'online' : 'degraded',
    creatorData: databaseConnected ? 'configured' : 'degraded',
    database: databaseConnected ? 'connected' : 'unavailable',
    billing: billingConfigured ? 'configured' : 'not_configured',
  });
}
