import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Lock, MousePointerClick, RotateCw, ShieldAlert } from 'lucide-react';
import type { Business, Preview, PreviewPlatform, TikTokPreview } from './businessService';
import { BusinessApiError, businessApi, formatCount } from './businessService';
import { PLATFORM_LABEL, PlatformIcon } from './PlatformIcon';

interface Props {
  business: Business | null;
  platform: PreviewPlatform | null;
  token: string;
  api?: Pick<typeof businessApi, 'preview'>;
  canBack: boolean;
  canForward: boolean;
  onBack(): void;
  onForward(): void;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; notFound: boolean }
  | { status: 'ready'; preview: Preview };

function displayUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return url;
  }
}

export function PreviewPanel({ business, platform, token, api = businessApi, canBack, canForward, onBack, onForward }: Props) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!business || !platform) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    api
      .preview(business.id, platform, token)
      .then(({ data }) => !cancelled && setState({ status: 'ready', preview: data }))
      .catch((err) => {
        if (cancelled) return;
        const e = err as BusinessApiError;
        setState({
          status: 'error',
          message: e.message || 'Preview unavailable.',
          notFound: e.code === 'PROFILE_NOT_FOUND' || e.code === 'NO_WEBSITE',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [business?.id, platform, token, reloadKey, api]);

  const targetUrl =
    state.status === 'ready'
      ? state.preview.url
      : platform === 'website'
        ? business?.website ?? null
        : platform
          ? business?.socialProfiles?.[platform] ?? null
          : null;

  return (
    <section className="bc-preview" aria-label="In-app page preview">
      <div className="bc-browser">
        <button type="button" className="bc-browser__btn" onClick={onBack} disabled={!canBack} aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <button type="button" className="bc-browser__btn" onClick={onForward} disabled={!canForward} aria-label="Forward">
          <ArrowRight size={16} />
        </button>
        <button
          type="button"
          className="bc-browser__btn"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={!platform}
          aria-label="Refresh"
        >
          <RotateCw size={15} />
        </button>
        <div className="bc-browser__url" data-testid="preview-url">
          {platform ? <PlatformIcon platform={platform} size={14} /> : <Lock size={13} />}
          <span>{targetUrl ? displayUrl(targetUrl) : 'Select a website or profile'}</span>
        </div>
        {targetUrl && (
          <a className="bc-browser__btn" href={targetUrl} target="_blank" rel="noopener noreferrer" aria-label="Open externally" title="Open externally">
            <ExternalLink size={15} />
          </a>
        )}
      </div>

      <div className="bc-preview__viewport" data-testid="preview-viewport">
        {state.status === 'idle' && (
          <div className="bc-empty">
            <MousePointerClick size={22} strokeWidth={1.6} />
            <p className="bc-empty__title">Preview a business</p>
            <p className="bc-empty__text">Click a website or social icon on any result to view it here without leaving Launchly.</p>
          </div>
        )}

        {state.status === 'loading' && (
          <div className="bc-preview__loading" data-testid="preview-loading">
            <div className="bc-line bc-shimmer" style={{ width: '60%', height: 18 }} />
            <div className="bc-line bc-shimmer" style={{ width: '90%' }} />
            <div className="bc-block bc-shimmer" />
          </div>
        )}

        {state.status === 'error' && (
          <div className="bc-empty">
            <ShieldAlert size={22} strokeWidth={1.6} />
            <p className="bc-empty__title">{state.message}</p>
            {!state.notFound && (
              <button type="button" className="bc-btn bc-btn--ghost" onClick={() => setReloadKey((k) => k + 1)}>
                Retry
              </button>
            )}
          </div>
        )}

        {state.status === 'ready' && <PreviewBody preview={state.preview} name={business?.name ?? ''} />}
      </div>
    </section>
  );
}

function BlockedNotice({ url }: { url: string }) {
  return (
    <div className="bc-blocked">
      <p>This page doesn&rsquo;t allow embedded viewing.</p>
      <a className="bc-btn bc-btn--ghost" href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={14} /> Open External Page
      </a>
    </div>
  );
}

function PreviewBody({ preview, name }: { preview: Preview; name: string }) {
  if (preview.kind === 'website') {
    if (preview.embeddable) {
      return (
        <div className="bc-frame-wrap">
          <iframe
            key={preview.url}
            src={preview.url}
            title={`${name} website`}
            className="bc-frame"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            data-testid="preview-iframe"
          />
        </div>
      );
    }
    return (
      <div className="bc-native" data-testid="preview-native">
        {preview.image && <img className="bc-native__hero" src={preview.image} alt="" />}
        <div className="bc-native__head">
          {preview.favicon && <img className="bc-native__favicon" src={preview.favicon} alt="" />}
          <div>
            <p className="bc-native__title">{preview.title ?? name}</p>
            <p className="bc-muted">{preview.domain ?? displayUrl(preview.url)}</p>
          </div>
        </div>
        {!preview.reachable && <p className="bc-muted">The website could not be loaded right now.</p>}
        {preview.description && <p className="bc-native__desc">{preview.description}</p>}
        {preview.keyLinks.length > 0 && (
          <div className="bc-native__links">
            {preview.keyLinks.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            ))}
          </div>
        )}
        <BlockedNotice url={preview.url} />
      </div>
    );
  }

  if (preview.kind === 'tiktok') return <TikTokBody preview={preview} />;

  return (
    <div className="bc-native" data-testid="preview-native">
      <div className="bc-native__head">
        {preview.image ? (
          <img className="bc-native__avatar" src={preview.image} alt="" />
        ) : (
          <span className="bc-native__avatar bc-native__avatar--icon">
            <PlatformIcon platform={preview.platform} size={22} />
          </span>
        )}
        <div>
          <p className="bc-native__title">{preview.title ?? (preview.username ? `@${preview.username}` : PLATFORM_LABEL[preview.platform])}</p>
          <p className="bc-muted">{PLATFORM_LABEL[preview.platform]} · linked by the business</p>
        </div>
      </div>
      {preview.description ? (
        <p className="bc-native__desc">{preview.description}</p>
      ) : (
        <p className="bc-muted">{PLATFORM_LABEL[preview.platform]} shares little public data with signed-out visitors.</p>
      )}
      <BlockedNotice url={preview.url} />
    </div>
  );
}

