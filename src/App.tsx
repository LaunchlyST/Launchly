import React, { useState, useEffect } from 'react';
import { Sparkles, Settings, LogOut } from 'lucide-react';
import { SettingsPanel } from './settings/SettingsPanel';
import { GeneratorPage } from './generator/GeneratorPage';
import { useStore } from './store';
import { useAuthStore } from './auth-store';
import { Login } from './Login';
import { SignUp } from './SignUp';
import './App.css';

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const openaiKey = useStore((s) => s.openaiKey);
  const grokKey = useStore((s) => s.grokKey);
  const hasAnyKey = openaiKey.length > 0 || grokKey.length > 0;

  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleLogout = async () => {
    setLoggingOut(true);
    const { error } = await signOut();
    setLoggingOut(false);
    if (error) {
      setAuthError(error.message);
    }
  };

  console.log('[App] user:', user, 'loading:', loading);

  if (loading) {
    console.log('[App] still loading');
    return (
      <div className="auth-loading">
        <span className="auth-spinner auth-spinner--lg" />
      </div>
    );
  }

  if (!user) {
    console.log('[App] not authenticated, showing auth screen');
    return (
      <div className="app app--auth">
        <main className="app__main">
          {authView === 'login' ? (
            <Login onSwitchToSignUp={() => setAuthView('signup')} />
          ) : (
            <SignUp onSwitchToLogin={() => setAuthView('login')} />
          )}
          {authError && <div className="auth-global-error">{authError}</div>}
        </main>
      </div>
    );
  }

  console.log('[App] authenticated, showing dashboard. user:', user.email);
  return (
    <div className="app">
      <aside className="app__rail">
        <div className="app__brand" title="TikTok Shop Creator">
          <Sparkles size={22} strokeWidth={2.2} />
        </div>

        <div className="app__rail-divider" />

        <button
          className={`app__rail-btn ${!settingsOpen ? 'is-active' : ''}`}
          title="Create"
          aria-label="Create"
        >
          <Sparkles size={20} />
        </button>

        <div className="app__rail-spacer" />

        <button
          className="app__rail-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings — Manage API keys"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>

        <div className="app__rail-status">
          <span
            className={`app__rail-dot ${hasAnyKey ? 'is-active' : ''}`}
            title={hasAnyKey ? 'Models connected' : 'No API keys connected'}
          />
        </div>

        <button
          className="app__rail-btn"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut size={20} />
        </button>
      </aside>

      <main className="app__main">
        <GeneratorPage />
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
