import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { STORE_THEMES, loadState, money, slugifyHandle, type CreatorStoreState } from './store';
import './creator-store.css';

export function StorefrontPage() {
  const [state, setState] = useState<CreatorStoreState | null>(null);

  useEffect(() => {
    setState(loadState());
    const onPop = () => setState(loadState());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handle = slugifyHandle(window.location.pathname.replace(/^\/s\//, '') || '');
  const profile = state?.profile;
  const theme = STORE_THEMES.find((t) => t.id === profile?.theme) ?? STORE_THEMES[0];
  const match = profile && slugifyHandle(profile.handle) === handle;
  const products = (match ? state?.products ?? [] : []).filter((p) => p.active);

  useEffect(() => {
    document.title = profile && match ? `${profile.displayName} — Launchly Store` : 'Creator Store — Launchly';
  }, [profile, match]);

  if (!state) return <div className="auth-loading"><span className="auth-spinner auth-spinner--lg" /></div>;

  return (
    <div className="cs-public">
      <div className="cs-phone cs-phone--public" style={{ ['--cs-from' as string]: theme.from, ['--cs-to' as string]: theme.to }}>
        <div className="cs-phone__notch" />
        {!match ? (
          <div className="cs-phone__hero">
            <ShoppingBag size={22} aria-hidden />
            <strong>Store not found on this device</strong>
            <p>This demo store lives in the browser where it was created. Open your Creator Store dashboard to share it.</p>
            <a className="cs-btn cs-btn--primary" href="/dashboard?section=creator-store">Open Creator Store</a>
          </div>
        ) : (
          <>
            <div className="cs-phone__hero">
              <span className="cs-avatar">{(profile!.displayName || 'S').charAt(0).toUpperCase()}</span>
              <strong>{profile!.displayName}</strong>
              <small>@{slugifyHandle(profile!.handle)}</small>
              <p>{profile!.bio}</p>
            </div>
            <div className="cs-phone__links">
              {products.length === 0 && <p className="cs-hint">No live products yet — check back soon.</p>}
              {products.map((p) => (
                <div key={p.id} className="cs-phone__item">
                  <div>
                    <strong>{p.name}</strong>
                    <small>{money(p.price, profile!.currency)} · {p.kind === 'digital' ? 'Digital download' : 'Custom'}</small>
                    {p.description && <small>{p.description}</small>}
                  </div>
                  {profile!.paymentHandle && profile!.paymentProvider !== 'manual' ? (
                    <a className="cs-buy" href={profile!.paymentHandle} target="_blank" rel="noreferrer">Buy</a>
                  ) : (
                    <span className="cs-buy cs-buy--static">{money(p.price, profile!.currency)}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="cs-phone__pay">
              <small>Powered by Launchly Creator Store</small>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
