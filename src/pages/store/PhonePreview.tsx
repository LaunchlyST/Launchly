import { useState } from 'react';
import { ArrowUpRight, AtSign, Camera, Check, Music2, Play } from 'lucide-react';
import type { Block, DesignerState, SocialNetwork } from './store';
import { FONTS } from './store';

const SOCIAL_ICON: Record<SocialNetwork, typeof Music2> = {
  tiktok: Music2,
  instagram: Camera,
  youtube: Play,
  x: AtSign,
};

/** White or near-black text depending on the button fill. */
function onColor(hex: string): string {
  const m = hex.replace('#', '');
  if (m.length < 6) return '#fff';
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
}

interface PhonePreviewProps {
  designer: DesignerState;
  username: string;
  selectedKey: string | null;
  hoverKey: string | null;
  interactive?: boolean;
  onHover?: (key: string | null) => void;
  onPick?: (key: string) => void;
}

export function PhonePreview({
  designer,
  username,
  selectedKey,
  hoverKey,
  interactive = true,
  onHover,
  onPick,
}: PhonePreviewProps) {
  const t = designer.theme;
  const font = FONTS[t.font];
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const bgLayerStyle: React.CSSProperties =
    t.bgMode === 'image' && t.bgImage
      ? {
          backgroundImage: `url("${t.bgImage}")`,
          backgroundSize: t.bgSize,
          backgroundPosition: t.bgPosition,
          filter: t.bgBlur ? 'blur(18px) saturate(1.2)' : undefined,
          transform: t.bgBlur ? 'scale(1.08)' : undefined,
        }
      : t.bgMode === 'gradient'
        ? { background: t.gradient }
        : { background: t.bgColor };

  const btnStyle = (primary: boolean): React.CSSProperties => {
    const base: React.CSSProperties = { borderRadius: t.buttonRadius };
    if (t.buttonStyle === 'filled') {
      return { ...base, background: t.buttonColor, color: onColor(t.buttonColor), border: '1px solid transparent' };
    }
    if (t.buttonStyle === 'soft') {
      return {
        ...base,
        background: t.bgGlass ? 'rgba(255,255,255,.55)' : 'rgba(15,23,42,.06)',
        color: t.textColor,
        border: '1px solid rgba(15,23,42,.08)',
        backdropFilter: t.bgGlass ? 'blur(8px)' : undefined,
      };
    }
    return { ...base, background: 'transparent', color: primary ? t.buttonColor : t.textColor, border: `1.5px solid ${t.buttonColor}` };
  };

  const cardStyle: React.CSSProperties = t.bgGlass
    ? { background: 'rgba(255,255,255,.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.7)' }
    : { background: '#fff', border: '1px solid rgba(15,23,42,.08)' };

  const cls = (key: string, extra = '') =>
    `pv-block ${extra}${hoverKey === key ? ' is-hover' : ''}${selectedKey === key ? ' is-selected' : ''}`.trim();

  const bind = (key: string) =>
    interactive
      ? {
          onMouseEnter: () => onHover?.(key),
          onMouseLeave: () => onHover?.(null),
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onPick?.(key);
          },
        }
      : {};

  const handle = (designer.username || username).replace(/^@+/, '');
  const initial = (designer.displayName || 'S').replace(/^@/, '').charAt(0).toUpperCase();

  function renderBlock(block: Block) {
    const key = `block:${block.id}`;
    switch (block.type) {
      case 'profile':
        return (
          <div key={block.id} className={cls(key, 'pv-profile')} {...bind(key)}>
            {designer.avatar ? (
              <img className="pv-avatar" src={designer.avatar} alt="" />
            ) : (
              <span className="pv-avatar pv-avatar--fallback" style={{ background: designer.avatarColor }}>
                {initial}
              </span>
            )}
            <strong className="pv-name">{designer.displayName || 'Your Studio'}</strong>
            {handle && <span className="pv-handle">@{handle}</span>}
            {designer.bio && <p className="pv-bio">{designer.bio}</p>}
          </div>
        );
      case 'products': {
        const items = block.products ?? [];
        return (
          <div key={block.id} className={cls(key)} {...bind(key)}>
            {block.title && <p className="pv-caption">{block.title}</p>}
            {items.length === 0 ? (
              <div className="pv-empty">No products yet</div>
            ) : (
              <div className="pv-products">
                {items.map((p) => (
                  <div key={p.id} className={cls(`product:${p.id}`, 'pv-product')} style={cardStyle} {...bind(`product:${p.id}`)}>
                    {p.image ? (
                      <img className="pv-product__img" src={p.image} alt="" />
                    ) : (
                      <span className="pv-product__img pv-product__img--blank" style={{ background: designer.avatarColor }} aria-hidden="true">
                        {p.title.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="pv-product__body">
                      <strong>{p.title}</strong>
                      {p.description && <small>{p.description}</small>}
                      <span className="pv-product__cta" style={btnStyle(true)}>
                        {p.cta || 'Get it'} · {p.price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'links': {
        const items = block.links ?? [];
        return (
          <div key={block.id} className={cls(key)} {...bind(key)}>
            {block.title && <p className="pv-caption">{block.title}</p>}
            {items.length === 0 ? (
              <div className="pv-empty">No links yet</div>
            ) : (
              <div className="pv-links">
                {items.map((l) => (
                  <div key={l.id} className={cls(`link:${l.id}`, 'pv-link')} style={btnStyle(false)} {...bind(`link:${l.id}`)}>
                    <span>{l.label}</span>
                    <ArrowUpRight size={14} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'social': {
        const items = block.socials ?? [];
        return (
          <div key={block.id} className={cls(key)} {...bind(key)}>
            {block.title && <p className="pv-caption">{block.title}</p>}
            {items.length === 0 ? (
              <div className="pv-empty">No socials yet</div>
            ) : (
              <div className="pv-socials">
                {items.map((s) => {
                  const Icon = SOCIAL_ICON[s.network];
                  return (
                    <span key={s.id} className="pv-social" style={cardStyle} title={s.network}>
                      <Icon size={16} />
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      }
      case 'tiktok': {
        const items = block.videos ?? [];
        return (
          <div key={block.id} className={cls(key)} {...bind(key)}>
            {block.title && <p className="pv-caption">{block.title}</p>}
            {items.length === 0 ? (
              <div className="pv-empty">No videos yet — add your TikToks</div>
            ) : (
              <div className="pv-tiktoks">
                {items.map((v) => (
                  <div key={v.id} className={cls(`tiktok:${v.id}`, 'pv-tiktok')} {...bind(`tiktok:${v.id}`)}>
                    {v.thumb ? (
                      <img src={v.thumb} alt="" />
                    ) : (
                      <span className="pv-tiktok__blank" aria-hidden="true">
                        <Music2 size={18} />
                      </span>
                    )}
                    <span className="pv-tiktok__play" aria-hidden="true">
                      <Play size={13} />
                    </span>
                    {v.views && <span className="pv-tiktok__views">{v.views}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'video':
        return (
          <div key={block.id} className={cls(key)} {...bind(key)}>
            {block.title && <p className="pv-caption">{block.title}</p>}
            <div className="pv-video" style={cardStyle}>
              {block.image ? (
                <img src={block.image} alt="" />
              ) : (
                <span className="pv-video__blank" aria-hidden="true">
                  <Play size={22} />
                </span>
              )}
              {block.caption && <small>{block.caption}</small>}
            </div>
          </div>
        );
      case 'image': {
        const img = block.image ? (
          <img className="pv-image__img" src={block.image} alt={block.caption || ''} />
        ) : (
          <span className="pv-image__blank" aria-hidden="true" />
        );
        return (
          <div key={block.id} className={cls(key)} {...bind(key)}>
            {block.url ? (
              <span className="pv-image" style={cardStyle}>
                {img}
                {block.caption && <small>{block.caption}</small>}
              </span>
            ) : (
              <div className="pv-image" style={cardStyle}>
                {img}
                {block.caption && <small>{block.caption}</small>}
              </div>
            )}
          </div>
        );
      }
      case 'text':
        return (
          <div key={block.id} className={cls(key, 'pv-text')} {...bind(key)}>
            {block.heading && <strong>{block.heading}</strong>}
            {block.body && <p>{block.body}</p>}
          </div>
        );
      case 'newsletter':
        return (
          <div key={block.id} className={cls(key)} {...bind(key)}>
            <div className="pv-news" style={cardStyle}>
              {block.heading && <strong>{block.heading}</strong>}
              {block.subtext && <small>{block.subtext}</small>}
              {subscribed ? (
                <span className="pv-news__done">
                  <Check size={14} /> You&rsquo;re in!
                </span>
              ) : (
                <span className="pv-news__row">
                  <input
                    aria-label="Email address"
                    placeholder={block.placeholder || 'you@email.com'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button type="button" style={btnStyle(true)} onClick={(e) => { e.stopPropagation(); if (email.trim()) setSubscribed(true); }}>
                    {block.buttonLabel || 'Subscribe'}
                  </button>
                </span>
              )}
            </div>
          </div>
        );
    }
  }

  return (
    <div className="pv-phone" aria-label="Live preview of your public page">
      <div className="pv-notch" aria-hidden="true" />
      <div className={`pv-screen${t.bgAnimated && t.bgMode === 'gradient' ? ' is-animated' : ''}`} style={{ fontFamily: font, color: t.textColor }}>
        <div className="pv-bg" style={bgLayerStyle} aria-hidden="true" />
        <div className="pv-content">
          {designer.blocks.map(renderBlock)}
          <p className="pv-powered">Made with Launchly</p>
        </div>
      </div>
    </div>
  );
}
