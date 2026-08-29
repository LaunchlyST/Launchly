import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Film,
  Image as ImageIcon,
  Music,
  MoreHorizontal,
  Pencil,
  Trash2,
  Info,
  Sparkles,
} from 'lucide-react';
import { Clip } from '../editor-types/editorTypes';

interface MediaItemProps {
  clip: Clip;
  view?: 'grid' | 'list';
  onDragStart: (e: React.DragEvent, clip: Clip) => void;
  onSelect?: (clip: Clip) => void;
  isSelected?: boolean;
  onDelete?: (clip: Clip) => void;
  onAddToTimeline?: (clip: Clip) => void;
  onRename?: (clip: Clip, name: string) => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TYPE_LABEL: Record<string, string> = { video: 'Video', image: 'Image', audio: 'Audio', text: 'Text' };

export function MediaItem({
  clip,
  view = 'list',
  onDragStart,
  onSelect,
  isSelected,
  onDelete,
  onAddToTimeline,
  onRename,
}: MediaItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /**
   * The menu is rendered into <body> rather than inside the card: the media
   * list scrolls and every card makes its own stacking context, so an in-flow
   * menu was being clipped and painted under neighbouring cards.
   */
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const placeMenu = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = 176;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
    setMenuPos({ top: r.bottom + 6, left });
  }, []);
  const isGenerated = !!((clip as any).generated || (clip as any).aiGenerated);

  useLayoutEffect(() => {
    if (menuOpen) placeMenu();
  }, [menuOpen, placeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    // Anything that moves the trigger closes the menu rather than leaving it stranded.
    const dismiss = () => setMenuOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', dismiss);
    document.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('scroll', dismiss, true);
    };
  }, [menuOpen]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const handleRename = (e: React.MouseEvent) => {
    stop(e);
    setMenuOpen(false);
    const next = window.prompt('Rename media', clip.name);
    if (next && next.trim() && next !== clip.name) onRename?.(clip, next.trim());
  };

  const handleInfo = (e: React.MouseEvent) => {
    stop(e);
    setMenuOpen(false);
    const lines = [
      `Name: ${clip.name}`,
      `Type: ${TYPE_LABEL[clip.type] ?? clip.type}`,
      `Duration: ${formatDuration(clip.duration)}`,
      clip.width && clip.height ? `Dimensions: ${clip.width}×${clip.height}` : null,
    ].filter(Boolean);
    window.alert(lines.join('\n'));
  };

  const Icon = clip.type === 'video' ? Film : clip.type === 'image' ? ImageIcon : Music;

  return (
    <div
      className={`media-item-card media-item-card--${view} ${isSelected ? 'selected' : ''} ${menuOpen ? 'menu-open' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, clip)}
      onClick={() => onSelect?.(clip)}
      onDoubleClick={() => onAddToTimeline?.(clip)}
      title={`Drag to timeline — ${clip.name}`}
    >
      <div className={`media-item-card__thumb media-item-card__thumb--${clip.type}`}>
        {clip.thumbnail ? (
          <img src={clip.thumbnail} alt={clip.name} className="media-item-card__img" />
        ) : (
          <Icon size={view === 'grid' ? 20 : 16} />
        )}
        {clip.type === 'audio' && clip.waveform && clip.waveform.length > 0 && (
          <div className="media-item-card__wave-mini">
            {clip.waveform.slice(0, 20).map((v, i) => (
              <span key={i} style={{ height: `${Math.max(3, v * 100)}%` }} />
            ))}
          </div>
        )}
        {(clip.type === 'video' || clip.type === 'audio') && (
          <span className="media-item-card__badge">{formatDuration(clip.duration)}</span>
        )}
        {isGenerated && (
          <span className="media-item-card__ai-badge" title="AI generated">
            <Sparkles size={9} />
          </span>
        )}
      </div>

      <div className="media-item-card__info">
        <span className="media-item-card__name" title={clip.name}>
          {clip.name}
        </span>
        <span className="media-item-card__meta">
          {TYPE_LABEL[clip.type] ?? clip.type}
          {clip.width && clip.height ? ` · ${clip.width}×${clip.height}` : ''}
        </span>
      </div>

      {/* Hover actions — drag or double-click adds to the timeline. */}
      <div className="media-item-card__actions" onClick={stop}>
        <div className="media-item-card__menu-wrap">
          <button
            ref={triggerRef}
            className="media-item-card__action"
            onClick={(e) => {
              stop(e);
              setMenuOpen((v) => !v);
            }}
            title="More"
            aria-label="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen &&
            menuPos &&
            createPortal(
              <div
                className="media-menu"
                role="menu"
                ref={menuRef}
                style={{ top: menuPos.top, left: menuPos.left }}
                onClick={stop}
              >
                <button className="media-menu__item" role="menuitem" onClick={handleRename}>
                  <Pencil size={13} /> Rename
                </button>
                <button className="media-menu__item" role="menuitem" onClick={handleInfo}>
                  <Info size={13} /> File information
                </button>
                {onDelete && (
                  <>
                    <div className="media-menu__sep" />
                    <button
                      className="media-menu__item media-menu__item--danger"
                      role="menuitem"
                      onClick={(e) => {
                        stop(e);
                        setMenuOpen(false);
                        onDelete(clip);
                      }}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </>
                )}
              </div>,
              document.body
            )}
        </div>
      </div>
    </div>
  );
}
