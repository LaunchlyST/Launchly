import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { Clip, Track } from '../editor-types/editorTypes';
import { TimelineTrack } from './TimelineTrack';
import { CurvedZoomSlider } from './CurvedZoomSlider';
import { sound } from '../sound/sound';
import { useEditorStore } from '../editor-state/editorStore';
import {
  secondsForZoomValue,
  zoomValueForSeconds,
  formatZoomLabel,
  formatZoomVerbose,
  colorForZoomValue,
  colorForZoomValueAlpha,
  nextExtendedDuration,
  prevExtendedDuration,
  isExtended,
  stepNormalStage,
  extendedProgress,
  MIN_SECONDS,
  NORMAL_MAX_SECONDS,
} from './timelineZoom';

/** Width of the fixed track-label gutter on the left of the lanes. */
const TRACK_LABEL_WIDTH = 120;

interface TimelineProps {
  clips: Clip[];
  tracks: Track[];
  selectedClipIds: string[];
  currentTime: number;
  duration: number;
  isMuted: boolean;
  onClipsChange: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;
  onTracksChange?: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  onSelectionChange: (ids: string[]) => void;
  onTimeChange: (time: number) => void;
  /** `trackId` is the lane dropped on; `null` asks for a brand-new lane. */
  onDropMedia: (clip: Clip, dropTime: number, trackId?: string | null) => void;
}

