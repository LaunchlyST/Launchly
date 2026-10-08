import { useRef, useState } from 'react';
import { ArrowUpRight, AtSign, Camera, Check, GripVertical, Music2, Play } from 'lucide-react';
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
  onClear?: () => void;
  onMoveBlock?: (dragId: string, targetId: string) => void;
}

export function PhonePreview({
  designer,
  username,
  selectedKey,
  hoverKey,
  interactive = true,
  onHover,
  onPick,
  onClear,
  onMoveBlock,
}: PhonePreviewProps) {
  const t = designer.theme;
  const font = FONTS[t.font];
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const dragMoved = useRef(false);
  const suppressPick = useRef(false);
  const dropRef = useRef<string | null>(null);
  const moveRef = useRef(onMoveBlock);
  moveRef.current = onMoveBlock;

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
            if (suppressPick.current) return;
            onPick?.(key);
          },
        }
      : {};

  function setDrop(v: string | null) {
    dropRef.current = v;
    setDropId(v);
  }

  function gripDown(e: React.PointerEvent, id: string) {
    if (!interactive || !moveRef.current || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragMoved.current = false;
    setDragId(id);
    setDrop(null);
    const startY = e.clientY;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - startY) > 6) dragMoved.current = true;
      if (!dragMoved.current) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-block-id]');
      setDrop(el ? ((el as HTMLElement).dataset.blockId ?? null) : null);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const target = dropRef.current;
      if (dragMoved.current && target && target !== id) moveRef.current?.(id, target);
      setDragId(null);
      setDrop(null);
      dragMoved.current = false;
      suppressPick.current = true;
      window.setTimeout(() => {
        suppressPick.current = false;
      }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function BlockWrap({ id, blockKey, extra, children }: { id: string; blockKey: string; extra?: string; children: React.ReactNode }) {
    return (
      <div data-block-id={id} className={`${cls(blockKey, extra ?? '')}${dropId === id ? ' is-drop' : ''}`} {...bind(blockKey)}>
        {interactive && !!moveRef.current && (
          <span
            className="pv-grip"
            aria-hidden="true"
            onPointerDown={(e) => gripDown(e, id)}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={12} />
          </span>
        )}
        {children}
      </div>
    );
  }

  const handle = (designer.username || username).replace(/^@+/, '');
  const initial = (designer.displayName || 'S').replace(/^@/, '').charAt(0).toUpperCase();
  // Avoid showing "@handle" twice when the display name equals the handle.
  const showName = designer.displayName.trim() !== '' && designer.displayName.trim().toLowerCase() !== `@${handle}`.toLowerCase();
  const displayTitle = showName ? designer.displayName : handle ? `@${handle}` : 'Your Studio';

  function renderBlock(block: Block) {
    const key = `block:${block.id}`;
    switch (block.type) {
      case 'profile':
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key} extra="pv-profile">
            {designer.avatar ? (
              <img draggable={false} className="pv-avatar" src={designer.avatar} alt="" />
            ) : (
              <span className="pv-avatar pv-avatar--fallback" style={{ background: designer.avatarColor }}>
                {initial}
              </span>
            )}
            <strong className="pv-name">{displayTitle}</strong>
            {showName && handle && <span className="pv-handle">@{handle}</span>}
            {designer.bio && <p className="pv-bio">{designer.bio}</p>}
          </BlockWrap>
        );
      case 'products': {
        const items = block.products ?? [];
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key}>
            {block.title && <p className="pv-caption">{block.title}</p>}
            {items.length === 0 ? (
              <div className="pv-empty">No products yet</div>
            ) : (
              <div className="pv-products">
                {items.map((p) => (
                  <div key={p.id} className={cls(`product:${p.id}`, 'pv-product')} style={cardStyle} {...bind(`product:${p.id}`)}>
                    {p.image ? (
                      <img draggable={false} className="pv-product__img" src={p.image} alt="" />
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
          </BlockWrap>
        );
      }
      case 'links': {
        const items = block.links ?? [];
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key}>
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
          </BlockWrap>
        );
      }
      case 'social': {
        const items = (block.socials ?? []).filter((s) => s.url.trim() !== '');
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key}>
            {block.title && <p className="pv-caption">{block.title}</p>}
            {items.length === 0 ? (
              <div className="pv-empty">No socials yet — add profile URLs</div>
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
          </BlockWrap>
        );
      }
      case 'tiktok': {
        const items = block.videos ?? [];
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key}>
            {block.title && <p className="pv-caption">{block.title}</p>}
            {items.length === 0 ? (
              <div className="pv-empty">No videos yet — add your TikToks</div>
            ) : (
              <div className="pv-tiktoks">
                {items.map((v) => (
                  <div key={v.id} className={cls(`tiktok:${v.id}`, 'pv-tiktok')} {...bind(`tiktok:${v.id}`)}>
                    {v.thumb ? (
                      <img draggable={false} src={v.thumb} alt="" />
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
          </BlockWrap>
        );
      }
      case 'video':
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key}>
            {block.title && <p className="pv-caption">{block.title}</p>}
            <div className="pv-video" style={cardStyle}>
              {block.image ? (
                <img draggable={false} src={block.image} alt="" />
              ) : (
                <span className="pv-video__blank" aria-hidden="true">
                  <Play size={22} />
                </span>
              )}
              {block.caption && <small>{block.caption}</small>}
            </div>
          </BlockWrap>
        );
      case 'image': {
        const img = block.image ? (
          <img draggable={false} className="pv-image__img" src={block.image} alt={block.caption || ''} />
        ) : (
          <span className="pv-image__blank" aria-hidden="true" />
        );
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key}>
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
          </BlockWrap>
        );
      }
      case 'text': {
        const size = block.fontSize ?? 15;
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key} extra="pv-text">
            <div
              className="pv-text__inner"
              style={{ textAlign: block.align ?? 'center', color: block.color, fontSize: size }}
            >
              {block.heading && <strong style={{ fontSize: size + 2 }}>{block.heading}</strong>}
              {block.body && <p>{block.body}</p>}
            </div>
          </BlockWrap>
        );
      }
      case 'newsletter':
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key}>
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
          </BlockWrap>
        );
    }
  }

  return (
    <div className={`pv-phone${dragId ? ' is-dragging' : ''}`} aria-label="Live preview of your public page">
      <div className="pv-notch" aria-hidden="true" />
      <div
        className={`pv-screen${t.bgAnimated && t.bgMode === 'gradient' ? ' is-animated' : ''}`}
        style={{ fontFamily: font, color: t.textColor }}
      >
        <div className="pv-bg" style={bgLayerStyle} aria-hidden="true" />
        <div
          className="pv-content"
          onClick={() => {
            if (suppressPick.current) return;
            if (interactive) onClear?.();
          }}
        >
          {designer.blocks.map(renderBlock)}
          <p className="pv-powered">Made with Launchly</p>
        </div>
      </div>
    </div>
  );
}
