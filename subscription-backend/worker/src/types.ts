export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  FRONTEND_URL: string;
  STRIPE_PRICE_ID: string;

  /** Price ID for the separate "Launchly Search Creator API" £5/mo product. */
  CREATOR_API_PRICE_ID: string;

  /** Server-side only — the real upstream creator-data provider (Kalodata). */
  KALODATA_API_KEY: string;
  /** Optional override; defaults to https://api.kalodata.com in kalodataClient.ts. */
  KALODATA_API_BASE_URL?: string;

  /**
   * Optional KV namespace for the Creator Search API's per-key rate limit.
   * Without it, rate limiting is skipped (fails open) rather than blocking
   * real traffic on missing infrastructure — see README for the binding to add.
   */
  API_RATE_LIMIT?: KVNamespace;
}

export function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export function apiError(code: string, message: string, status: number): Response {
  return json({ success: false, error: { code, message } }, status);
}
