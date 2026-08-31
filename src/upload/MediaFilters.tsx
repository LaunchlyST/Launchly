import React, { useCallback, useEffect, useRef, useState } from 'react';

export type MediaCategory = 'all' | 'video' | 'image' | 'audio' | 'generated';

const CATEGORIES: { id: MediaCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Images' },
  { id: 'audio', label: 'Audio' },
  { id: 'generated', label: 'Generated' },
];

interface MediaFiltersProps {
  category: MediaCategory;
  onCategoryChange: (category: MediaCategory) => void;
  counts: Record<MediaCategory, number>;
}

/**
 * Category tab strip. Keeps every tab at its natural width and scrolls
 * sideways when the strip outgrows the panel — a vertical wheel and a drag
 * both pan it, since a plain mouse has no horizontal wheel.
 */
export function MediaFilters({ category, onCategoryChange, counts }: MediaFiltersProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  /** Which sides still have tabs off-screen — drives the edge fades. */
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });

  const measureTabs = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setTabOverflow({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  }, []);

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

  return (
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
            onCategoryChange(c.id);
          }}
        >
          {c.label}
          {counts[c.id] > 0 && <span className="media-tab__count">{counts[c.id]}</span>}
        </button>
      ))}
    </div>
  );
}
