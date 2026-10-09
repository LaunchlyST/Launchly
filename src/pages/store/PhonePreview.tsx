import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AtSign, Camera, Check, GripVertical, Music2, Play, Plus } from 'lucide-react';
import type { Block, BlockType, DesignerState, SocialNetwork } from './store';
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
  /** Controlled frame width (null = default 292). Owned by the parent so the
      divider can stay glued to the phone while resizing. */
  width?: number | null;
  onWidthChange?: (w: number) => void;
  onHover?: (key: string | null) => void;
  onPick?: (key: string) => void;
  onClear?: () => void;
  onMoveBlock?: (dragId: string, targetId: string) => void;
  /** Preferred reorder path: move dragged block to this index in the
      post-removal list (0 = top, length = bottom). */
  onMoveBlockAt?: (dragId: string, toIndex: number) => void;
  /** Create a section dropped from the left palette at this index. */
  onInsertBlock?: (type: BlockType, toIndex: number) => void;
}

export function PhonePreview({
  designer,
  username,
  selectedKey,
  hoverKey,
  interactive = true,
  width = null,
  onWidthChange,
  onHover,
  onPick,
  onClear,
  onMoveBlock,
  onMoveBlockAt,
  onInsertBlock,
}: PhonePreviewProps) {
  const t = designer.theme;
  const font = FONTS[t.font];
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  // Flexible builder drag state: the dragged block leaves the flow (so the
  // rest auto-rearranges) and a floating ghost follows the pointer while a
  // line indicator marks the exact insertion index.
  const [dragId, setDragId] = useState<string | null>(null);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; label: string } | null>(null);
  // Palette drag: a section type being dragged in from the left panel.
  // `overPhone` highlights the drop area; `paletteIndex` is the insertion
  // slot the pointer is currently hovering.
  const [paletteDrag, setPaletteDrag] = useState<{ type: BlockType; label: string } | null>(null);
  const [overPhone, setOverPhone] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState<number | null>(null);
  // Drag-to-resize the phone width (builder only) so more of the page fits.
  // Height stays fixed at 620 — the phone only ever grows left-to-right,
  // so the page and the boxes around it never get taller.
  const resizeRef = useRef<{ startX: number; baseW: number; pointerId: number } | null>(null);
  const suppressPick = useRef(false);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    label: string;
    w: number;
  } | null>(null);
  const insertPosRef = useRef<number | null>(null);
  const moveAtRef = useRef(onMoveBlockAt);
  moveAtRef.current = onMoveBlockAt;
  const moveRef = useRef(onMoveBlock);
  moveRef.current = onMoveBlock;
  const insertBlockRef = useRef(onInsertBlock);
  insertBlockRef.current = onInsertBlock;
  const paletteRef = useRef<{ type: BlockType; label: string; pointerId: number } | null>(null);
  const overRef = useRef(false);
  const palIndexRef = useRef<number | null>(null);

  // The TikTok profile (avatar / username / bio) is permanently pinned to
  // the top of the phone preview. It can be clicked to edit but never
  // dragged, and nothing may be dropped above or over it.
  const profileId = designer.blocks.find((b) => b.type === 'profile')?.id ?? null;
  const lockedTopCount = profileId ? 1 : 0;
  const lockedTopRef = useRef(lockedTopCount);
  lockedTopRef.current = lockedTopCount;

  /** Starts a palette drag. Called from the left panel on pointer down so the
      whole gesture (cross-panel) is tracked in one place. */
  useEffect(() => {
    const move = (ev: PointerEvent) => {
      const p = paletteRef.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      const root = contentRef.current;
      if (!root) return;
      const r = root.getBoundingClientRect();
      // Only treat as "over" when the pointer is inside the content column.
      const inside =
        ev.clientX >= r.left - 24 &&
        ev.clientX <= r.right + 24 &&
        ev.clientY >= r.top - 24 &&
        ev.clientY <= r.bottom + 24;
      const changed = inside !== overRef.current;
      overRef.current = inside;
      if (changed) setOverPhone(inside);
      if (!inside) {
        palIndexRef.current = null;
        setPaletteIndex(null);
        return;
      }
      const idx = indexFromPoint(ev.clientY, '');
      if (idx !== palIndexRef.current) {
        palIndexRef.current = idx;
        setPaletteIndex(idx);
      }
    };
    const up = (ev: PointerEvent) => {
      const p = paletteRef.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      paletteRef.current = null;
      const inside = overRef.current;
      const idx = palIndexRef.current;
      overRef.current = false;
      palIndexRef.current = null;
      setPaletteDrag(null);
      setOverPhone(false);
      setPaletteIndex(null);
      // Only create when released inside the phone — never above the locked profile.
      if (inside && insertBlockRef.current) insertBlockRef.current(p.type, Math.max(lockedTopRef.current, idx ?? designer.blocks.length));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [designer.blocks.length]);

  /** Palette drags start on the left panel, which lives outside the phone, so
      the pointerdown listener sits on the window and filters to palette cards. */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const card = (e.target as HTMLElement)?.closest?.('[data-palette-type]') as HTMLElement | null;
      if (!card) return;
      const type = card.dataset.paletteType as BlockType;
      const label = card.dataset.paletteLabel || type;
      paletteRef.current = { type, label, pointerId: e.pointerId };
      overRef.current = false;
      palIndexRef.current = null;
      setPaletteDrag({ type, label });
      setOverPhone(false);
      setPaletteIndex(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);
  const blocksRef = useRef<Block[]>(designer.blocks);
  blocksRef.current = designer.blocks;

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

  const cls = (key: string, extra = '', locked = false) =>
    `pv-block ${extra}${hoverKey === key ? ' is-hover' : ''}${selectedKey === key ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`.trim();

  const canReorder = interactive && (!!onMoveBlockAt || !!onMoveBlock);

  /** Insertion index from the pointer position: first block (excluding the
      dragged one) whose vertical midpoint sits below the pointer wins. */
  function setInsert(v: number | null) {
    insertPosRef.current = v;
    setInsertIndex(v);
  }

  function indexFromPoint(clientY: number, draggedId: string): number {
    const root = contentRef.current;
    const fallback = blocksRef.current.filter((b) => b.id !== draggedId).length;
    // The locked profile always occupies index 0 — insertion can never
    // target anything above or overlapping it.
    const minIndex = lockedTopCount;
    if (!root) return Math.max(minIndex, fallback);
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]')).filter(
      (el) => el.dataset.blockId !== draggedId
    );
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return Math.max(minIndex, i);
    }
    return Math.max(minIndex, els.length);
  }

  function updateGhost(clientX: number, clientY: number, label: string, w: number) {
    const phone = phoneRef.current;
    if (!phone) {
      setGhost({ x: clientX, y: clientY, w, label });
      return;
    }
    const r = phone.getBoundingClientRect();
    const gw = Math.min(w, r.width - 24);
    const gh = 44;
    const x = Math.max(r.left + 12, Math.min(clientX - gw / 2, r.right - gw - 12));
    const y = Math.max(r.top + 40, Math.min(clientY - gh / 2, r.bottom - gh - 12));
    setGhost({ x, y, w: gw, label });
  }

  function autoScrollScreen(clientY: number) {
    const sc = screenRef.current;
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    if (clientY < r.top + 56) sc.scrollTop -= 10;
    else if (clientY > r.bottom - 56) sc.scrollTop += 10;
  }

  /** Pointer-based reorder: any section except the locked profile can be
      grabbed anywhere (mouse) and dropped at any insertion index below the
      profile. Only the ghost follows the pointer — the page itself never
      shifts with the mouse. */
  function beginPotentialDrag(e: React.PointerEvent, id: string, label: string) {
    if (!interactive || !canReorder || e.button !== 0) return;
    // Locked profile: never draggable, by body or by grip.
    if (id === profileId) return;
    const target = e.target as HTMLElement;
    // Let form controls keep their native behaviour.
    if (target.closest('input, textarea, select, button, a')) {
      // The grip is an explicit drag affordance even over buttons.
      if (!target.closest('.pv-grip')) return;
    }
    // On touch, require the grip so vertical scrolling still works.
    if (e.pointerType !== 'mouse' && !target.closest('.pv-grip')) return;
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      label,
      w: Math.max(160, el.width),
    };
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      if (!d.active) {
        if (Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 7) return;
        d.active = true;
        suppressPick.current = true;
        setDragId(d.id);
        setInsert(indexFromPoint(ev.clientY, d.id));
        updateGhost(ev.clientX, ev.clientY, d.label, d.w);
        return;
      }
      autoScrollScreen(ev.clientY);
      setInsert(indexFromPoint(ev.clientY, d.id));
      updateGhost(ev.clientX, ev.clientY, d.label, d.w);
    };
    const up = (ev: PointerEvent) => {
      const d = dragRef.current;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      dragRef.current = null;
      if (!d || ev.pointerId !== d.pointerId) {
        setDragId(null);
        setInsertIndex(null);
        setGhost(null);
        return;
      }
      if (d.active) {
        let to: number;
        try {
          to = indexFromPoint(ev.clientY, d.id);
        } catch {
          to = insertPosRef.current ?? blocksRef.current.filter((b) => b.id !== d.id).length;
        }
        // Never allow a drop above or on the locked profile (index 0),
        // and never allow the locked profile itself to be moved.
        if (d.id === profileId) {
          setDragId(null);
          setInsertIndex(null);
          setGhost(null);
          return;
        }
        const without = blocksRef.current.filter((b) => b.id !== d.id);
        const clamped = Math.max(lockedTopCount, Math.min(to, without.length));
        const before = blocksRef.current.map((b) => b.id).join('|');
        const trial = without.map((b) => b.id);
        trial.splice(clamped, 0, d.id);
        if (trial.join('|') !== before) {
          if (moveAtRef.current) moveAtRef.current(d.id, clamped);
          else if (moveRef.current) {
            if (clamped >= without.length) {
              // Legacy path inserts before target: move to end by placing
              // after the last block via two ordered moves is unnecessary —
              // placing before last then relying on post-removal order still
              // moves forward. Fall back to before-last for progress.
              const last = without[without.length - 1];
              if (last) moveRef.current(d.id, last.id);
            } else {
              const target = without[clamped];
              if (target) moveRef.current(d.id, target.id);
            }
          }
        }
      }
      setDragId(null);
      setInsertIndex(null);
      setGhost(null);
      window.setTimeout(() => {
        suppressPick.current = false;
      }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /** Edge-drag resizes the phone width only; height never changes. */
  function onResizeDown(e: React.PointerEvent<HTMLSpanElement>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    resizeRef.current = { startX: e.clientX, baseW: width ?? 292, pointerId: e.pointerId };
  }

  function onResizeMove(e: React.PointerEvent<HTMLSpanElement>) {
    const r = resizeRef.current;
    if (!r || e.pointerId !== r.pointerId) return;
    // Keep the phone inside its centred right column so it never pushes
    // into the divider or overflows at smaller window sizes.
    onWidthChange?.(Math.max(240, Math.min(360, r.baseW + (e.clientX - r.startX))));
  }

  function endResize(e: React.PointerEvent<HTMLSpanElement>) {
    const r = resizeRef.current;
    if (!r || e.pointerId !== r.pointerId) return;
    resizeRef.current = null;
  }

  const bind = (key: string) =>
    interactive
      ? {
          onMouseEnter: () => onHover?.(key),
          onMouseLeave: () => onHover?.(null),
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            if (suppressPick.current) return;
            // A drag that just ended must not trigger an edit.
            if (dragId) return;
            onPick?.(key);
          },
        }
      : {};

  function blockLabel(b: Block): string {
    return b.title || b.type;
  }

  function BlockWrap({ id, blockKey, extra, label, locked, children }: { id: string; blockKey: string; extra?: string; label?: string; locked?: boolean; children: React.ReactNode }) {
    const dragLabel = label || blockLabel(blocksRef.current.find((b) => b.id === id) ?? { id, type: 'text' as const, title: id });
    const isLocked = locked ?? id === profileId;
    return (
      <div
        data-block-id={id}
        data-locked={isLocked ? 'true' : undefined}
        title={isLocked ? 'Profile is locked at the top' : undefined}
        className={cls(blockKey, extra ?? '', isLocked)}
        {...bind(blockKey)}
        style={canReorder && !isLocked ? { touchAction: 'pan-y' } : undefined}
        onPointerDown={isLocked ? undefined : (e) => beginPotentialDrag(e, id, dragLabel)}
      >
        {interactive && canReorder && !isLocked && (
          <span
            className="pv-grip"
            aria-hidden="true"
            title="Drag to move section"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              // Let the root handler own the gesture; stop bubbling so a
              // nested inner element doesn't start a second gesture.
              e.stopPropagation();
              const root = (e.currentTarget as HTMLElement).closest('[data-block-id]');
              if (root) {
                const evt = { ...e, currentTarget: root, target: e.target } as unknown as React.PointerEvent;
                beginPotentialDrag(evt, id, dragLabel);
              }
            }}
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
          <BlockWrap key={block.id} id={block.id} blockKey={key} extra="pv-profile" locked>
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
      case 'divider':
        return (
          <BlockWrap key={block.id} id={block.id} blockKey={key} extra="pv-divider">
            <span style={{ height: Math.max(4, Math.min(160, block.height ?? 24)) }} aria-hidden="true" />
          </BlockWrap>
        );
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

  // Ordered render with a live insertion line while dragging. The dragged
  // block leaves the flow so siblings collapse around the gap.
  function renderBlocksInFlow(): React.ReactNode {
    const palLine =
      paletteDrag && overPhone && paletteIndex !== null ? (
        <div key="__palette-line__" className="pv-drop-line pv-drop-line--new" aria-hidden="true">
          <i />
          <span>Place {paletteDrag.label}</span>
        </div>
      ) : null;

    // Reorder an existing section — the drop line can never render above
    // or overlapping the locked profile.
    if (dragId && insertIndex !== null) {
      if (dragId === profileId) return designer.blocks.map(renderBlock);
      const rest = designer.blocks.filter((b) => b.id !== dragId);
      const safeInsert = Math.max(lockedTopCount, insertIndex);
      const out: React.ReactNode[] = [];
      const line = (
        <div key="__drop-line__" className="pv-drop-line" aria-hidden="true">
          <i />
          <span>Drop here</span>
        </div>
      );
      for (let i = 0; i <= rest.length; i++) {
        if (i === safeInsert) out.push(line);
        if (i < rest.length) out.push(renderBlock(rest[i]));
      }
      if (rest.length === 0) {
        out.push(
          <div key="__drop-empty__" className="pv-empty-drop">
            Drag a section here
          </div>
        );
      }
      return out;
    }

    // Drop a new section from the palette — never above the locked profile.
    if (palLine) {
      const safePalette = Math.max(lockedTopCount, paletteIndex);
      const out: React.ReactNode[] = [];
      for (let i = 0; i <= designer.blocks.length; i++) {
        if (i === safePalette) out.push(palLine);
        if (i < designer.blocks.length) out.push(renderBlock(designer.blocks[i]));
      }
      return out;
    }

    if (paletteDrag && !overPhone) {
      return [
        ...designer.blocks.map(renderBlock),
        <div key="__drop-hint__" className="pv-drop-hint">
          Drop inside the phone to add “{paletteDrag.label}”
        </div>,
      ];
    }

    return designer.blocks.map(renderBlock);
  }

  return (
    <div
      ref={phoneRef}
      className={`pv-phone${dragId ? ' is-dragging' : ''}${paletteDrag ? ' is-palette-drag' : ''}${overPhone ? ' is-drop-over' : ''}`}
      aria-label="Live preview of your public page"
      style={width ? { width } : undefined}
    >
      <div className="pv-notch" aria-hidden="true" />
      <div
        ref={screenRef}
        className={`pv-screen${t.bgAnimated && t.bgMode === 'gradient' ? ' is-animated' : ''}`}
        style={{ fontFamily: font, color: t.textColor }}
      >
        <div className="pv-bg" style={bgLayerStyle} aria-hidden="true" />
        {paletteDrag && (
          <div className="pv-dropzone" aria-hidden="true">
            <span>
              <Plus size={15} />
              {overPhone ? `Release to place “${paletteDrag.label}”` : `Drag “${paletteDrag.label}” into the phone`}
            </span>
          </div>
        )}
        <div
          ref={contentRef}
          className={`pv-content${paletteDrag ? ' is-receiving' : ''}`}
          onClick={() => {
            if (suppressPick.current) return;
            if (dragId) return;
            if (paletteDrag) return;
            if (interactive) onClear?.();
          }}
        >
          {renderBlocksInFlow()}
          <p className="pv-powered">Made with Launchly</p>
        </div>
      </div>
      {dragId && ghost && (
        <div className="pv-ghost" style={{ left: ghost.x, top: ghost.y, width: ghost.w }} aria-hidden="true">
          <GripVertical size={13} />
          <span>{ghost.label}</span>
        </div>
      )}      {interactive && (
        <span
          className="pv-resize"
          title="Drag left or right to resize"
          aria-hidden="true"
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
