import { create } from 'zustand';
import { supabase } from './lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user: User | null; session: Session | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      const user = data?.user ?? null;
      const session = data?.session ?? null;
      console.log('[signUp] result:', { user, session, error: error?.message });
      if (session && user) {
        set({ session, user, loading: false });
      }
      return { error: error ? error : null, session };
    } catch (err) {
      console.log('[signUp] catch:', err);
      return { error: err instanceof Error ? err : new Error('Unknown error'), session: null };
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      const user = data?.user ?? null;
      const session = data?.session ?? null;
      console.log('[signIn] result:', { user, session, error: error?.message });
      if (session && user) {
        set({ session, user, loading: false });
      } else if (!session) {
        console.log('[signIn] no session returned');
      }
      return { error: error ? error : null, user, session };
    } catch (err) {
      console.log('[signIn] catch:', err);
      return { error: err instanceof Error ? err : new Error('Unknown error'), user: null, session: null };
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      console.log('[signOut] result:', { error: error?.message });
      set({ user: null, session: null, loading: false });
      return { error: error ? error : null };
    } catch (err) {
      console.log('[signOut] catch:', err);
      return { error: err instanceof Error ? err : new Error('Unknown error') };
    }
  },

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  clearError: () => set({ error: null }),
}));
