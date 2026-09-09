import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Settings, LogOut, CheckCircle, XCircle } from 'lucide-react';
import { SettingsPanel } from './settings/SettingsPanel';
import { GeneratorPage } from './generator/GeneratorPage';
import { SubscriptionGate } from './subscription/SubscriptionGate';
import { PricingView } from './pricing/PricingView';
import { AmbientScene } from './paywall/AmbientScene';
import { useSubscription } from './useSubscription';
import { Loader, Toast, Tooltip } from './ui';
import { useStore } from './store';
import { useAuthStore } from './auth-store';
import { Login } from './Login';
import { SignUp } from './SignUp';
import './App.css';

function PricingPage({ onBackToEditor }: { onBackToEditor: () => void }) {
  const { subscription, createCheckout, manageSubscription, checkoutLoading, isActive, loading, refresh } =
    useSubscription();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Handle post-checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscription = params.get("subscription");

    if (subscription === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      setToast({ type: "success", message: "Activating your subscription..." });

      let attempts = 0;
      const maxAttempts = 15;
      const poll = setInterval(async () => {
        attempts++;
        await refresh();
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setToast({ type: "success", message: "Pro activated!" });
          setTimeout(() => setToast(null), 4000);
        }
      }, 2000);

      return () => clearInterval(poll);
    }

    if (subscription === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
      setToast({ type: "error", message: "Checkout cancelled." });
      setTimeout(() => setToast(null), 4000);
    }
  }, [refresh]);

  useEffect(() => {
    if (isActive && toast?.message === "Activating your subscription...") {
      setToast({ type: "success", message: "Pro activated!" });
      setTimeout(() => setToast(null), 4000);
    }
  }, [isActive, toast]);

  if (loading) {
    return (
      <div className="auth-loading">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <>
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          icon={toast.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
        />
      )}
      <PricingView
        isActive={isActive}
        busy={checkoutLoading}
        renewsOn={subscription?.subscription_current_period_end ?? null}
        onUnlock={createCheckout}
        onManage={manageSubscription}
        onBack={onBackToEditor}
      />
    </>
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
  const authLoading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);
  const [loggingOut, setLoggingOut] = useState(false);

  const [route, setRoute] = useState(getRoutePath);

  // Only used to hold the first paint until entitlement is known, so neither
  // the editor nor the paywall flashes. The gate itself decides what renders.
  const { loading: subLoading } = useSubscription();

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

  // Home route (/): declared here, above every early return, so the hook count
  // is identical on every render. Placing it lower made React see a different
  // number of hooks once the loading branch stopped returning early.
  useEffect(() => {
    if (!authLoading && user && route === '/') {
      navigate('/dashboard');
    }
  }, [user, authLoading, route, navigate]);

  // Combined loading: auth loading OR subscription loading (when user exists)
  const isLoading = authLoading || (user && subLoading);

  if (isLoading) {
    return (
      <div className="auth-loading">
        <Loader size="lg" />
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
          <Tooltip text="Create">
            <button
              className="app__rail-btn"
              onClick={() => navigate('/dashboard')}
              aria-label="Create"
            >
              <Sparkles size={20} />
            </button>
          </Tooltip>
          <div className="app__rail-spacer" />
          <Tooltip text="Sign out">
            <button
              className="app__rail-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </Tooltip>
        </aside>
        <main className="app__main">
          <PricingPage onBackToEditor={() => navigate('/dashboard')} />
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

    // No route-level redirect here: an unpaid user stays on /dashboard and
    // meets the paywall in place, over their own blurred editor.

    /* The gate wraps the whole shell, not just the canvas: an unpaid user sees
       the paywall alone, with no rail and no space reserved for one. The paid
       tree inside is unchanged. */
    return (
      <SubscriptionGate>
        <div className="app">
          <aside className="app__rail">
            <div className="app__brand" title="Launchly">
              <Sparkles size={22} strokeWidth={2.2} />
            </div>
            <div className="app__rail-divider" />
            <Tooltip text="Create">
              <button
                className={`app__rail-btn ${!settingsOpen ? 'is-active' : ''}`}
                aria-label="Create"
              >
                <Sparkles size={20} />
              </button>
            </Tooltip>
            <div className="app__rail-spacer" />
            <Tooltip text="Settings — manage API keys">
              <button
                className="app__rail-btn"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
              >
                <Settings size={20} />
              </button>
            </Tooltip>
            <div className="app__rail-status">
              <span
                className={`app__rail-dot ${hasAnyKey ? 'is-active' : ''}`}
                title={hasAnyKey ? 'Models connected' : 'No API keys connected'}
              />
            </div>
            <Tooltip text="Sign out">
              <button
                className="app__rail-btn"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </Tooltip>
          </aside>
          <main className="app__main">
            <AmbientScene />
            <GeneratorPage />
          </main>
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </SubscriptionGate>
    );
  }

  // Home route (/) — the redirect effect for this route is declared above, with
  // the other hooks.
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

  // Fallback (should not reach here)
  return (
    <div className="auth-loading">
      <Loader size="lg" />
    </div>
  );
}
