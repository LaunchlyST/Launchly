import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  ShoppingBag,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  CURRENCIES,
  STORE_THEMES,
  defaultState,
  loadState,
  money,
  newId,
  slugifyHandle,
  storeUrl,
  STORAGE_KEY,
  type StoreProduct,
} from './store';
import './creator-store.css';

const KIND_LABEL: Record<StoreProduct['kind'], string> = {
  digital: 'Digital download',
  custom: 'Custom / made to order',
};

const PAYMENT_HINT: Record<string, { label: string; placeholder: string; help: string }> = {
  stripe: {
    label: 'Stripe payment link',
    placeholder: 'https://buy.stripe.com/…',
    help: 'Paste a Stripe Payment Link. Buyers are sent there to pay, then get your delivery URL.',
  },
  paypal: {
    label: 'PayPal.me link',
    placeholder: 'https://paypal.me/yourhandle/19',
    help: 'Paste your PayPal.me link. Works for digital and custom products.',
  },
  manual: {
    label: 'Manual instructions',
    placeholder: 'DM me on TikTok to pay…',
    help: 'No provider needed — buyers see these instructions at checkout.',
  },
};

export function CreatorStorePage() {
  const [profile, setProfile] = useState(defaultState.profile);
  const [products, setProducts] = useState<StoreProduct[]>(defaultState.products);
  const [orders, setOrders] = useState(defaultState.orders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StoreProduct | null>(null);
  const [copied, setCopied] = useState(false);
  const [buyer, setBuyer] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const initial = loadState();
    setProfile(initial.profile);
    setProducts(initial.products);
    setOrders(initial.orders);
    document.title = 'Creator Store — Launchly';
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, products, orders }));
    } catch {
      /* storage unavailable — session-only */
    }
  }, [profile, products, orders]);

  const url = useMemo(() => storeUrl(profile.handle), [profile.handle]);
  const theme = STORE_THEMES.find((t) => t.id === profile.theme) ?? STORE_THEMES[0];
  const activeProducts = products.filter((p) => p.active);
  const revenue = orders.reduce((sum, o) => sum + o.amount, 0);

  function startAdd() {
    setEditingId('new');
    setDraft({ id: newId('p'), name: '', price: 15, kind: 'digital', description: '', deliveryUrl: '', active: true });
  }

  function startEdit(p: StoreProduct) {
    setEditingId(p.id);
    setDraft({ ...p });
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setNotice('Give your product a name first.');
      return;
    }
    if (!(draft.price >= 0)) {
      setNotice('Price must be 0 or more.');
      return;
    }
    setProducts((list) => {
      const exists = list.some((p) => p.id === draft.id);
      return exists ? list.map((p) => (p.id === draft.id ? draft : p)) : [draft, ...list];
    });
    setEditingId(null);
    setDraft(null);
    setNotice('');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function checkout(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product || !product.active) return;
    setOrders((list) => [
      {
        id: newId('order'),
        productId: product.id,
        productName: product.name,
        amount: product.price,
        buyer: buyer.trim() || '@fan',
        date: new Date().toISOString(),
      },
      ...list,
    ]);
    setNotice(
      profile.paymentProvider === 'manual'
        ? `Order placed! Send "${profile.paymentHandle || 'your payment instructions'}" to ${buyer.trim() || '@fan'}.`
        : `Checkout started for "${product.name}" — buyer pays via ${profile.paymentProvider === 'stripe' ? 'Stripe' : 'PayPal'}.`
    );
  }

  const paymentMeta = PAYMENT_HINT[profile.paymentProvider];

  return (
    <div className="cs-page">
      <div className="cs-left">
        <header className="cs-header">
          <p className="cs-eyebrow">Link-in-bio storefront</p>
          <h1>Creator Store</h1>
          <p className="cs-subtitle">
            Build your link-in-bio shop, sell digital or custom products, accept payments, and drop the link in your
            TikTok bio.
          </p>
        </header>

        <div className="cs-stats" role="group" aria-label="Store summary">
          <div>
            <strong>{activeProducts.length}</strong>
            <span>Live products</span>
          </div>
          <div>
            <strong>{orders.length}</strong>
            <span>Orders</span>
          </div>
          <div>
            <strong>{money(revenue, profile.currency)}</strong>
            <span>Revenue (demo)</span>
          </div>
        </div>

        <section className="cs-card" aria-label="Storefront settings">
          <div className="cs-card__head">
            <h2>Storefront</h2>
            <p>This is what fans see. Your link updates as you type.</p>
          </div>
          <div className="cs-grid">
            <label className="cs-field">
              <span>Handle</span>
              <div className="cs-handle">
                <span aria-hidden>launchly.store/@</span>
                <input
                  aria-label="Store handle"
                  value={profile.handle}
                  onChange={(e) => setProfile({ ...profile, handle: slugifyHandle(e.target.value) })}
                  placeholder="yourhandle"
                  maxLength={30}
                />
              </div>
            </label>
            <label className="cs-field">
              <span>Display name</span>
              <input
                aria-label="Display name"
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                placeholder="Your Studio"
                maxLength={60}
              />
            </label>
          </div>
          <label className="cs-field">
            <span>Bio</span>
            <textarea
              aria-label="Store bio"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="What do you sell?"
              rows={2}
              maxLength={160}
            />
          </label>
          <div className="cs-grid">
            <label className="cs-field">
              <span>Theme</span>
              <div className="cs-themes" role="group" aria-label="Theme">
                {STORE_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={profile.theme === t.id ? 'is-active' : ''}
                    onClick={() => setProfile({ ...profile, theme: t.id })}
                    title={t.label}
                    aria-pressed={profile.theme === t.id}
                  >
                    <i style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />
                    {t.label}
                  </button>
                ))}
              </div>
            </label>
            <label className="cs-field">
              <span>Currency</span>
              <select
                aria-label="Currency"
                value={profile.currency}
                onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="cs-card" aria-label="Products">
          <div className="cs-card__head cs-card__head--row">
            <div>
              <h2>Products</h2>
              <p>Sell digital downloads or custom, made-to-order offers.</p>
            </div>
            <button type="button" className="cs-btn cs-btn--primary" onClick={startAdd}>
              <Plus size={15} /> Add product
            </button>
          </div>

          {editingId && draft && (
            <div className="cs-editor" role="dialog" aria-label="Product editor">
              <div className="cs-grid">
                <label className="cs-field">
                  <span>Product name</span>
                  <input
                    aria-label="Product name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Viral Hook Pack"
                  />
                </label>
                <div className="cs-grid cs-grid--2">
                  <label className="cs-field">
                    <span>Price ({profile.currency})</span>
                    <input
                      aria-label="Product price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                    />
                  </label>
                  <label className="cs-field">
                    <span>Type</span>
                    <select
                      aria-label="Product type"
                      value={draft.kind}
                      onChange={(e) => setDraft({ ...draft, kind: e.target.value as StoreProduct['kind'] })}
                    >
                      <option value="digital">Digital download</option>
                      <option value="custom">Custom / made to order</option>
                    </select>
                  </label>
                </div>
              </div>
              <label className="cs-field">
                <span>Description</span>
                <textarea
                  aria-label="Product description"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="What's included, turnaround, file format…"
                  rows={2}
                />
              </label>
              <label className="cs-field">
                <span>{draft.kind === 'digital' ? 'Delivery URL (file, Drive, Notion…)' : 'Booking / brief link (optional)'}</span>
                <input
                  aria-label="Delivery URL"
                  value={draft.deliveryUrl}
                  onChange={(e) => setDraft({ ...draft, deliveryUrl: e.target.value })}
                  placeholder="https://…"
                  inputMode="url"
                />
              </label>
              <label className="cs-check">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Live on storefront
              </label>
              <div className="cs-editor__actions">
                <button
                  type="button"
                  className="cs-btn cs-btn--ghost"
                  onClick={() => {
                    setEditingId(null);
                    setDraft(null);
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="cs-btn cs-btn--primary" onClick={saveDraft}>
                  <Check size={15} /> Save product
                </button>
              </div>
            </div>
          )}

          <div className="cs-products">
            {products.length === 0 && (
              <div className="cs-empty">
                <ShoppingBag size={22} strokeWidth={1.6} />
                <p className="cs-empty__title">No products yet</p>
                <p className="cs-empty__text">Add your first digital product or custom offer to start selling.</p>
              </div>
            )}
            {products.map((p) => (
              <article key={p.id} className="cs-product" data-testid="store-product">
                <div className="cs-product__main">
                  <div className="cs-product__top">
                    <strong>{p.name}</strong>
                    <span className={`cs-kind cs-kind--${p.kind}`}>{KIND_LABEL[p.kind]}</span>
                    {!p.active && <span className="cs-kind cs-kind--off">Hidden</span>}
                  </div>
                  <p>{p.description || 'No description yet.'}</p>
                  <div className="cs-product__meta">
                    <span>{money(p.price, profile.currency)}</span>
                    {p.deliveryUrl && (
                      <a href={p.deliveryUrl} target="_blank" rel="noreferrer">
                        Delivery link <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="cs-product__actions">
                  <button type="button" className="cs-btn cs-btn--outline" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="cs-icon"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => setProducts((list) => list.filter((x) => x.id !== p.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="cs-card" aria-label="Payments">
          <div className="cs-card__head">
            <h2>
              <Wallet size={15} aria-hidden /> Accept payments
            </h2>
            <p>Connect a payment link once — every product uses it at checkout.</p>
          </div>
          <div className="cs-grid">
            <label className="cs-field">
              <span>Provider</span>
              <select
                aria-label="Payment provider"
                value={profile.paymentProvider}
                onChange={(e) =>
                  setProfile({ ...profile, paymentProvider: e.target.value as typeof profile.paymentProvider })
                }
              >
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
                <option value="manual">Manual / DM to pay</option>
              </select>
            </label>
            <label className="cs-field">
              <span>{paymentMeta.label}</span>
              <input
                aria-label={paymentMeta.label}
                value={profile.paymentHandle}
                onChange={(e) => setProfile({ ...profile, paymentHandle: e.target.value })}
                placeholder={paymentMeta.placeholder}
              />
            </label>
          </div>
          <p className="cs-hint">{paymentMeta.help}</p>
        </section>

        <section className="cs-card" aria-label="Orders">
          <div className="cs-card__head">
            <h2>
              <BadgeDollarSign size={15} aria-hidden /> Orders
            </h2>
            <p>Demo checkout from your live preview lands here.</p>
          </div>
          {orders.length === 0 ? (
            <p className="cs-hint">No orders yet — try the Buy button in the phone preview.</p>
          ) : (
            <ul className="cs-orders">
              {orders.map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>{o.productName}</strong>
                    <small>
                      {o.buyer} · {new Date(o.date).toLocaleString()}
                    </small>
                  </div>
                  <span>{money(o.amount, profile.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="cs-right">
        <div className="cs-phone" style={{ ['--cs-from' as string]: theme.from, ['--cs-to' as string]: theme.to }}>
          <div className="cs-phone__notch" />
          <div className="cs-phone__hero">
            <span className="cs-avatar">{(profile.displayName || 'S').charAt(0).toUpperCase()}</span>
            <strong>{profile.displayName || 'Your Studio'}</strong>
            <small>@{slugifyHandle(profile.handle) || 'yourhandle'}</small>
            <p>{profile.bio}</p>
          </div>
          <div className="cs-phone__links">
            {activeProducts.length === 0 && <p className="cs-hint">Your products will appear here.</p>}
            {activeProducts.map((p) => (
              <div key={p.id} className="cs-phone__item">
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {KIND_LABEL[p.kind]} · {money(p.price, profile.currency)}
                  </small>
                </div>
                <button type="button" onClick={() => checkout(p.id)}>
                  Buy
                </button>
              </div>
            ))}
          </div>
          <div className="cs-phone__pay">
            <small>
              Secured by {profile.paymentProvider === 'manual' ? 'manual payment' : profile.paymentProvider} ·{' '}
              {profile.currency}
            </small>
          </div>
        </div>

        <div className="cs-card cs-share">
          <h2>
            <Link2 size={15} aria-hidden /> Share in your TikTok bio
          </h2>
          <div className="cs-linkrow">
            <code>{url}</code>
            <button type="button" className="cs-btn cs-btn--primary" onClick={copyLink}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <ol className="cs-steps">
            <li>Copy your store link above.</li>
            <li>Open TikTok → Edit profile → Bio → paste the link.</li>
            <li>Post a video pinning your best product to drive clicks.</li>
          </ol>
          <label className="cs-field">
            <span>Try a test checkout as</span>
            <input
              aria-label="Test buyer handle"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              placeholder="@fan"
            />
          </label>
          {notice && (
            <p className="cs-flash" role="status">
              {notice}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
