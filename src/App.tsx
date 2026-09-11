import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Settings, LogOut } from 'lucide-react';
import { SettingsPanel } from './settings/SettingsPanel';
import { SubscriptionGate } from './subscription/SubscriptionGate';
import { useSubscription } from './useSubscription';
import { useStore } from './store';
import { useAuthStore } from './auth-store';
import { FrontPage } from './pages/front-page/page';
import { Login } from './pages/login/page';
import { InsidePage } from './pages/inside/page';
import { SignUp } from './pages/signup/page';
import { GeneratorPage } from './pages/dashboard/page';
import { PricingPage } from './pages/pricing/page';
import { OwnTrainModelPage } from './pages/own-train-model/page';
import './App.css';

function getRoutePath() {
  const path = window.location.pathname;
  if (path === '/signup') return '/signup';
  if (path === '/pricing') return '/pricing';
  if (path === '/paywall') return '/paywall';
  if (path === '/inside') return '/inside';
  if (path === '/own-train-model') return '/own-train-model';
  if (path === '/front-page') return '/front-page';
  if (path === '/dashboard') return '/dashboard';
  if (path === '/login') return '/login';
  return '/';
}

function RedirectTo({ path }: { path: string }) {
  useEffect(() => {
    window.history.replaceState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [path]);

  return (
    <div className="auth-loading">
      <span className="auth-spinner auth-spinner--lg" />
    </div>
  );
}

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openaiKey = useStore((s) => s.openaiKey);
  const grokKey = useStore((s) => s.grokKey);
  const hasAnyKey = openaiKey.length > 0 || grokKey.length > 0;

  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);
  const [loggingOut, setLoggingOut] = useState(false);

  const [route, setRoute] = useState(getRoutePath);

  // Subscription check for route protection
  const { isActive, loading: subLoading } = useSubscription();

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

  // Combined loading: auth loading OR subscription loading (when user exists)
  const isLoading = authLoading || (user && subLoading);

  if (isLoading) {
    return (
      <div className="auth-loading">
        <span className="auth-spinner auth-spinner--lg" />
      </div>
    );
  }

  if (route === '/' && user) {
    return <RedirectTo path={isActive ? '/dashboard' : '/paywall'} />;
  }

  if (route === '/login') {
    return (
      <div className="app app--auth">
        <main className="app__main">
          <Login onSwitchToSignUp={() => navigate('/signup')} />
        </main>
      </div>
    );
  }

  if (route === '/signup') {
    return (
      <div className="app app--auth">
        <main className="app__main">
          <SignUp onSwitchToLogin={() => navigate('/login')} />
        </main>
      </div>
    );
  }

  if (route === '/pricing') {
    return (
      <div className="app app--inside">
        <main className="app__main">
          <PricingPage />
        </main>
      </div>
    );
  }

  if (route === '/inside') {
    return (
      <div className="app app--inside">
        <main className="app__main">
          <InsidePage />
        </main>
      </div>
    );
  }

  if (route === '/own-train-model') {
    return (
      <div className="app app--inside">
        <main className="app__main">
          <OwnTrainModelPage />
        </main>
      </div>
    );
  }

  if (route === '/front-page') {
    return (
      <div className="app app--inside">
        <main className="app__main">
          <FrontPage />
        </main>
      </div>
    );
  }

  if (route === '/paywall') {
    return (
      <div className="app app--inside">
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

    const subscriptionResult = new URLSearchParams(window.location.search).get('subscription');

    if (!isActive && subscriptionResult !== 'success') {
      return <RedirectTo path="/paywall" />;
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
            title="Settings â€” Manage API keys"
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
    if (route === '/') {
      return (
        <div className="app app--inside">
          <main className="app__main">
            <FrontPage />
          </main>
        </div>
      );
    }
    return (
      <div className="app app--auth">
        <main className="app__main">
          <Login onSwitchToSignUp={() => navigate('/signup')} />
        </main>
      </div>
    );
  }

  // Fallback (should not reach here)
  return (
    <div className="auth-loading">
      <span className="auth-spinner auth-spinner--lg" />
    </div>
  );
}
