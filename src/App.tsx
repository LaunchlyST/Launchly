import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Settings, LogOut, Bot } from 'lucide-react';
import { SettingsPanel } from './pages/inside/SettingsPanel';
import { GeneratorPage } from './pages/inside/GeneratorPage';
import { BotsPage } from './pages/bots/BotsPage';
import { MonitorControlPage } from './pages/monitor/MonitorControlPage';
import { MonitorControlIcon } from './pages/monitor/MonitorControlIcon';
import { SubscriptionGate } from './subscription/SubscriptionGate';
import { PaywallPage } from './pages/paywall/PaywallPage';
import { AmbientScene } from './pages/inside/AmbientScene';
import { useSubscription } from './useSubscription';
import { Loader, Tooltip } from './ui';
import { useStore } from './store';
import { useAuthStore } from './auth-store';
import { supabaseConfigured } from './lib/supabase';
import { Login } from './pages/get-in/Login';
import { SignUp } from './pages/get-in/SignUp';
import './App.css';

/**
 * The pages, by name. The old paths stay as aliases so existing links — and
 * the Stripe success/cancel URLs configured in the worker — keep working.
 */
const PAGES = {
  getIn: '/get-in',
  paywall: '/paywall',
  inside: '/inside',
  bots: '/bots',
  monitorControl: '/monitor-control',
} as const;

const TITLES: Record<string, string> = {
  [PAGES.getIn]: 'Get in — Launchly',
  '/signup': 'Get in — Launchly',
  [PAGES.paywall]: 'Paywall — Launchly',
  [PAGES.inside]: 'Inside — Launchly',
  [PAGES.bots]: 'Bots — Launchly',
  [PAGES.monitorControl]: 'Monitor Control — Launchly',
  '/': 'Launchly',
};

function getRoutePath() {
  const path = window.location.pathname;
  if (path === '/signup') return '/signup';
  if (path === PAGES.getIn) return PAGES.getIn;
  /* A return from Stripe is always handled by the Paywall page, wherever the
     worker's success/cancel URL happens to point. */
  if (new URLSearchParams(window.location.search).has('subscription')) return PAGES.paywall;
  /* '/pricing' and '/dashboard' are the old names, kept as aliases. */
  if (path === PAGES.paywall || path === '/pricing') return PAGES.paywall;
  if (path === PAGES.inside || path === '/dashboard') return PAGES.inside;
  if (path === PAGES.bots) return PAGES.bots;
  if (path === PAGES.monitorControl) return PAGES.monitorControl;
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

  /* Each page carries its own name, and an alias URL is rewritten to it so the
     address bar agrees with the title. */
  useEffect(() => {
    document.title = TITLES[route] ?? 'Launchly';
    const path = window.location.pathname;
    if (path !== route && (path === '/pricing' || path === '/dashboard')) {
      window.history.replaceState({}, '', route + window.location.search);
    }
  }, [route]);

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
      navigate(PAGES.inside);
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

  /* Built without Supabase keys: nobody can sign in, so say that plainly
     rather than showing a login form that cannot work. */
  if (!supabaseConfigured) {
    return (
      <div className="app app--auth">
        <main className="app__main">
          <div className="app__notice">
            <h1>Sign-in is not available</h1>
            <p>
              This build of Launchly went out without its Supabase keys, so accounts
              can&rsquo;t be created or used. Set <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> for the build, then deploy again.
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* Get in: log in or sign up, on /get-in, /signup and the home route. */
  if (route === '/signup') {
    return (
      <div className="app app--auth">
        <main className="app__main">
          <SignUp onSwitchToLogin={() => navigate(PAGES.getIn)} />
        </main>
      </div>
    );
  }

  if (route === PAGES.getIn) {
    if (user) {
      return (
        <div className="auth-loading">
          <Loader size="lg" />
        </div>
      );
    }
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

  if (route === PAGES.paywall) {
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
              onClick={() => navigate(PAGES.inside)}
              aria-label="Create"
            >
              <Sparkles size={20} />
            </button>
          </Tooltip>
          <Tooltip text="Bots">
            <button
              className="app__rail-btn"
              onClick={() => navigate(PAGES.bots)}
              aria-label="Bots"
            >
              <Bot size={20} />
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
          <PaywallPage
            onBackToEditor={() => navigate(PAGES.inside)}
            onSubscribed={() => navigate(PAGES.inside)}
          />
        </main>
      </div>
    );
  }

  /* Monitor Control: same shell and gate as Bots and the editor. */
  if (route === PAGES.monitorControl) {
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
                className="app__rail-btn"
                onClick={() => navigate(PAGES.inside)}
                aria-label="Create"
              >
                <Sparkles size={20} />
              </button>
            </Tooltip>
            <Tooltip text="Bots">
              <button
                className="app__rail-btn"
                onClick={() => navigate(PAGES.bots)}
                aria-label="Bots"
              >
                <Bot size={20} />
              </button>
            </Tooltip>
            <Tooltip text="Monitor Control">
              <button className="app__rail-btn is-active" aria-label="Monitor Control">
                <MonitorControlIcon size={20} />
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
            <MonitorControlPage />
          </main>
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </SubscriptionGate>
    );
  }

  /* Bots: behind the same sign-in and subscription gate as the editor, and
     wearing the same shell, so it reads as one more room in the app. */
  if (route === PAGES.bots) {
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
                className="app__rail-btn"
                onClick={() => navigate(PAGES.inside)}
                aria-label="Create"
              >
                <Sparkles size={20} />
              </button>
            </Tooltip>
            <Tooltip text="Bots">
              <button className="app__rail-btn is-active" aria-label="Bots">
                <Bot size={20} />
              </button>
            </Tooltip>
            <Tooltip text="Monitor Control">
              <button
                className="app__rail-btn"
                onClick={() => navigate(PAGES.monitorControl)}
                aria-label="Monitor Control"
              >
                <MonitorControlIcon size={20} />
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
            <BotsPage />
          </main>
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </SubscriptionGate>
    );
  }

  if (route === PAGES.inside) {
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
            <Tooltip text="Bots">
              <button
                className="app__rail-btn"
                onClick={() => navigate(PAGES.bots)}
                aria-label="Bots"
              >
                <Bot size={20} />
              </button>
            </Tooltip>
            <Tooltip text="Monitor Control">
              <button
                className="app__rail-btn"
                onClick={() => navigate(PAGES.monitorControl)}
                aria-label="Monitor Control"
              >
                <MonitorControlIcon size={20} />
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

  /* Anything else lands on Get in rather than a spinner, so no URL is a dead
     end for someone trying to reach the app. */
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
