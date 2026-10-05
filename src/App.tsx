import React, { useState, useEffect, useCallback } from 'react';
import { SettingsPanel } from './settings/SettingsPanel';
import { useSubscription } from './useSubscription';

import { useAuthStore } from './auth-store';
import { FrontPage } from './pages/front-page/page';
import { InsidePage } from './pages/inside/page';
import { ResearchDashboard } from './pages/dashboard/page';
import { PricingPage } from './pages/pricing/page';
import { GetInPage } from './pages/get-in/page';
import { OwnTrainModelPage } from './pages/own-train-model/page';
import './App.css';



function getRoutePath() {
  const path = window.location.pathname;
  if (path === '/get-in') return '/get-in';
  if (path === '/pricing') return '/pricing';
  if (path === '/paywall') return '/paywall';
  if (path === '/inside') return '/inside';
  if (path === '/own-train-model') return '/own-train-model';
  if (path === '/front-page') return '/front-page';
  if (/^\/creator\/\d{1,30}$/.test(path)) return '/dashboard';
  if (path === '/dashboard' || path === '/business-connect' || path === '/creator-store' || path === '/monitor' || path === '/workflow') return '/dashboard';
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
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);



  const [route, setRoute] = useState(getRoutePath);
  // Subscription check for route protection
  const { loading: subLoading } = useSubscription();

  const handlePopState = useCallback(() => {
    setRoute(getRoutePath());
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  // Combined loading: auth loading OR subscription loading (when user exists)
  const isLoading = authLoading || (user && subLoading);

  // The public intro must remain available even when account services are slow.
  const isFrontPage = route === '/' || route === '/front-page';
  if (isLoading && !isFrontPage) {
    return (
      <div className="auth-loading">
        <span className="auth-spinner auth-spinner--lg" />
      </div>
    );
  }

  // Always show the marketing front page at /
  if (route === '/') {
    return (
      <div className="app app--inside">
        <main className="app__main">
          <FrontPage />
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

  if (route === '/get-in') {
    return (
      <div className="app app--inside">
        <main className="app__main">
          <GetInPage />
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
    return <><ResearchDashboard onSettings={() => setSettingsOpen(true)} profileName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Your workspace'} /><SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} /></>;
  }
  if (!user) {
    return <RedirectTo path="/" />;
  }

  // Fallback (should not reach here)
  return (
    <div className="auth-loading">
      <span className="auth-spinner auth-spinner--lg" />
    </div>
  );
}
