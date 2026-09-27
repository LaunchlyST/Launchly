/**
 * Base URL of the Launchly backend Worker (subscriptions, Monitor, Local
 * businesses, Creator API). Set VITE_WORKER_URL to override; otherwise
 * production uses the deployed backend and dev uses a local `wrangler dev`.
 * This is a public URL, not a secret.
 */
export const DEFAULT_WORKER_URL = 'https://launchly-subscription-worker.pazeruga.workers.dev';

export const WORKER_URL: string = (
  import.meta.env.VITE_WORKER_URL || (import.meta.env.DEV ? 'http://localhost:8787' : DEFAULT_WORKER_URL)
).replace(/\/+$/, '');
