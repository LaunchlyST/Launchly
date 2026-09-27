import { WORKER_URL } from '../../useSubscription';

export type ProviderId = 'openai' | 'grok' | 'claude';

export class ProviderTestError extends Error {}

/**
 * Test that a saved API key actually works.
 *
 * There is no backend endpoint for this yet for any provider — testing a key
 * from the browser directly against OpenAI/xAI/Anthropic would mean sending
 * it straight to a third party with no server in between, which is not how
 * Launchly is built to handle keys. So this calls the one worker Launchly
 * already has, at a route it does not implement yet, and surfaces the real
 * failure rather than inventing a result. Once the worker adds
 * POST /api/test-provider-key, this starts working without any change here.
 */
export async function testProviderKey(provider: ProviderId, apiKey: string): Promise<void> {
  if (!apiKey.trim()) throw new ProviderTestError('Enter a key first.');
  if (!WORKER_URL) {
    throw new ProviderTestError('Key testing needs the Launchly backend, which is not configured.');
  }

  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}/api/test-provider-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey }),
    });
  } catch {
    throw new ProviderTestError('Could not reach the Launchly backend to test this key.');
  }

  if (res.status === 404) {
    throw new ProviderTestError('Key testing is not available yet — this endpoint has not shipped.');
  }
  if (!res.ok) {
    let message = `Test failed (HTTP ${res.status}).`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* not JSON — keep the generic message */
    }
    throw new ProviderTestError(message);
  }
}
