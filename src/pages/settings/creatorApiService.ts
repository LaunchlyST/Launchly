import { WORKER_URL } from '../../useSubscription';

/**
 * Frontend gateway to the Search Creator API's own management routes
 * (subscription + key management). Every call here is authenticated with
 * the signed-in user's real Supabase access token — never a client-trusted
 * userId — so the worker can verify who is actually asking.
 */

export class CreatorApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'CreatorApiError';
  }
}

async function authedFetch(path: string, accessToken: string, init?: RequestInit) {
  if (!WORKER_URL) {
    throw new CreatorApiError('The Launchly backend is not configured (VITE_WORKER_URL).');
  }
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    });
  } catch {
    throw new CreatorApiError('Could not reach the Launchly backend.');
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }

  if (!res.ok || data?.success === false) {
    throw new CreatorApiError(
      data?.error?.message || `Request failed (HTTP ${res.status}).`,
      data?.error?.code
    );
  }
  return data;
}

export type CreatorApiSubStatus =
  | 'none'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired';

export interface CreatorApiSubscription {
  product: 'search_creator_api';
  status: CreatorApiSubStatus;
  active: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export async function getCreatorApiStatus(accessToken: string): Promise<CreatorApiSubscription> {
  const res = await authedFetch('/api/creator-api-subscription/status', accessToken);
  return res.data;
}

export async function startCreatorApiCheckout(accessToken: string): Promise<string> {
  const res = await authedFetch('/api/creator-api-subscription/checkout', accessToken, { method: 'POST' });
  return res.data.url;
}

export async function openCreatorApiPortal(accessToken: string): Promise<string> {
  const res = await authedFetch('/api/creator-api-subscription/manage', accessToken, { method: 'POST' });
  return res.data.url;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  scope: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiKeyCreated extends ApiKeySummary {
  apiKey: string;
}

export async function listApiKeys(accessToken: string): Promise<ApiKeySummary[]> {
  const res = await authedFetch('/api/developer/api-keys', accessToken);
  return res.data;
}

export async function createApiKey(accessToken: string, name: string): Promise<ApiKeyCreated> {
  const res = await authedFetch('/api/developer/api-keys', accessToken, {
    method: 'POST',
    body: JSON.stringify({ scope: 'search_creator_api', name }),
  });
  return res.data;
}

export async function revokeApiKey(accessToken: string, id: string): Promise<void> {
  await authedFetch(`/api/developer/api-keys/${id}/revoke`, accessToken, { method: 'POST' });
}

export interface ApiUsageSummary {
  requestsToday: number;
  requestsThisMonth: number;
  lastRequestAt: string | null;
}

export async function getApiUsage(accessToken: string): Promise<ApiUsageSummary> {
  const res = await authedFetch('/api/developer/api-usage', accessToken);
  return res.data;
}
