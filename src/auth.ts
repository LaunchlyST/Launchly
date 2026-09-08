import { supabase } from './lib/supabase';
import { useAuthStore } from './auth-store';

export function initAuth() {
  const setUser = useAuthStore.getState().setUser;
  const setSession = useAuthStore.getState().setSession;
  const setLoading = useAuthStore.getState().setLoading;

  supabase.auth.getSession().then(({ data: { session } }) => {
    console.log('[initAuth] getSession:', session ? 'has session' : 'no session');
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      console.log('[onAuthStateChange]', event, session ? 'has session' : 'no session');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  );

  return subscription;
}
