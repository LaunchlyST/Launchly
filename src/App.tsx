import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Settings, LogOut, Crown } from 'lucide-react';
import { SettingsPanel } from './settings/SettingsPanel';
import { GeneratorPage } from './generator/GeneratorPage';
import { SubscriptionGate } from './subscription/SubscriptionGate';
import { useSubscription } from './useSubscription';
import { useStore } from './store';
import { useAuthStore } from './auth-store';
import { Login } from './Login';
import { SignUp } from './SignUp';
import './App.css';

function PricingPage() {
  const { createCheckout } = useSubscription();

  return (
    <div className="sub-gate">
      <div className="sub-gate__icon">
        <Crown size={48} />
      </div>
      <h2 className="sub-gate__title">Pro Subscription Required</h2>
      <p className="sub-gate__desc">
        Unlock the full editor with all features. Only £5/month.
      </p>
      <button onClick={createCheckout} className="sub-gate__btn">
        Subscribe Now — £5/month
      </button>
    </div>
  );
}

function getRoutePath() {
  const path = window.location.pathname;
  if (path === '/signup') return '/signup';
  if (path === '/pricing') return '/pricing';
  if (path === '/dashboard') return '/dashboard';
  return '/';
}

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

  const [route, setRoute] = useState(getRoutePath);

  const handlePopState = useCallback(() => {
    setRoute(getRoutePath());
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setRoute(getRoutePath());
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    setLoggingOut(false);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="auth-loading">
        <span className="auth-spinner auth-spinner--lg" />
      </div>
    );
  }

  if (route === '/signup') {
    return (
      <div className="app app--auth">
        <main className="app__main">
          <SignUp onSwitchToLogin={() => navigate('/')} />
        </main>
      </div>
    );
  }

  if (route === '/pricing') {
    if (!user) {
      return (
        <div className="app app--auth">
          <main className="app__main">
            <Login onSwitchToSignUp={() => navigate('/signup')} />
          </main>
        </div>
      );
    }
    return (
      <div className="app">
        <aside className="app__rail">
          <div className="app__brand" title="Launchly">
            <Sparkles size={22} strokeWidth={2.2} />
          </div>
          <div className="app__rail-divider" />
          <button
            className="app__rail-btn"
            onClick={() => navigate('/dashboard')}
            title="Create"
            aria-label="Create"
          >
            <Sparkles size={20} />
          </button>
          <div className="app__rail-spacer" />
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
          <PricingPage />
        </main>
      </div>
    );
  }

  if (route === '/dashboard') {
    if (!user) {
      return (
        <div className="app app--auth">
          <main className="app__main">
            <Login onSwitchToSignUp={() => navigate('/signup')} />
          </main>
        </div>
      );
    }
    return (
      <div className="app">
        <aside className="app__rail">
          <div className="app__brand" title="Launchly">
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
          <SubscriptionGate>
            <GeneratorPage />
          </SubscriptionGate>
        </main>
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app app--auth">
        <main className="app__main">
          {authView === 'login' ? (
            <Login onSwitchToSignUp={() => setAuthView('signup')} />
          ) : (
            <SignUp onSwitchToLogin={() => setAuthView('login')} />
          )}
        </main>
      </div>
    );
  }

  navigate('/dashboard');
  return (
    <div className="auth-loading">
      <span className="auth-spinner auth-spinner--lg" />
    </div>
  );
}
