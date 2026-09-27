import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, MapPin, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import type { Business, PreviewPlatform, SearchParams } from './businessService';
import { businessApi, CATEGORIES, CITY_SUGGESTIONS, COUNTRIES } from './businessService';
import { BusinessCard, BusinessCardSkeleton, availablePlatforms } from './BusinessCard';
import { PreviewPanel } from './PreviewPanel';
import { OutreachPanel } from './OutreachPanel';
import './business-connect.css';

type Api = typeof businessApi;

interface Props {
  token: string;
  /** Injected in tests; production uses the real worker client. */
  api?: Api;
}

type ResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: Business[]; provider: string | null };

interface Filters {
  hasWebsite: boolean;
  hasSocial: boolean;
  hasPhone: boolean;
  hasRating: boolean;
}

const QUICK_TYPES = ['dentist', 'restaurant', 'gym', 'beauty', 'roofer', 'estate_agent', 'accountant', 'car_dealer'];

interface HistoryEntry {
  business: Business;
  platform: PreviewPlatform;
}

export function BusinessConnectPage({ token, api = businessApi }: Props) {
  const [params, setParams] = useState<SearchParams>({ q: '', country: 'GB', city: 'Chelmsford', type: 'dentist' });
  const [results, setResults] = useState<ResultsState>({ status: 'idle' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ hasWebsite: false, hasSocial: false, hasPhone: false, hasRating: false });
  const [selected, setSelected] = useState<Business | null>(null);
  const [nav, setNav] = useState<{ stack: HistoryEntry[]; index: number }>({ stack: [], index: -1 });
  const [emailInfo, setEmailInfo] = useState<{ id: string; email: string | null; loading: boolean } | null>(null);
  const searchSeq = useRef(0);

  const runSearch = useCallback(
    async (p: SearchParams) => {
      if (!p.city.trim()) {
        setResults({ status: 'error', message: 'Enter a city to search.' });
        return;
      }
      if (!p.type && p.q.trim().length < 2) {
        setResults({ status: 'error', message: 'Choose a business type or enter a search term.' });
        return;
      }
      const seq = ++searchSeq.current;
      setResults({ status: 'loading' });
      try {
        const { data, meta } = await api.search(p, token);
        if (seq !== searchSeq.current) return;
        setResults({ status: 'ready', items: data, provider: meta?.provider ?? null });
      } catch (err) {
        if (seq !== searchSeq.current) return;
        setResults({ status: 'error', message: err instanceof Error ? err.message : 'Search failed.' });
      }
    },
    [api, token]
  );

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    runSearch(params);
  };

  const pickType = (type: string) => {
    const next = { ...params, type };
    setParams(next);
    runSearch(next);
  };

  const visible = useMemo(() => {
    if (results.status !== 'ready') return [];
    return results.items.filter(
      (b) =>
        (!filters.hasWebsite || !!b.website) &&
        (!filters.hasSocial || Object.values(b.socialProfiles ?? {}).some(Boolean)) &&
        (!filters.hasPhone || !!b.phone) &&
        (!filters.hasRating || b.rating != null)
    );
  }, [results, filters]);

  // Verified email + extra social links for the selected business (cached server-side).
  const loadDetails = useCallback(
    (b: Business) => {
      setEmailInfo({ id: b.id, email: b.email, loading: true });
      api
        .social(b.id, token)
        .then(({ data }) => {
          setEmailInfo((cur) => (cur?.id === b.id ? { id: b.id, email: data.email, loading: false } : cur));
          // Website-discovered socials can add icons the search result didn't have.
          const merged: Business = { ...b, ...data.business };
          setSelected((cur) => (cur?.id === b.id ? merged : cur));
          setResults((r) => (r.status === 'ready' ? { ...r, items: r.items.map((x) => (x.id === b.id ? merged : x)) } : r));
        })
        .catch(() => setEmailInfo((cur) => (cur?.id === b.id ? { id: b.id, email: b.email, loading: false } : cur)));
    },
    [api, token]
  );

  const openPreview = (b: Business, platform: PreviewPlatform) => {
    if (selected?.id !== b.id) {
      setSelected(b);
      loadDetails(b);
    }
    setNav((n) => {
      const stack = [...n.stack.slice(0, n.index + 1), { business: b, platform }];
      return { stack, index: stack.length - 1 };
    });
  };

  const selectBusiness = (b: Business) => {
    if (selected?.id === b.id) return;
    const first = availablePlatforms(b)[0];
    if (first) openPreview(b, first);
    else {
      setSelected(b);
      loadDetails(b);
      setNav((n) => ({ stack: n.stack.slice(0, n.index + 1), index: n.index }));
    }
  };

  const current = nav.index >= 0 ? nav.stack[nav.index] : null;
  const previewBusiness = current && current.business.id === selected?.id ? current.business : null;
  const previewPlatform = previewBusiness ? current!.platform : null;

  const goto = (index: number) => {
    const entry = nav.stack[index];
    if (!entry) return;
    setNav((n) => ({ ...n, index }));
    if (entry.business.id !== selected?.id) {
      setSelected(entry.business);
      loadDetails(entry.business);
    }
  };

  useEffect(() => {
    document.title = 'Local businesses — Launchly';
  }, []);

  const cityList = CITY_SUGGESTIONS[params.country] ?? [];

  return (
    <div className="bc-page">
      <div className="bc-left">
        <header className="bc-header">
          <p className="bc-eyebrow">Local business discovery</p>
          <h1>Local businesses</h1>
          <p className="bc-subtitle">Find local businesses, explore their online presence, and reach out — all in one place.</p>
        </header>

        <form className="bc-search" onSubmit={submit} role="search">
          <label className="bc-input bc-input--grow">
            <Search size={17} aria-hidden />
            <input
              aria-label="Search businesses or categories"
              placeholder="Search businesses, categories…"
              value={params.q}
              onChange={(e) => setParams({ ...params, q: e.target.value })}
            />
          </label>
          <label className="bc-input bc-input--select">
            <select aria-label="Country" value={params.country} onChange={(e) => setParams({ ...params, country: e.target.value, city: '' })}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="bc-input">
            <MapPin size={16} aria-hidden />
            <input aria-label="City" list="bc-cities" placeholder="City" value={params.city} onChange={(e) => setParams({ ...params, city: e.target.value })} />
            <datalist id="bc-cities">
              {cityList.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="bc-input bc-input--select">
            <select aria-label="Business type" value={params.type} onChange={(e) => setParams({ ...params, type: e.target.value })}>
              <option value="">Any type</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={`bc-btn bc-btn--outline ${filtersOpen ? 'is-on' : ''}`} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <SlidersHorizontal size={15} /> Filters
          </button>
          <button type="submit" className="bc-btn bc-btn--primary">
            Search
          </button>
        </form>

        {filtersOpen && (
          <div className="bc-filters" role="group" aria-label="Filters">
            {(
              [
                ['hasWebsite', 'Has website'],
                ['hasSocial', 'Has social profiles'],
                ['hasPhone', 'Has phone number'],
                ['hasRating', 'Has rating'],
              ] as [keyof Filters, string][]
            ).map(([k, label]) => (
              <label key={k} className="bc-check">
                <input type="checkbox" checked={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
        )}

        <div className="bc-chips" role="group" aria-label="Business types">
          {QUICK_TYPES.map((id) => {
            const c = CATEGORIES.find((x) => x.id === id)!;
            return (
              <button key={id} type="button" className={`bc-chip ${params.type === id ? 'is-active' : ''}`} onClick={() => pickType(id)}>
                {c.label}
              </button>
            );
          })}
        </div>

        {results.status === 'ready' && (
          <div className="bc-results-meta">
            <span>
              {visible.length} {visible.length === 1 ? 'business' : 'businesses'} found
              {visible.length !== results.items.length && ` (${results.items.length} before filters)`}
            </span>
            {results.provider && (
              <span className="bc-muted">Source: {results.provider === 'google' ? 'Google Places' : 'OpenStreetMap'}</span>
            )}
          </div>
        )}

        <div className="bc-results" aria-live="polite">
          {results.status === 'idle' && (
            <div className="bc-empty bc-empty--panel">
              <Search size={22} strokeWidth={1.6} />
              <p className="bc-empty__title">Search real local businesses</p>
              <p className="bc-empty__text">Pick a country, city and business type, then press Search.</p>
            </div>
          )}
          {results.status === 'loading' && [0, 1, 2, 3].map((i) => <BusinessCardSkeleton key={i} />)}
          {results.status === 'error' && (
            <div className="bc-empty bc-empty--panel" role="alert">
              <AlertCircle size={22} strokeWidth={1.6} />
              <p className="bc-empty__title">{results.message}</p>
              <button type="button" className="bc-btn bc-btn--ghost" onClick={() => runSearch(params)}>
                Retry
              </button>
            </div>
          )}
          {results.status === 'ready' && visible.length === 0 && (
            <div className="bc-empty bc-empty--panel">
              <SearchX size={22} strokeWidth={1.6} />
              <p className="bc-empty__title">No businesses found. Try another city or category.</p>
            </div>
          )}
          {results.status === 'ready' &&
            visible.map((b) => (
              <BusinessCard
                key={b.id}
                business={b}
                selected={selected?.id === b.id}
                activePlatform={selected?.id === b.id ? previewPlatform : null}
                onSelect={() => selectBusiness(b)}
                onOpenPlatform={(p) => openPreview(b, p)}
              />
            ))}
        </div>
      </div>

      <aside className="bc-right">
        <PreviewPanel
          business={previewBusiness}
          platform={previewPlatform}
          token={token}
          api={api}
          canBack={nav.index > 0}
          canForward={nav.index < nav.stack.length - 1}
          onBack={() => goto(nav.index - 1)}
          onForward={() => goto(nav.index + 1)}
        />
        <OutreachPanel
          business={selected}
          email={emailInfo?.id === selected?.id ? emailInfo?.email ?? null : null}
          emailLoading={!!(emailInfo?.id === selected?.id && emailInfo?.loading)}
          token={token}
          api={api}
        />
      </aside>
    </div>
  );
}