function TikTokBody({ preview }: { preview: TikTokPreview }) {
  const p = preview.profile;
  if (!p) {
    return (
      <div className="bc-empty" data-testid="tiktok-preview">
        <PlatformIcon platform="tiktok" size={22} />
        <p className="bc-empty__title">TikTok profile not found</p>
        <p className="bc-empty__text">The linked account has no public profile data right now.</p>
        <a className="bc-btn bc-btn--ghost" href={preview.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} /> Open External Page
        </a>
      </div>
    );
  }
  return (
    <div className="bc-native bc-tiktok" data-testid="tiktok-preview">
      <div className="bc-native__head">
        {p.avatar ? <img className="bc-native__avatar" src={p.avatar} alt="" /> : <span className="bc-native__avatar bc-native__avatar--icon"><PlatformIcon platform="tiktok" size={22} /></span>}
        <div>
          <p className="bc-native__title">{p.displayName ?? `@${p.username}`}</p>
          <p className="bc-muted">@{p.username}</p>
        </div>
      </div>
      <div className="bc-stats">
        <div><strong>{formatCount(p.followers)}</strong><span>Followers</span></div>
        <div><strong>{formatCount(p.following)}</strong><span>Following</span></div>
        <div><strong>{formatCount(p.likes)}</strong><span>Likes</span></div>
      </div>
      {p.bio && <p className="bc-native__desc">{p.bio}</p>}
      {p.videos.length > 0 ? (
        <div className="bc-videos">
          {p.videos.map((v, i) => (
            <a
              key={v.id ?? i}
              className="bc-video"
              href={v.id ? `https://www.tiktok.com/@${p.username}/video/${v.id}` : preview.url}
              target="_blank"
              rel="noopener noreferrer"
              title={v.description ?? ''}
            >
              {v.cover ? <img src={v.cover} alt="" loading="lazy" /> : <span className="bc-video__blank" />}
              {v.views != null && <span className="bc-video__views">{formatCount(v.views)} views</span>}
            </a>
          ))}
        </div>
      ) : (
        <p className="bc-muted">No recent public videos found.</p>
      )}
      <BlockedNotice url={preview.url} />
    </div>
  );
}
