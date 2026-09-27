import { supabase } from '../../lib/supabase';
import { WORKER_URL } from '../../useSubscription';

/** Update the signed-in user's display name via Supabase Auth user metadata. */
export async function updateDisplayName(displayName: string) {
  const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
  if (error) throw error;
}

/** Change the signed-in user's password directly (they're already authenticated). */
export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Send a password-reset email through Supabase's own flow. */
export async function sendPasswordResetEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export class AccountServiceError extends Error {}

/**
 * Permanently delete the signed-in user's account.
 *
 * Supabase's browser SDK has no self-service "delete my account" call — that
 * needs the service-role key, which only the subscription worker holds, and
 * the worker does not expose this route yet. This calls it anyway so the
 * button is wired to something real: today it fails honestly instead of
 * pretending to succeed.
 */
export async function deleteAccount(userId: string) {
  if (!WORKER_URL) {
    throw new AccountServiceError('Account deletion needs the Launchly backend, which is not configured.');
  }
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}/api/account/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch {
    throw new AccountServiceError('Could not reach the Launchly backend.');
  }
  if (res.status === 404) {
    throw new AccountServiceError(
      'Account deletion is not available yet — this needs a backend route Launchly has not built.'
    );
  }
  if (!res.ok) {
    throw new AccountServiceError(`Account deletion failed (HTTP ${res.status}).`);
  }
}
