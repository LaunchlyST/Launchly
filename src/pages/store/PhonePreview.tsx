import { ArrowUpRight, AtSign, Camera, Music2, Play } from 'lucide-react';
import type { DesignerState, SocialNetwork } from './store';
import { FONTS } from './store';

const SOCIAL_ICON: Record<SocialNetwork, typeof Music2> = {
  tiktok: Music2,
  instagram: Camera,
  youtube: Play,
  x: AtSign,
};

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
      return { ...base, background: primary ? '#0f172a' : 'rgba(15,23,42,.85)', color: '#fff', border: '1px solid transparent' };
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
    return { ...base, background: 'transparent', color: t.textColor, border: `1.5px solid ${t.textColor}` };
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

  const featured = designer.products.find((p) => p.id === designer.featuredProductId) ?? null;
  const initial = (designer.displayName || 'S').replace(/^@/, '').charAt(0).toUpperCase();

  return (
    <div className="pv-phone" aria-label="Live preview of your public page">
      <div className="pv-notch" aria-hidden="true" />
      <div className={`pv-screen${t.bgAnimated && t.bgMode === 'gradient' ? ' is-animated' : ''}`} style={{ fontFamily: font, color: t.textColor }}>
        <div className="pv-bg" style={bgLayerStyle} aria-hidden="true" />
        <div className="pv-content">
          {designer.sections.map((section) => {
            const key = `section:${section.id}`;
            if (section.kind === 'profile') {
              return (
                <div key={section.id} className={cls(key, 'pv-profile')} {...bind(key)}>
                  {designer.avatar ? (
                    <img className="pv-avatar" src={designer.avatar} alt="" />
                  ) : (
                    <span className="pv-avatar pv-avatar--fallback" style={{ background: designer.avatarColor }}>
                      {initial}
                    </span>
                  )}
                  <strong className="pv-name">{designer.displayName || 'Your Studio'}</strong>
                  {username && <span className="pv-handle">@{username}</span>}
                  {designer.bio && <p className="pv-bio">{designer.bio}</p>}
                </div>
              );
            }
            if (section.kind === 'featured') {
              if (!featured) return null;
              return (
                <div key={section.id} className={cls(key)} {...bind(key)}>
                  <p className="pv-caption">{section.title}</p>
                  <div
                    className={cls(`product:${featured.id}`, 'pv-featured')}
                    style={cardStyle}
                    {...bind(`product:${featured.id}`)}
                  >
                    {featured.image ? (
                      <img className="pv-featured__img" src={featured.image} alt="" />
                    ) : (
                      <div className="pv-featured__img pv-featured__img--blank" aria-hidden="true" />
                    )}
                    <div className="pv-featured__body">
                      <strong>{featured.title}</strong>
                      {featured.description && <small>{featured.description}</small>}
                      <div className="pv-featured__row">
                        <span className="pv-price">{featured.price}</span>
                        <span className="pv-cta" style={btnStyle(true)}>
                          Get it
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            if (section.kind === 'products') {
              if (designer.products.length === 0) {
                return (
                  <div key={section.id} className={cls(key)} {...bind(key)}>
                    <p className="pv-caption">{section.title}</p>
                    <div className="pv-empty">No products yet</div>
                  </div>
                );
              }
              return (
                <div key={section.id} className={cls(key)} {...bind(key)}>
                  <p className="pv-caption">{section.title}</p>
                  <div className="pv-products">
                    {designer.products.map((p) => (
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
                        </div>
                        <span className="pv-price">{p.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (section.kind === 'links') {
              if (designer.links.length === 0) {
                return (
                  <div key={section.id} className={cls(key)} {...bind(key)}>
                    <p className="pv-caption">{section.title}</p>
                    <div className="pv-empty">No links yet</div>
                  </div>
                );
              }
              return (
                <div key={section.id} className={cls(key)} {...bind(key)}>
                  <p className="pv-caption">{section.title}</p>
                  <div className="pv-links">
                    {designer.links.map((l) => (
                      <div key={l.id} className={cls(`link:${l.id}`, 'pv-link')} style={btnStyle(false)} {...bind(`link:${l.id}`)}>
                        <span>{l.label}</span>
                        <ArrowUpRight size={14} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            // social
            return (
              <div key={section.id} className={cls(key)} {...bind(key)}>
                <p className="pv-caption">{section.title}</p>
                {designer.socials.length === 0 ? (
                  <div className="pv-empty">No socials yet</div>
                ) : (
                  <div className="pv-socials">
                    {designer.socials.map((s) => {
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
          })}
          <p className="pv-powered">Made with Launchly</p>
        </div>
      </div>
    </div>
  );
}
