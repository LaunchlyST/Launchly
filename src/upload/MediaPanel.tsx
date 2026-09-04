import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  X,
  Film,
} from 'lucide-react';
import { Clip } from '../editor-types/editorTypes';
import { MediaItem } from './MediaItem';
import { FloatingComposer } from '../ai-chat/FloatingComposer';

type MediaCategory = 'all' | 'video' | 'image' | 'audio' | 'generated';
type MediaView = 'grid' | 'list';

interface MediaPanelProps {
  clips: Clip[];
  onUpload: (files: FileList | null) => void;
  onDragStart: (e: React.DragEvent, clip: Clip) => void;
  onDelete?: (clip: Clip) => void;
  onSelectMedia?: (clip: Clip) => void;
  selectedClipIds?: string[];
  /** Add a library item straight to the timeline (used by the hover action). */
  onAddToTimeline?: (clip: Clip) => void;
  /** Rename a library item. */
  onRename?: (clip: Clip, name: string) => void;
  // AI props
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  aiModel: string;
  onAiModelChange: (v: string) => void;
  onAiSend: () => void;
}

const CATEGORIES: { id: MediaCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Images' },
  { id: 'audio', label: 'Audio' },
  { id: 'generated', label: 'Generated' },
];

const ACCEPTED_HINT = 'MP4, MOV, PNG, JPG, WAV, MP3';

