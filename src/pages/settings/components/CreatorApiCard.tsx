import React, { useCallback, useEffect, useState } from 'react';
import { Lock, ShieldCheck, AlertTriangle, ExternalLink, Plus, Search, Check } from 'lucide-react';
import { useAuthStore } from '../../../auth-store';
import { WORKER_URL } from '../../../useSubscription';
import {
  CreatorApiError,
  createApiKey,
  getApiUsage,
  getCreatorApiStatus,
  listApiKeys,
  openCreatorApiPortal,
  revokeApiKey,
  searchCreatorsInApp,
  startCreatorApiCheckout,
  type ApiKeySummary,
  type ApiUsageSummary,
  type CreatorApiSubscription,
  type CreatorSearchResult,
} from '../creatorApiService';
import { ConfirmationModal } from './ConfirmationModal';
import { ApiKeyCreatedModal } from './ApiKeyCreatedModal';

const FEATURES = [
  'Search creators by TikTok username',
  'Real creator data',
  'API key access',
  'Use from your own website/app',
  'Developer endpoint access',
];

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

export function CreatorApiCard() {
  const session = useAuthStore((s) => s.session);
  const accessToken = session?.access_token ?? null;

  const [status, setStatus] = useState<CreatorApiSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeySummary | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [usage, setUsage] = useState<ApiUsageSummary | null>(null);
  const [usageError, setUsageError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CreatorSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const refreshStatus = useCallback(async (): Promise<CreatorApiSubscription | null> => {
    if (!accessToken) return null;
    setLoading(true);
    setError(null);
    try {
      const next = await getCreatorApiStatus(accessToken);
      setStatus(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your Search Creator API status.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const refreshKeys = useCallback(async () => {
    if (!accessToken) return;
    setKeysLoading(true);
    try {
      setKeys(await listApiKeys(accessToken));
    } catch {
      /* leave the previous list rather than clearing it on a transient error */
    } finally {
      setKeysLoading(false);
    }
  }, [accessToken]);

  const refreshUsage = useCallback(async () => {
    if (!accessToken) return;
    try {
      setUsage(await getApiUsage(accessToken));
      setUsageError(false);
    } catch {
      setUsageError(true);
    }
  }, [accessToken]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status?.active) {
      refreshKeys();
      refreshUsage();
    }
  }, [status?.active, refreshKeys, refreshUsage]);

  // Coming back from Stripe Checkout — the success query param is only ever
  // used for this one-time UI message; it never unlocks anything by itself.
  // The webhook can take a moment to land, so poll the real status a few
  // times rather than showing "Locked" for a redirect that already paid.
  const [checkoutReturn, setCheckoutReturn] = useState<'success' | 'cancelled' | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('creatorApi');
    if (outcome === 'success' || outcome === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname);
      setCheckoutReturn(outcome);
    }
    if (outcome !== 'success') return;

    let cancelled = false;
    const delays = [0, 1500, 3000, 5000];
    (async () => {
      for (const delay of delays) {
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        const result = await refreshStatus();
        if (result?.active) return;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnlock = async () => {
    if (!accessToken) return;
    setCheckoutLoading(true);
    setError(null);
    try {
      const url = await startCreatorApiCheckout(accessToken);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setCheckoutLoading(false);
    }
  };

  const handleManage = async () => {
    if (!accessToken) return;
    setPortalLoading(true);
    try {
      const url = await openCreatorApiPortal(accessToken);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing management.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!accessToken) return;
    setCreatingKey(true);
    setError(null);
    try {
      const created = await createApiKey(accessToken, 'Default API Key');
      setNewKey(created.apiKey);
      await refreshKeys();
    } catch (err) {
      setError(
        err instanceof CreatorApiError && err.code === 'API_SUBSCRIPTION_REQUIRED'
          ? 'An active Search Creator API subscription is required.'
          : err instanceof Error
            ? err.message
            : 'Could not create an API key.'
      );
    } finally {
      setCreatingKey(false);
    }
  };

  const handleSearch = async () => {
    if (!accessToken) return;
    const q = searchQuery.trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '').replace(/^@/, '');
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResults(await searchCreatorsInApp(accessToken, q));
    } catch (err) {
      setSearchResults(null);
      setSearchError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const confirmRevoke = async () => {
    if (!accessToken || !revokeTarget) return;
    setRevoking(true);
    try {
      await revokeApiKey(accessToken, revokeTarget.id);
      setRevokeTarget(null);
      await refreshKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke this key.');
    } finally {
      setRevoking(false);
    }
  };

  const apiHost = WORKER_URL || 'https://YOUR_LAUNCHLY_API_HOST';

  return (
    <div className="stg-card stg-creator-api">
      <div className="stg-card__head">
        <h2 className="stg-card__title">API Access &amp; Billing</h2>
      </div>

      <div className="stg-creator-api__product">
        <div className="stg-creator-api__product-head">
          <div>
            <h3 className="stg-creator-api__name">Search Creator API</h3>
            <p className="stg-creator-api__desc">
              Use Launchly creator search inside your own website, app or business tools.
            </p>
          </div>
          {status?.active ? (
            <span className="stg-badge is-ok">● Active</span>
          ) : (
            <span className="stg-lock-icon">
              <Lock size={16} />
            </span>
          )}
        </div>

        <div className="stg-creator-api__price-row">
          <span className="stg-creator-api__price">£5 / month</span>
          <span className="stg-muted">Unlimited creator searches*</span>
        </div>

        <ul className="stg-creator-api__features">
          {FEATURES.map((f) => (
            <li key={f}>✓ {f}</li>
          ))}
        </ul>

        {checkoutReturn === 'success' && (
          <p className="stg-inline-ok" style={{ marginBottom: 8 }}>
            <Check size={13} />{' '}
            {status?.active ? 'Creator API activated.' : 'Payment received. Activating Creator API…'}
          </p>
        )}

        {loading ? (
          <p className="stg-muted">Checking your subscription…</p>
        ) : !status || status.status === 'none' || status.status === 'canceled' || status.status === 'incomplete_expired' ? (
          <>
            <span className="stg-badge">Locked</span>
            <div className="stg-card__actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
              <button type="button" className="stg-btn stg-btn--primary" onClick={handleUnlock} disabled={checkoutLoading}>
                {checkoutLoading ? 'Opening Stripe…' : 'Unlock API — £5/month'}
              </button>
            </div>
          </>
        ) : status.status === 'past_due' || status.status === 'unpaid' ? (
          <>
            <span className="stg-badge is-warn">Payment issue</span>
            <div className="stg-card__actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
              <button type="button" className="stg-btn stg-btn--ghost" onClick={handleManage} disabled={portalLoading}>
                {portalLoading ? 'Opening…' : 'Manage Billing'}
                <ExternalLink size={13} />
              </button>
            </div>
          </>
        ) : status.active ? (
          <>
            <span className="stg-badge is-ok">
              {status.cancelAtPeriodEnd && status.currentPeriodEnd
                ? `Cancels on ${formatDate(status.currentPeriodEnd)}`
                : 'API Access Unlocked'}
            </span>
            <div className="stg-card__actions" style={{ justifyContent: 'flex-start', marginTop: 12, gap: 10 }}>
              {keys.length === 0 && (
                <button type="button" className="stg-btn stg-btn--primary" onClick={handleCreateKey} disabled={creatingKey}>
                  {creatingKey ? 'Creating…' : 'Create API Key'}
                </button>
              )}
              <button type="button" className="stg-btn stg-btn--ghost" onClick={handleManage} disabled={portalLoading}>
                {portalLoading ? 'Opening…' : 'Manage Subscription'}
                <ExternalLink size={13} />
              </button>
            </div>
          </>
        ) : (
          <span className="stg-badge">Locked</span>
        )}

        {error && (
          <p className="stg-inline-error" style={{ marginTop: 10 }}>
            <AlertTriangle size={13} /> {error}
          </p>
        )}

        <p className="stg-hint" style={{ marginTop: 10 }}>
          *Subject to fair-use and technical rate limits.
        </p>
      </div>

      {status?.active && (
        <>
          <div className="stg-divider" />
          <div className="stg-creator-api__keys">
            <h3 className="stg-card__title">API Keys</h3>
            {keysLoading && keys.length === 0 ? (
              <p className="stg-muted">Loading…</p>
            ) : keys.length === 0 ? (
              <p className="stg-muted">No API keys yet.</p>
            ) : (
              <ul className="stg-key-list">
                {keys.map((k) => (
                  <li key={k.id} className="stg-key-list__row">
                    <div>
                      <p className="stg-key-list__name">{k.name}</p>
                      <p className="stg-key-list__prefix">{k.keyPrefix}••••••••••••</p>
                    </div>
                    <div className="stg-key-list__meta">
                      <span className={`stg-badge ${k.status === 'active' ? 'is-ok' : ''}`}>
                        {k.status === 'active' ? 'Active' : 'Revoked'}
                      </span>
                      <span className="stg-muted">Created {formatDate(k.createdAt)}</span>
                      <span className="stg-muted">
                        Last used {k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never'}
                      </span>
                    </div>
                    {k.status === 'active' && (
                      <button type="button" className="stg-btn stg-btn--danger stg-btn--sm" onClick={() => setRevokeTarget(k)}>
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {keys.length > 0 && keys.every((k) => k.status !== 'active') && (
              <button type="button" className="stg-btn stg-btn--ghost" onClick={handleCreateKey} disabled={creatingKey}>
                <Plus size={14} /> Create New Key
              </button>
            )}
          </div>

          <div className="stg-divider" />
          <div className="stg-creator-api__search">
            <h3 className="stg-card__title">Search Creator</h3>
            <div className="stg-key-row">
              <div className="stg-key-input-wrap" style={{ flex: 1 }}>
                <Search size={15} className="stg-key-input__icon" />
                <input
                  className="stg-key-input"
                  style={{ paddingRight: 12 }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search username or @creator"
                  aria-label="Search username or @creator"
                />
              </div>
              <button type="button" className="stg-btn stg-btn--primary" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                {searching ? 'Searching…' : 'Search Creator'}
              </button>
            </div>

            {searchError && (
              <p className="stg-inline-error" style={{ marginTop: 8 }}>
                <AlertTriangle size={13} /> {searchError}
              </p>
            )}

            {searchResults && (
              <ul className="stg-key-list" style={{ marginTop: 12 }}>
                {searchResults.length === 0 && <p className="stg-muted">No creators found.</p>}
                {searchResults.map((c) => (
                  <li key={c.id} className="stg-creator-result">
                    <div>
                      <p className="stg-key-list__name">{c.displayName ?? c.username ?? '—'}</p>
                      <p className="stg-key-list__prefix">@{c.username || '—'}</p>
                    </div>
                    <div className="stg-creator-result__stats">
                      <span>Followers: {c.followers ?? '—'}</span>
                      <span>Likes: {c.likes ?? '—'}</span>
                      <span>Videos: {c.videoCount ?? '—'}</span>
                      <span>GMV: {c.gmv ?? '—'}</span>
                      <span>Items sold: {c.itemsSold ?? '—'}</span>
                      <span>Products: {c.productCount ?? '—'}</span>
                      <span>Region: {c.region ?? '—'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="stg-divider" />
          <div className="stg-creator-api__usage">
            <h3 className="stg-card__title">Usage</h3>
            {usageError || !usage ? (
              <p className="stg-muted">Usage analytics coming soon.</p>
            ) : (
              <div className="stg-usage-grid">
                <div>
                  <span className="stg-usage-grid__label">Requests today</span>
                  <span className="stg-usage-grid__value">{usage.requestsToday}</span>
                </div>
                <div>
                  <span className="stg-usage-grid__label">Requests this month</span>
                  <span className="stg-usage-grid__value">{usage.requestsThisMonth}</span>
                </div>
                <div>
                  <span className="stg-usage-grid__label">Last request</span>
                  <span className="stg-usage-grid__value">
                    {usage.lastRequestAt ? new Date(usage.lastRequestAt).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="stg-divider" />
          <div className="stg-creator-api__quickstart">
            <h3 className="stg-card__title">Quick Start</h3>
            <p className="stg-hint">
              <ShieldCheck size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Keep your API key on your server. Do not expose it in client-side JavaScript.
            </p>
            <code className="stg-code stg-code--block">GET /api/v1/creators/search</code>
            <p className="stg-hint">
              <strong>q</strong> — TikTok creator username &nbsp;·&nbsp; <strong>region</strong> — Market code, e.g. GB
            </p>
            <pre className="stg-code-block">
              <code>{`curl -X GET \\
"${apiHost}/api/v1/creators/search?q=creatorname&region=GB" \\
-H "Authorization: Bearer YOUR_API_KEY"`}</code>
            </pre>
          </div>
        </>
      )}

      <ApiKeyCreatedModal apiKey={newKey} onDone={() => setNewKey(null)} />

      <ConfirmationModal
        open={!!revokeTarget}
        title="Revoke API key?"
        body="Applications using this key will immediately stop working."
        confirmLabel="Revoke key"
        danger
        busy={revoking}
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
