import { createClient } from '@supabase/supabase-js';
import type { Env } from './types';

/**
 * Verify the calling Launchly user from a Supabase access token, rather than
 * trusting a client-supplied userId. Used by every new Search Creator API
 * management route (checkout, status, key create/list/revoke) — none of them
 * accept a userId in the request body.
 */
export async function getAuthenticatedUserId(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}