export function MediaPanel({
  clips,
  onUpload,
  onDragStart,
  onDelete,
  onSelectMedia,
  selectedClipIds,
  onAddToTimeline,
  onRename,
  aiPrompt,
  onAiPromptChange,
  aiModel,
  onAiModelChange,
  onAiSend,
}: MediaPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  /** Which sides still have tabs off-screen — drives the edge fades. */
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });
  const [category, setCategory] = useState<MediaCategory>('all');
  const [view, setView] = useState<MediaView>('list');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  /** Recomputes which edge fades to show. */
  const measureTabs = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setTabOverflow({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  }, []);

  /**
   * A vertical wheel over the tab strip scrolls it sideways — otherwise a
   * plain mouse (no horizontal wheel) could never reach the last tabs.
   */
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      // Only claim the gesture while there is somewhere left to go, so the
      // panel can still scroll vertically once the strip hits an end.
      const next = el.scrollLeft + delta;
      if ((delta < 0 && el.scrollLeft > 0) || (delta > 0 && el.scrollLeft < max)) {
        e.preventDefault();
        el.scrollLeft = Math.max(0, Math.min(max, next));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', measureTabs);
    // The panel can be resized without the window changing, so watch the
    // strip itself — otherwise the fades go stale.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureTabs) : null;
    ro?.observe(el);
    measureTabs();
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', measureTabs);
      ro?.disconnect();
    };
  }, [measureTabs]);

  /**
   * Drag the strip sideways like a scroller. Grabbing anywhere on the strip —
   * including on a tab — pans it; a tab only activates if you did not drag,
   * so a scroll gesture never changes the filter by accident.
   */
  const tabDrag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);

  const onTabsPointerDown = (e: React.PointerEvent) => {
    const el = tabsRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    tabDrag.current = { x: e.clientX, scroll: el.scrollLeft, moved: false };
    el.classList.add('is-dragging');

    const move = (ev: PointerEvent) => {
      const d = tabDrag.current;
      if (!d || !tabsRef.current) return;
      const dx = ev.clientX - d.x;
      if (Math.abs(dx) > 3) d.moved = true;
      // Dragging left moves the content left, like grabbing a sheet of paper.
      tabsRef.current.scrollLeft = d.scroll - dx;
    };
    const up = () => {
      tabsRef.current?.classList.remove('is-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      // Let the click that follows be swallowed before clearing the flag.
      window.setTimeout(() => { tabDrag.current = null; }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Keeps the selected tab in view when it is changed by keyboard. */
  useEffect(() => {
    const el = tabsRef.current;
    const active = el?.querySelector<HTMLElement>('.media-tab.is-active');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measureTabs();
  }, [category, measureTabs]);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpload(e.target.files);
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };

  const hasMedia = clips.length > 0;

  const counts = useMemo(() => {
    const c: Record<MediaCategory, number> = { all: clips.length, video: 0, image: 0, audio: 0, generated: 0 };
    for (const clip of clips) {
      if (clip.type === 'video') c.video += 1;
      else if (clip.type === 'image') c.image += 1;
      else if (clip.type === 'audio') c.audio += 1;
      if ((clip as any).generated || (clip as any).aiGenerated) c.generated += 1;
    }
    return c;
  }, [clips]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clips.filter((clip) => {
      if (category === 'generated' && !((clip as any).generated || (clip as any).aiGenerated)) return false;
      if (category !== 'all' && category !== 'generated' && clip.type !== category) return false;
      if (q && !clip.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clips, category, search]);

  return (
    <div className="media-panel">
      <div className="media-panel__top">
        <div className="media-panel__header">
          <h2 className="media-panel__title">Media</h2>
          <span className="media-panel__count-pill">{clips.length}</span>
        </div>

        {/* Compact toolbar */}
        <div className="media-panel__toolbar">
          <button className="media-tool-btn media-tool-btn--primary" onClick={handleUploadClick} title="Upload media">
            <Upload size={13} strokeWidth={2.2} />
            <span>Upload</span>
          </button>
          <div className="media-panel__toolbar-spacer" />
          <button
            className={`media-tool-btn media-tool-btn--icon ${searchOpen ? 'is-active' : ''}`}
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSearch('');
            }}
            title="Search media"
            aria-label="Search media"
          >
            <Search size={14} />
          </button>
          <div className="media-panel__view-toggle" role="group" aria-label="Media view">
            <button
              className={`media-view-btn ${view === 'grid' ? 'is-active' : ''}`}
              onClick={() => setView('grid')}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid size={13} />
            </button>
            <button
              className={`media-view-btn ${view === 'list' ? 'is-active' : ''}`}
              onClick={() => setView('list')}
              title="List view"
              aria-label="List view"
            >
              <ListIcon size={13} />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="media-panel__search">
            <Search size={13} className="media-panel__search-icon" />
            <input
              autoFocus
              className="media-panel__search-input"
              placeholder="Search media…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="media-panel__search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Category tabs — scroll sideways when they outgrow the panel */}
        <div
          className={`media-panel__tabs ${tabOverflow.left ? 'has-left' : ''} ${tabOverflow.right ? 'has-right' : ''}`}
          ref={tabsRef}
          onScroll={measureTabs}
          onPointerDown={onTabsPointerDown}
          role="tablist"
          aria-label="Media categories"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              className={`media-tab ${category === c.id ? 'is-active' : ''}`}
              onClick={() => {
                // A pan gesture must not also switch the filter.
                if (tabDrag.current?.moved) return;
                setCategory(c.id);
              }}
            >
              {c.label}
              {counts[c.id] > 0 && <span className="media-tab__count">{counts[c.id]}</span>}
            </button>
          ))}
        </div>

        {!hasMedia ? (
          <div
            className={`media-panel__empty ${isDragOver ? 'is-dragover' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleUploadClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleUploadClick();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload media — click or drag files here"
          >
            <div className="media-panel__upload-icon">
              <Upload size={24} strokeWidth={1.9} />
            </div>
            <p className="media-panel__empty-title">Upload media</p>
            <p className="media-panel__empty-hint">Video, images or audio</p>
            <p className="media-panel__empty-formats">{ACCEPTED_HINT}</p>
            <button
              className="media-panel__cta"
              onClick={(e) => {
                e.stopPropagation();
                handleUploadClick();
              }}
            >
              <Upload size={13} strokeWidth={2.2} />
              Choose files
            </button>
            <span className="media-panel__drop-hint">or drag &amp; drop here</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="media-panel__no-results" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
            <Film size={20} />
            <p>No media in this view</p>
            <button className="media-panel__link-btn" onClick={() => { setCategory('all'); setSearch(''); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div
            className={`media-panel__list media-panel__list--${view} ${isDragOver ? 'is-dragover' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {filtered.map((clip) => (
              <MediaItem
                key={clip.id}
                clip={clip}
                view={view}
                onDragStart={onDragStart}
                onDelete={onDelete}
                onSelect={onSelectMedia}
                onAddToTimeline={onAddToTimeline}
                onRename={onRename}
                isSelected={selectedClipIds?.includes(clip.id)}
              />
            ))}
            {isDragOver && <div className="media-panel__drop-overlay"><Plus size={18} /> Drop to add</div>}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*,audio/*"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>

      <div className="media-panel__ai">
        <FloatingComposer
          value={aiPrompt}
          onChange={onAiPromptChange}
          model={aiModel}
          onModelChange={onAiModelChange}
          onSend={onAiSend}
        />
      </div>
    </div>
  );
}
