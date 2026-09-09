import { createClient } from '@supabase/supabase-js';

/**
 * The Supabase client.
 *
 * These values are baked in at build time. If the build ran without them this
 * module used to throw on import, which took the whole app down to a blank
 * page — no login, no sign-up, no error. It now reports the problem instead,
 * so the app still renders and can say what is wrong.
 *
 * The key is read under either of the two names in common use.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when the app was built without Supabase credentials. */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY at build time. ' +
      'Signing in and signing up cannot work until the build provides them.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://unconfigured.supabase.co',
  supabaseAnonKey || 'unconfigured',
  {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