export function Timeline({ clips, tracks, selectedClipIds, currentTime, duration, isMuted, onClipsChange, onTracksChange, onSelectionChange, onTimeChange, onDropMedia }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { timelineZoomValue, setTimelineZoomValue, timelineVisibleSeconds, setTimelineVisibleSeconds, timelineExtendedUnlocked, setTimelineExtendedUnlocked, setTimelineFeedback, addToast } = useEditorStore() as any;

  // `visibleSeconds` is the source of truth: how much timeline TIME fits in the
  // viewport. The slider position is derived from it, and is pinned at 100 once
  // the duration passes the normal 1h maximum (extended mode steps beyond).
  const visibleSeconds = timelineVisibleSeconds ?? secondsForZoomValue(timelineZoomValue ?? 37);
  const extended = isExtended(visibleSeconds);
  const zoomValue = extended ? 100 : zoomValueForSeconds(visibleSeconds);

  // Measure the lane viewport so pixels-per-second is real, not assumed.
  const [viewportWidth, setViewportWidth] = useState(700);
  const measureViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = el.clientWidth - TRACK_LABEL_WIDTH;
    // Ignore zero/negative readings from a not-yet-laid-out panel; latching on
    // one of those used to freeze the scale for the life of the component.
    if (next <= 0) return;
    setViewportWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
  }, []);

  // Runs after every render, so the scale re-converges even if the observer
  // below never fires (hidden panel on mount, layout settling late, …).
  useLayoutEffect(measureViewport);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    window.addEventListener('resize', measureViewport);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measureViewport);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', measureViewport);
      ro?.disconnect();
    };
  }, [measureViewport]);

  useEffect(
    () => () => {
      if (rescaleTimerRef.current) window.clearTimeout(rescaleTimerRef.current);
      if (limitTimerRef.current) window.clearTimeout(limitTimerRef.current);
      if (limitExitTimerRef.current) window.clearTimeout(limitExitTimerRef.current);
      confirmTimersRef.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  /**
   * The chosen duration is the spacing between major gridlines, and this many
   * of them fit across the view. Pick 2h and the ruler reads 0, 2h, 4h, 6h… —
   * the number on the control is the number you see stepping along the top.
   */
  const DIVISIONS_ON_SCREEN = 4;
  const divisionSeconds = Math.max(MIN_SECONDS, visibleSeconds);
  const pixelsPerSecond = viewportWidth / DIVISIONS_ON_SCREEN / divisionSeconds;
  // Keep going well past the edge of the view so the sequence continues as you
  // scroll rather than stopping at the last gridline on screen.
  const timelineSpan = Math.max(duration || 0, divisionSeconds * DIVISIONS_ON_SCREEN * 2);
  const contentWidth = Math.max(timelineSpan * pixelsPerSecond, viewportWidth);
  // The playhead may go anywhere the ruler reaches — not just to the end of the
  // media — so an empty or short project can still be scrubbed across the view.
  const scrubLimit = timelineSpan;
  const scrubLimitRef = useRef(scrubLimit);
  scrubLimitRef.current = scrubLimit;

  /**
   * A drag registers its pointermove listener once, so any handler it calls
   * would otherwise close over the zoom state as it was when the drag started.
   * These refs keep the edge handlers reading live values mid-drag.
   */
  const zoomStateRef = useRef({ visibleSeconds, extended, unlocked: !!timelineExtendedUnlocked });
  zoomStateRef.current = { visibleSeconds, extended, unlocked: !!timelineExtendedUnlocked };

  const [dragState, setDragState] = useState<{
    type: 'move' | 'trim' | null;
    clipId: string | null;
    edge: 'left' | 'right' | null;
    startX: number;
    startTime: number;
    startDuration: number;
  }>({ type: null, clipId: null, edge: null, startX: 0, startTime: 0, startDuration: 0 });

  const [isDragOver, setIsDragOver] = useState(false);
  /** Lane currently under the dragged media: a track id, or 'new' for the +. */
  const [dropLaneId, setDropLaneId] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [trimLimitId, setTrimLimitId] = useState<string | null>(null);
  const lastTrimTickRef = useRef(0);
  const [showExtendedConfirm, setShowExtendedConfirm] = useState(false);
  /**
   * The confirm sits in the control row, immediately beside the duration
   * readout it is about. It never floats over the timeline, so nothing is
   * hidden behind it while it is up.
   */
  const [confirmLeaving, setConfirmLeaving] = useState(false);
  const zoombarRef = useRef<HTMLDivElement>(null);
  const confirmTimersRef = useRef<number[]>([]);

  const clearConfirmTimers = useCallback(() => {
    confirmTimersRef.current.forEach((t) => window.clearTimeout(t));
    confirmTimersRef.current = [];
  }, []);

  const closeConfirm = useCallback(() => {
    clearConfirmTimers();
    setShowExtendedConfirm(false);
    setConfirmLeaving(false);
  }, [clearConfirmTimers]);

  /** Length of the fade-out, kept in sync with the CSS exit transition. */
  const CONFIRM_EXIT_MS = 260;

  /** Open the confirm beside the duration readout. */
  const openConfirm = useCallback(() => {
    clearConfirmTimers();
    setConfirmLeaving(false);
    setShowExtendedConfirm(true);
    // Left alone for 3s → fade out, leaving the normal limit in place.
    confirmTimersRef.current.push(
      window.setTimeout(() => setConfirmLeaving(true), 3000),
      window.setTimeout(() => closeConfirm(), 3000 + CONFIRM_EXIT_MS)
    );
  }, [clearConfirmTimers, closeConfirm]);

  /** Any interaction cancels the auto-dismiss. */
  const holdConfirm = useCallback(() => {
    clearConfirmTimers();
    setConfirmLeaving(false);
  }, [clearConfirmTimers]);

  /**
   * Limit feedback. Hitting a limit shows a red error for 3s; moving back
   * inside the limit turns it green immediately rather than waiting that out.
   */
  const [limitFeedback, setLimitFeedback] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const limitFeedbackRef = useRef<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [zoomDragging, setZoomDragging] = useState(false);
  const [isRescaling, setIsRescaling] = useState(false);
  const rescaleTimerRef = useRef<number | null>(null);
  const limitTimerRef = useRef<number | null>(null);
  const limitExitTimerRef = useRef<number | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const autoScrollRef = useRef<number | null>(null);
  const scrubClientXRef = useRef<number>(0);

  /** Length of the fade-out, kept in sync with the CSS exit transition. */
  const FEEDBACK_EXIT_MS = 320;

  const setFeedback = useCallback(
    (next: { kind: 'error' | 'ok'; text: string } | null, holdMs: number) => {
      if (limitTimerRef.current) window.clearTimeout(limitTimerRef.current);
      if (limitExitTimerRef.current) window.clearTimeout(limitExitTimerRef.current);
      confirmTimersRef.current.forEach((t) => window.clearTimeout(t));
      limitFeedbackRef.current = next;
      setLimitFeedback(next);
      setIsLeaving(false);
      // Mirror it so the preview can ring itself in the matching colour.
      setTimelineFeedback?.(next?.kind ?? null);
      if (!next) return;
      limitTimerRef.current = window.setTimeout(() => {
        // Fade out rather than vanishing: mark it leaving, then unmount.
        setIsLeaving(true);
        setTimelineFeedback?.(null);
        limitExitTimerRef.current = window.setTimeout(() => {
          limitFeedbackRef.current = null;
          setLimitFeedback(null);
          setIsLeaving(false);
        }, FEEDBACK_EXIT_MS);
      }, holdMs);
    },
    [setTimelineFeedback]
  );

  /** Hit a limit — red error, held for 3s. */
  const flashLimit = useCallback(
    (text: string) => {
      setFeedback({ kind: 'error', text }, 3000);
      sound.limit();
    },
    [setFeedback]
  );

  /**
   * Moved back inside the limit while the error was up — go green immediately
   * instead of letting the red sit out its remaining time.
   */
  const clearLimitToOk = useCallback(() => {
    if (limitFeedbackRef.current?.kind !== 'error') return;
    setFeedback({ kind: 'ok', text: 'Back in range' }, 1600);
  }, [setFeedback]);

  /**
   * The playhead simply stops at either end of the timeline. Reaching the wall
   * is not a fault, so nothing is reported — no error state, no colour change.
   */

  const xToTime = useCallback((x: number) => Math.max(0, Math.min(scrubLimit, x / pixelsPerSecond)), [pixelsPerSecond, scrubLimit]);
  const timeToX = useCallback((t: number) => t * pixelsPerSecond, [pixelsPerSecond]);

  // Sync header scroll with timeline scroll
  const handleScroll = useCallback(() => {
    if (scrollRef.current && headerRef.current) {
      headerRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }, []);

  const getTrackForClip = (clip: Clip) => tracks.find((t) => t.id === clip.trackId);

  const handleClipSelect = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation();
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!selectedClipIds.includes(clip.id)) {
      onSelectionChange(additive ? [...selectedClipIds, clip.id] : [clip.id]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, clip: Clip, edge?: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    const track = getTrackForClip(clip);
    if (track?.locked || track?.visible === false) return;
    if ((clip as any).locked) return;
    if (edge) {
      setDragState({ type: 'trim', clipId: clip.id, edge, startX: e.clientX, startTime: clip.timelineStart, startDuration: clip.duration });
      document.body.style.cursor = 'col-resize';
    } else {
      if (!selectedClipIds.includes(clip.id)) {
        const additive = e.shiftKey || e.ctrlKey || e.metaKey;
        onSelectionChange(additive ? [...selectedClipIds, clip.id] : [clip.id]);
      }
      setDragState({ type: 'move', clipId: clip.id, edge: null, startX: e.clientX, startTime: clip.timelineStart, startDuration: clip.duration });
      document.body.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.type || !dragState.clipId) return;
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const clip = clips.find((c) => c.id === dragState.clipId) as any;
      if (!clip) return;
      const track = tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;

      if (dragState.type === 'trim') {
        const isImage = clip.type === 'image';
        const srcDuration = clip.sourceDuration as number | undefined;
        const srcStart = (clip.sourceStart ?? 0) as number;
        if (dragState.edge === 'left') {
          const rawNewStart = dragState.startTime + deltaTime;
          const rawNewDuration = dragState.startTime + dragState.startDuration - rawNewStart;
          const maxDuration = !isImage && srcDuration !== undefined ? srcDuration - (srcStart + (rawNewStart - dragState.startTime)) : Infinity;
          // limit detection for left
          if (!isImage && srcDuration !== undefined) {
            const rawSrcStart = srcStart + (rawNewStart - dragState.startTime);
            if (rawSrcStart < 0 || rawSrcStart + rawNewDuration > srcDuration || rawNewDuration < 0.2) {
              if (trimLimitId !== clip.id) {
                setTrimLimitId(clip.id);
                sound.limit();
                setTimeout(() => setTrimLimitId(null), 420);
              }
            } else if (rawSrcStart < 0.3 || srcDuration - (rawSrcStart + rawNewDuration) < 0.5) {
              if (Date.now() - lastTrimTickRef.current > 140) {
                lastTrimTickRef.current = Date.now();
                sound.tick();
              }
            }
          }
          const newStart = Math.max(0, Math.min(dragState.startTime + dragState.startDuration - 0.2, dragState.startTime + deltaTime));
          let newDuration = dragState.startTime + dragState.startDuration - newStart;
          let newSrcStart = srcStart + (newStart - dragState.startTime);
          if (!isImage && srcDuration !== undefined) {
            if (newSrcStart < 0) {
              const adjust = -newSrcStart;
              newDuration -= adjust;
              newSrcStart = 0;
            }
            if (newSrcStart + newDuration > srcDuration) {
              newDuration = srcDuration - newSrcStart;
            }
          }
          newDuration = Math.max(0.2, newDuration);
          onClipsChange((prev) => prev.map((c) => (c.id === clip.id ? { ...c, timelineStart: newStart, duration: newDuration, sourceStart: newSrcStart, start: newSrcStart } : c)));
        } else {
          const rawNewDuration = dragState.startDuration + deltaTime;
          let newDuration = Math.max(0.2, rawNewDuration);
          if (!isImage && srcDuration !== undefined) {
            const maxDuration = srcDuration - srcStart;
            if (rawNewDuration > maxDuration) {
              if (trimLimitId !== clip.id) {
                setTrimLimitId(clip.id);
                sound.limit();
                setTimeout(() => setTrimLimitId(null), 420);
              }
              newDuration = maxDuration;
            } else if (maxDuration - newDuration < 0.6 && rawNewDuration < maxDuration) {
              // near limit — warm feedback
              if (Date.now() - lastTrimTickRef.current > 140) {
                lastTrimTickRef.current = Date.now();
                sound.tick();
              }
            }
            if (newDuration > maxDuration) newDuration = maxDuration;
          }
          onClipsChange((prev) => prev.map((c) => (c.id === clip.id ? { ...c, duration: newDuration } : c)));
        }
      } else if (dragState.type === 'move') {
        const newStart = Math.max(0, Math.min(duration - clip.duration, dragState.startTime + deltaTime));
        /**
         * A clip follows the pointer onto whichever lane it is over, so moving
         * it to another track is the same gesture as sliding it in time. The
         * lane under the cursor is read from the DOM rather than computed from
         * row heights, so it stays right whatever the rows are doing.
         */
        const laneEl = document
          .elementsFromPoint(e.clientX, e.clientY)
          .find((el) => (el as HTMLElement).dataset?.trackId) as HTMLElement | undefined;
        const overId = laneEl?.dataset.trackId;
        const overTrack = overId ? tracks.find((t) => t.id === overId) : undefined;
        const canMoveTo = overTrack && !overTrack.locked && overTrack.visible !== false && overTrack.id !== clip.trackId;
        if (canMoveTo && overTrack) sound.tick();
        setDropLaneId(canMoveTo ? overTrack!.id : null);
        onClipsChange((prev) =>
          prev.map((c) =>
            c.id === clip.id
              ? { ...c, timelineStart: newStart, ...(canMoveTo ? { trackId: overTrack!.id } : null) }
              : c
          )
        );
      }
    },
    [dragState, clips, tracks, pixelsPerSecond, duration, onClipsChange]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState.type) {
      setDragState({ type: null, clipId: null, edge: null, startX: 0, startTime: 0, startDuration: 0 });
      document.body.style.cursor = '';
    }
    setDropLaneId(null);
    if (isScrubbing) setIsScrubbing(false);
  }, [dragState.type, isScrubbing]);

  const handleScrubMove = useCallback(
    (e: MouseEvent) => {
      if (!isScrubbing || !scrollRef.current) return;
      scrubClientXRef.current = e.clientX;
      const rect = scrollRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left + scrollRef.current.scrollLeft - TRACK_LABEL_WIDTH;
      const rawTime = rawX / pixelsPerSecond;
      // Past either wall the playhead stays pinned to the wall.
      const clampedTime = Math.max(0, Math.min(scrubLimit, rawTime));
      onTimeChange(clampedTime);
    },
    [isScrubbing, onTimeChange, xToTime, pixelsPerSecond, scrubLimit]
  );

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleScrubMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleScrubMove);
    };
  }, [handleMouseMove, handleMouseUp, handleScrubMove]);

  // Auto-scroll while dragging near edges
  useEffect(() => {
    if (!isScrubbing) {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
      return;
    }
    const tick = () => {
      if (!scrollRef.current || !isScrubbing) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const x = scrubClientXRef.current - rect.left;
      const threshold = 64;
      const atLeftWall = currentTime <= 0.001;
      if (x > rect.width - threshold && scrollRef.current.scrollLeft < scrollRef.current.scrollWidth - rect.width - 1) {
        scrollRef.current.scrollLeft = Math.min(scrollRef.current.scrollWidth - rect.width, scrollRef.current.scrollLeft + 7);
        const newX = scrubClientXRef.current - rect.left + scrollRef.current.scrollLeft - TRACK_LABEL_WIDTH;
        onTimeChange(xToTime(Math.max(0, Math.min(scrubLimit * pixelsPerSecond, newX))));
      } else if (x < threshold && scrollRef.current.scrollLeft > 0 && !atLeftWall) {
        scrollRef.current.scrollLeft = Math.max(0, scrollRef.current.scrollLeft - 7);
        const newX = scrubClientXRef.current - rect.left + scrollRef.current.scrollLeft - TRACK_LABEL_WIDTH;
        onTimeChange(xToTime(Math.max(0, newX)));
      }
      autoScrollRef.current = requestAnimationFrame(tick);
    };
    autoScrollRef.current = requestAnimationFrame(tick);
    return () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
    };
  }, [isScrubbing, currentTime, duration, xToTime, onTimeChange]);

  const handleScrubStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsScrubbing(true);
    scrubClientXRef.current = e.clientX;
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left + scrollRef.current.scrollLeft - TRACK_LABEL_WIDTH;
    const rawTime = rawX / pixelsPerSecond;
    const clampedTime = Math.max(0, Math.min(scrubLimit, rawTime));
    onTimeChange(clampedTime);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.timeline-clip')) return;
    const rect = scrollRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current!.scrollLeft - TRACK_LABEL_WIDTH;
    onTimeChange(xToTime(Math.max(0, x)));
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0) - TRACK_LABEL_WIDTH;
    onTimeChange(xToTime(Math.max(0, x)));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    setDropLaneId(null);
    if (!scrollRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };
  /** Where in the timeline a drag event points. */
  const dropTimeFor = (e: React.DragEvent) => {
    const rect = scrollRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current!.scrollLeft - TRACK_LABEL_WIDTH;
    return xToTime(Math.max(0, x));
  };

  /**
   * Drops land on whichever lane the cursor is over. `trackId` of `null` means
   * the "+" lane: put it on a new row of its own.
   */
  const dropOnLane = (e: React.DragEvent, trackId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDropLaneId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/x-launchly-clip'));
      if (!data?.id) return;
      const original = clips.find((c) => c.id === data.id) ?? data;
      onDropMedia(original, dropTimeFor(e), trackId);
    } catch {}
  };

  const handleLaneDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropLaneId(trackId);
  };

  /** Dropped on the timeline but not on a lane — let the app pick the row. */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropLaneId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/x-launchly-clip'));
      if (!data?.id) return;
      const original = clips.find((c) => c.id === data.id) ?? data;
      onDropMedia(original, dropTimeFor(e));
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipIds.length > 0) {
      const hasLocked = clips.some((c) => selectedClipIds.includes(c.id) && (tracks.find((t) => t.id === c.trackId)?.locked || (c as any).locked));
      if (hasLocked) return;
      onClipsChange((prev) => prev.filter((c) => !selectedClipIds.includes(c.id)));
      onSelectionChange([]);
    }
  };

  // Track controls
  const handleToggleVisibility = (trackId: string) => {
    onTracksChange?.((prev) => prev.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t)));
  };
  const handleToggleLock = (trackId: string) => {
    onTracksChange?.((prev) => prev.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)));
  };
  const handleToggleMute = (trackId: string) => {
    onTracksChange?.((prev) => prev.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)));
  };

  const handleClipDoubleClick = (clip: Clip) => {
    if (clip.type !== 'video') return;
    onClipsChange((prev) =>
      prev.map((c) =>
        c.id === clip.id
          ? { ...c, embeddedAudioMuted: !(c as any).embeddedAudioMuted, hasEmbeddedAudio: true } as any
          : c
      )
    );
  };

  /** Commit a new visible duration and let the lanes animate to the new scale. */
  const applyVisibleSeconds = useCallback(
    (seconds: number) => {
      if (Math.abs(seconds - zoomStateRef.current.visibleSeconds) < 0.01) return;
      // The zoom actually moved, so any standing limit error is now resolved.
      clearLimitToOk();
      /**
       * Moving back down the scale answers the question the confirm was
       * asking, so it goes at once rather than sitting out its three seconds.
       * Pushing right again re-opens it.
       */
      if (seconds < zoomStateRef.current.visibleSeconds) closeConfirm();
      setTimelineVisibleSeconds(seconds);
      setTimelineZoomValue(isExtended(seconds) ? 100 : zoomValueForSeconds(seconds));
      // Dropping back below the 1h maximum re-arms the confirmation, so pushing
      // right into extended mode always asks again.
      if (seconds < NORMAL_MAX_SECONDS - 0.5 && zoomStateRef.current.unlocked) {
        setTimelineExtendedUnlocked(false);
      }
      setIsRescaling(true);
      if (rescaleTimerRef.current) window.clearTimeout(rescaleTimerRef.current);
      rescaleTimerRef.current = window.setTimeout(() => setIsRescaling(false), 320);
    },
    [setTimelineVisibleSeconds, setTimelineZoomValue, setTimelineExtendedUnlocked, clearLimitToOk, closeConfirm]
  );

  /** Slider moved within the normal 5s…1h range. */
  const handleZoomChange = useCallback(
    (newValue: number) => {
      applyVisibleSeconds(secondsForZoomValue(newValue));
    },
    [applyVisibleSeconds]
  );

  /** Pushed past the right edge: ask to unlock, or step further into extended mode. */
  const handlePushMax = useCallback(() => {
    const { visibleSeconds: cur, unlocked } = zoomStateRef.current;
    if (!unlocked) {
      if (cur >= NORMAL_MAX_SECONDS - 0.5) {
        openConfirm();
        sound.limit();
      }
      return;
    }
    const next = nextExtendedDuration(cur);
    if (next) {
      applyVisibleSeconds(next);
      sound.tick();
    } else {
      flashLimit('Maximum timeline length reached — 30 days is the longest view');
    }
  }, [applyVisibleSeconds, flashLimit, openConfirm]);

  /** Pushed past the left edge while already at the closest zoom. */
  const handlePushMin = useCallback(() => {
    if (zoomStateRef.current.visibleSeconds <= MIN_SECONDS + 0.01) flashLimit("Maximum zoom reached — you're already at the closest timeline view");
  }, [flashLimit]);

  /**
   * Wheel / trackpad over the control. Steps through extended stages above 1h
   * and falls back to normal slider steps below it — no confirmation needed to
   * come back down, per the one-time-unlock rule.
   */
  const handleWheelStep = useCallback(
    (dir: number, anchorX?: number) => {
      const { visibleSeconds: cur, extended: isExt } = zoomStateRef.current;
      if (dir > 0) {
        if (cur >= NORMAL_MAX_SECONDS - 0.5) {
          handlePushMax();
        } else {
          const next = stepNormalStage(cur, 1);
          if (next) {
            applyVisibleSeconds(next);
            sound.tick();
          }
        }
      } else {
        if (isExt) {
          const prev = prevExtendedDuration(cur);
          if (prev) {
            applyVisibleSeconds(prev);
            sound.tick();
          }
        } else if (cur <= MIN_SECONDS + 0.01) {
          flashLimit("Maximum zoom reached — you're already at the closest timeline view");
        } else {
          const prev = stepNormalStage(cur, -1);
          if (prev) {
            applyVisibleSeconds(prev);
            sound.tick();
          }
        }
      }
    },
    [handlePushMax, applyVisibleSeconds, flashLimit]
  );

  const handleExtendedConfirm = (confirm: boolean) => {
    closeConfirm();
    if (!confirm) return;
    setTimelineExtendedUnlocked(true);
    applyVisibleSeconds(7200); // first extended step — 2h
    sound.snap();
    addToast?.('Extended timeline mode — scroll or drag the control to reach 30 days', { type: 'success' });
  };

  // Selection toolbar actions
  const handleSplit = () => {
    const selected = clips.filter((c) => selectedClipIds.includes(c.id));
    const toSplit = selected.filter((c) => {
      const track = tracks.find((t) => t.id === c.trackId);
      if (track?.locked) return false;
      return currentTime > c.timelineStart + 0.05 && currentTime < c.timelineStart + c.duration - 0.05;
    });
    if (toSplit.length === 0) return;
    const newClips: Clip[] = [];
    const updatedClips = clips.map((c) => {
      if (!toSplit.find((s) => s.id === c.id)) return c;
      const local = currentTime - c.timelineStart;
      const rightDuration = c.duration - local;
      const srcStart = (c as any).sourceStart ?? 0;
      const left: any = { ...c, duration: local };
      const right: any = {
        ...c,
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timelineStart: currentTime,
        duration: rightDuration,
        sourceStart: srcStart + local,
        start: srcStart + local,
      };
      newClips.push(right);
      return left;
    });
    onClipsChange([...updatedClips, ...newClips]);
  };

  const handleDuplicate = () => {
    const selected = clips.filter((c) => selectedClipIds.includes(c.id));
    if (!selected.length) return;
    const copies = selected.map((c) => ({
      ...c,
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 4)}-${c.id}`,
      timelineStart: c.timelineStart + 0.5,
    }));
    onClipsChange((prev) => [...prev, ...copies]);
    onSelectionChange(copies.map((c) => c.id));
  };

  const handleDelete = () => {
    const hasLocked = clips.some((c) => selectedClipIds.includes(c.id) && tracks.find((t) => t.id === c.trackId)?.locked);
    if (hasLocked) return;
    onClipsChange((prev) => prev.filter((c) => !selectedClipIds.includes(c.id)));
    onSelectionChange([]);
  };

  /**
   * Adaptive ruler. Picks the smallest "nice" time step whose labels stay at
   * least MIN_LABEL_PX apart, so the ruler never crowds — from tenths of a
   * second at the closest zoom up to days in extended mode.
   */
  /**
   * Majors land exactly on multiples of the chosen duration. Minors subdivide
   * that span and stay unlabelled, so the only numbers on the ruler are the
   * ones the control names.
   */
  const rulerConfig = (() => {
    const major = divisionSeconds;
    const subdivisions = 4;
    return { major, minor: major / subdivisions, minorCount: subdivisions - 1 };
  })();

  /**
   * Every label on the ruler uses the SAME shape, chosen from the longest time
   * the ruler reaches — not from each tick's own value. Deciding per tick made
   * one ruler mix `50:00` with `1:00:00`, so the leading field silently changed
   * meaning partway along.
   */
  const rulerFormat: 'days' | 'dayHours' | 'hours' | 'minutes' | 'sub' =
    rulerConfig.major >= 86400
      ? 'days'
      : timelineSpan >= 86400
        ? 'dayHours'
        : timelineSpan >= 3600
          ? 'hours'
          : rulerConfig.major >= 1
            ? 'minutes'
            : 'sub';

  const formatTime = (t: number, mode: typeof rulerFormat = rulerFormat) => {
    const total = Math.max(0, t);
    const pad = (n: number) => String(n).padStart(2, '0');
    if (mode === 'days' || mode === 'dayHours') {
      const d = Math.floor(total / 86400);
      const rh = Math.floor((total % 86400) / 3600);
      // Roll into days rather than letting hours run past 24, 36, 48…
      if (!d) return mode === 'days' ? '0d' : `${rh}h`;
      return rh ? `${d}d ${rh}h` : `${d}d`;
    }
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    // Hour scale uses explicit units: "0:20:00" was being read as 20 seconds,
    // whereas "20m" can only mean minutes.
    if (mode === 'hours') {
      if (!h) return `${m}m`;
      return m ? `${h}h ${m}m` : `${h}h`;
    }
    if (mode === 'minutes') return `${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}.${Math.round((total % 1) * 10)}`;
  };

  /**
   * The playhead always shows an exact timecode — ruler labels round to their
   * tick step, which would collapse the playhead readout to "0m".
   */
  const formatPlayhead = (t: number) => {
    const total = Math.max(0, t);
    const pad = (n: number) => String(n).padStart(2, '0');
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    if (total >= 86400) {
      const d = Math.floor(total / 86400);
      return `${d}d ${pad(Math.floor((total % 86400) / 3600))}:${pad(m)}:${pad(s)}`;
    }
    if (h) return `${h}:${pad(m)}:${pad(s)}`;
    if (pixelsPerSecond >= 40) return `${pad(m)}:${pad(s)}.${Math.round((total % 1) * 10)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  // Ticks stop at the end of the timeline. The old count overshot by one step,
  // pushing a stray label (e.g. "1:10:00" on a 1h view) past the right edge.
  const majorTicks: number[] = [];
  {
    const step = rulerConfig.major;
    const count = Math.min(500, Math.floor(timelineSpan / step + 1e-6));
    for (let i = 0; i <= count; i++) majorTicks.push(Math.round(i * step * 1000) / 1000);
  }
  const lastTick = majorTicks[majorTicks.length - 1];

  const hasClips = clips.length > 0;
  const hasTracks = tracks.length > 0;

  /**
   * Track header numbering. A row shows its label + eye + lock as soon as it
   * holds ANY clip — audio and text included. The old rule only counted
   * video/image clips, so a music track came out blank with no controls.
   *
   * Numbering runs per type (V1, V2 … A1, A2 … T1), so each file added to the
   * timeline gets the next number for its own kind.
   */
  const trackDisplay = new Map<string, { number: number; showControls: boolean }>();
  {
    const perType: Record<string, number> = {};
    tracks.forEach((track, i) => {
      const hasClips = clips.some((c) => c.trackId === track.id);
      const showControls = i === 0 || hasClips;
      // Captions share the text lane's numbering.
      const key = track.type === 'caption' ? 'text' : track.type;
      if (showControls) perType[key] = (perType[key] ?? 0) + 1;
      trackDisplay.set(track.id, { number: perType[key] ?? 1, showControls });
    });
  }
  const extendedT = extendedProgress(visibleSeconds);
  const zoomColor = colorForZoomValue(zoomValue, extendedT);
  const zoomGlow = colorForZoomValueAlpha(zoomValue, 0.38, extendedT);
  const zoomLabel = formatZoomLabel(visibleSeconds);

  return (
    <div className={`timeline ${isDragOver ? 'drag-over' : ''} ${isRescaling ? 'is-rescaling' : ''}`} onKeyDown={handleKeyDown} tabIndex={0} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className="timeline__header">
        <div className="timeline__header-label">Timeline</div>
        <div className="timeline__ruler" ref={headerRef as any} onClick={handleRulerClick} onMouseDown={handleScrubStart} style={{ overflow: 'hidden' }}>
          <div className="timeline__ruler-content" style={{ width: contentWidth, minWidth: contentWidth }}>
            {majorTicks.map((sec) => (
              <span
                key={sec}
                className={`timeline__tick timeline__tick--major${sec === lastTick && sec > 0 ? ' timeline__tick--end' : ''}`}
                style={{ left: `${timeToX(sec)}px` }}
              >
                <em>{formatTime(sec)}</em>
                <i />
              </span>
            ))}
            {/* Minor ticks */}
            {majorTicks.slice(0, -1).map((sec) =>
              Array.from({ length: rulerConfig.minorCount }).map((_, i) => {
                const minorTime = sec + (i + 1) * rulerConfig.minor;
                if (minorTime >= timelineSpan) return null;
                return <span key={`${sec}-${i}`} className="timeline__tick timeline__tick--minor" style={{ left: `${timeToX(minorTime)}px` }}><i /></span>;
              })
            )}
            <div className="timeline__playhead-ruler" style={{ left: `${timeToX(currentTime)}px` }}>
              <span className="timeline__playhead-ruler-time">{formatPlayhead(currentTime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selection toolbar */}
      {selectedClipIds.length > 0 && (
        <div className="timeline__toolbar">
          <button className="timeline__toolbar-btn" onClick={handleSplit} title="Split at playhead (S)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="8 6 12 2 16 6"/><polyline points="8 18 12 22 16 18"/></svg>
            Split
          </button>
          <button className="timeline__toolbar-btn" onClick={handleDuplicate} title="Duplicate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3"/></svg>
            Duplicate
          </button>
          <button className="timeline__toolbar-btn timeline__toolbar-btn--danger" onClick={handleDelete} title="Delete (Del)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
          </button>
        </div>
      )}

      {/* One empty state for the whole timeline, centred over the lanes. It
          shows only while nothing has been added, and clears the moment the
          first clip lands. It never blocks a drop — drags pass through it. */}
      {!hasClips && (
        <div className="timeline__placeholder" aria-hidden="true">
          <span className="timeline__placeholder-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </span>
          <span className="timeline__placeholder-title">Drop media here</span>
          <span className="timeline__placeholder-sep" />
          <span className="timeline__placeholder-hint">drag from the library onto any track</span>
        </div>
      )}

      <div ref={scrollRef} className="timeline__scroll" onClick={handleCanvasClick} onScroll={handleScroll}>
        {/* The lanes sit behind a fixed label gutter, so the canvas must include it. */}
        <div className="timeline__canvas" style={{ width: TRACK_LABEL_WIDTH + contentWidth }}>
          <div className="timeline__tracks">
            {!hasTracks && !hasClips ? (
              <div className="timeline__empty-lane" />
            ) : (
              tracks.map((track) => (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  clips={clips}
                  pixelsPerSecond={pixelsPerSecond}
                  selectedClipIds={selectedClipIds}
                  isMuted={isMuted}
                  trimLimitId={trimLimitId}
                  displayNumber={trackDisplay.get(track.id)!.number}
                  showControls={trackDisplay.get(track.id)!.showControls}
                  onSelect={handleClipSelect}
                  onMouseDown={handleMouseDown}
                  onDoubleClick={handleClipDoubleClick}
                  onToggleVisibility={handleToggleVisibility}
                  onToggleLock={handleToggleLock}
                  onToggleMute={handleToggleMute}
                  isDropTarget={dropLaneId === track.id}
                  onLaneDragOver={handleLaneDragOver}
                  onLaneDrop={(e) => dropOnLane(e, track.id)}
                />
              ))
            )}
            {/* Show orphan clips if track was deleted but clips remain */}
            {hasClips && tracks.length === 0 && (
              <div className="timeline-track">
                <div className="timeline-track__label">—</div>
                <div className="timeline-track__lane">
                  {clips.map((clip) => (
                    <div key={clip.id} style={{ position: 'absolute', left: `${timeToX(clip.timelineStart)}px`, width: `${Math.max(48, clip.duration * pixelsPerSecond)}px` }}>{clip.name}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div
            className={`timeline__playhead ${isScrubbing ? 'dragging' : ''}`}
            style={{ left: `${120 + timeToX(currentTime)}px`, transform: 'translateX(-50%)' } as React.CSSProperties}
            onMouseDown={handleScrubStart}
          >
            <span className="timeline__playhead-head" />
            <span className="timeline__playhead-line" />
            {isScrubbing && <span className="timeline__playhead-time">{formatPlayhead(currentTime)}</span>}
          </div>
        </div>
      </div>

      {/* Timeline Zoom / Visible Duration — changes the scale, never the media */}
      <div
        ref={zoombarRef}
        className={`timeline__zoombar timeline__zoombar--curved ${zoomDragging ? "is-dragging" : ""}`}
        style={{ '--zoom-color': zoomColor, '--zoom-glow': zoomGlow } as React.CSSProperties}
      >
        <span className="timeline__zoom-icon timeline__zoom-icon--slow" title="Zoom in — closest timeline view (5s)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 14c-1.5 0-3-1-3-3 0-2 1.5-3 3-3" />
            <path d="M9 8h5a3 3 0 0 1 3 3 3 3 0 0 1-3 3h-1" />
            <circle cx="10.5" cy="10.5" r="0.8" fill="currentColor" stroke="none"/>
            <path d="M6 14l-1 2 2-0.5" />
            <path d="M14 14l1 2 -2-0.5" />
          </svg>
        </span>
        <div className="timeline__zoom-slider-wrap">
          {zoomDragging && (
            <div className="timeline__zoom-tooltip">
              <span className="timeline__zoom-tooltip-label">Timeline view</span>
              <strong>{formatZoomVerbose(visibleSeconds)}</strong>
            </div>
          )}
          <CurvedZoomSlider
            value={zoomValue}
            extended={extended}
            extendedProgress={extendedT}
            extendedUnlocked={!!timelineExtendedUnlocked}
            onChange={handleZoomChange}
            onPushMax={handlePushMax}
            onPushMin={handlePushMin}
            onWheelStep={handleWheelStep}
            onDragStateChange={setZoomDragging}
          />
        </div>
        <span className="timeline__zoom-icon timeline__zoom-icon--fast" title="Zoom out — longest timeline view (1h+)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 13c0-2 1.5-3 3-3h2" />
            <path d="M11 10h4a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2" />
            <path d="M7 13l-1 2 1.5-0.3" />
            <path d="M13 13l1 2 -1.5-0.3" />
            <path d="M9 8l1-2" />
            <path d="M12 8l1-2" />
          </svg>
        </span>
        {/* The readout anchors the confirm, so the card opens beside it — in
            this row, never over the timeline. */}
        <span className="timeline__zoom-readout">
          <span className={`timeline__zoom-label ${zoomDragging ? 'is-live' : ''}`} key={zoomLabel} title="Visible timeline duration">
            {zoomLabel}
          </span>
          {extended && <span className="timeline__zoom-badge">Extended</span>}

          {/* Entering Extended Timeline Mode — a compact row that fits the bar. */}
          {showExtendedConfirm && (
            <span
              className={`zoom-confirm ${confirmLeaving ? 'is-leaving' : ''}`}
              role="dialog"
              aria-label="Extended timeline mode"
              onPointerEnter={holdConfirm}
              onPointerDown={holdConfirm}
              onFocusCapture={holdConfirm}
            >
              <span className="zoom-confirm__text">
                <strong className="zoom-confirm__title">Need longer?</strong>
                <span className="zoom-confirm__body">Extend up to 30 days</span>
              </span>
              <span className="zoom-confirm__actions">
                <button className="zoom-confirm__btn" onClick={() => handleExtendedConfirm(false)}>
                  Not now
                </button>
                <button className="zoom-confirm__btn zoom-confirm__btn--primary" onClick={() => handleExtendedConfirm(true)} autoFocus>
                  Extend
                </button>
              </span>
            </span>
          )}
        </span>

        {/* Soft limit feedback at the closest zoom */}
        {/* Red while out of range, green the instant you come back */}
        {limitFeedback && (
          <div
            className={`zoom-limit-toast zoom-limit-toast--${limitFeedback.kind} ${isLeaving ? 'is-leaving' : ''}`}
            role={limitFeedback.kind === 'error' ? 'alert' : 'status'}
          >
            <span className="zoom-limit-toast__icon" aria-hidden="true">
              {limitFeedback.kind === 'error' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="13" />
                  <line x1="12" y1="16.5" x2="12" y2="16.5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="8 12.5 11 15.5 16 9.5" />
                </svg>
              )}
            </span>
            {limitFeedback.text}
          </div>
        )}
      </div>
    </div>
  );
}
