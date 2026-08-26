import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Clip, Track } from '../../types';
import { TimelineTrack } from './TimelineTrack';
import { CurvedZoomSlider } from '../common/CurvedZoomSlider';
import { sound } from '../../lib/sound';
import { useEditorStore } from '../../store/editorStore';
import { secondsForZoomValue, formatZoomLabel, colorForZoomValue, nextExtendedDuration, EXTENDED_STAGES } from '../../lib/timelineZoom';

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
  onDropMedia: (clip: Clip, dropTime: number) => void;
}

export function Timeline({ clips, tracks, selectedClipIds, currentTime, duration, isMuted, onClipsChange, onTracksChange, onSelectionChange, onTimeChange, onDropMedia }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { timelineZoomValue, setTimelineZoomValue, timelineVisibleSeconds, setTimelineVisibleSeconds, timelineExtendedUnlocked, setTimelineExtendedUnlocked, addToast } = useEditorStore() as any;
  const zoomValue = timelineZoomValue ?? 30;
  const visibleSeconds = timelineVisibleSeconds ?? secondsForZoomValue(zoomValue);
  // Pixels per second derived from visibleSeconds: viewport ~700px shows visibleSeconds
  const pixelsPerSecond = Math.max(0.4, 700 / Math.max(5, visibleSeconds));
  const contentWidth = Math.max((duration || visibleSeconds) * pixelsPerSecond, 800);

  const [dragState, setDragState] = useState<{
    type: 'move' | 'trim' | null;
    clipId: string | null;
    edge: 'left' | 'right' | null;
    startX: number;
    startTime: number;
    startDuration: number;
  }>({ type: null, clipId: null, edge: null, startX: 0, startTime: 0, startDuration: 0 });

  const [isDragOver, setIsDragOver] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [trimLimitId, setTrimLimitId] = useState<string | null>(null);
  const lastTrimTickRef = useRef(0);
  const [showExtendedConfirm, setShowExtendedConfirm] = useState(false);
  const [showMaxZoomToast, setShowMaxZoomToast] = useState(false);
  const [zoomTooltip, setZoomTooltip] = useState<{ text: string; x: number } | null>(null);
  const [elasticOffset, setElasticOffset] = useState(0);
  const autoScrollRef = useRef<number | null>(null);
  const scrubClientXRef = useRef<number>(0);

  const xToTime = useCallback((x: number) => Math.max(0, Math.min(duration, x / pixelsPerSecond)), [pixelsPerSecond, duration]);
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
        onClipsChange((prev) => prev.map((c) => (c.id === clip.id ? { ...c, timelineStart: newStart } : c)));
      }
    },
    [dragState, clips, tracks, pixelsPerSecond, duration, onClipsChange]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState.type) {
      setDragState({ type: null, clipId: null, edge: null, startX: 0, startTime: 0, startDuration: 0 });
      document.body.style.cursor = '';
    }
    if (isScrubbing) setIsScrubbing(false);
    setElasticOffset(0);
  }, [dragState.type, isScrubbing]);

  const handleScrubMove = useCallback(
    (e: MouseEvent) => {
      if (!isScrubbing || !scrollRef.current) return;
      scrubClientXRef.current = e.clientX;
      const rect = scrollRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left + scrollRef.current.scrollLeft - 120;
      const rawTime = rawX / pixelsPerSecond;
      const clampedTime = Math.max(0, Math.min(duration, rawTime));
      // Elastic at hard walls — lean 2-4px but keep time at 0/duration, then snap
      if (rawTime < 0) {
        const lean = Math.min(4, Math.abs(rawTime) * pixelsPerSecond * 0.12);
        setElasticOffset(lean);
      } else if (rawTime > duration) {
        const lean = Math.max(-4, (duration - rawTime) * pixelsPerSecond * 0.12);
        setElasticOffset(lean);
      } else {
        setElasticOffset(0);
      }
      onTimeChange(clampedTime);
    },
    [isScrubbing, onTimeChange, xToTime, pixelsPerSecond, duration]
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
        const newX = scrubClientXRef.current - rect.left + scrollRef.current.scrollLeft - 120;
        onTimeChange(xToTime(Math.max(0, Math.min(duration, newX))));
      } else if (x < threshold && scrollRef.current.scrollLeft > 0 && !atLeftWall) {
        scrollRef.current.scrollLeft = Math.max(0, scrollRef.current.scrollLeft - 7);
        const newX = scrubClientXRef.current - rect.left + scrollRef.current.scrollLeft - 120;
        onTimeChange(xToTime(Math.max(0, newX)));
      } else if (atLeftWall && x < threshold) {
        // at hard wall — keep elastic, no scroll
        setElasticOffset(Math.max(-4, (x - threshold) * 0.08));
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
    setElasticOffset(0);
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left + scrollRef.current.scrollLeft - 120;
    const rawTime = rawX / pixelsPerSecond;
    const clampedTime = Math.max(0, Math.min(duration, rawTime));
    if (rawTime < 0) setElasticOffset(Math.min(4, Math.abs(rawTime) * pixelsPerSecond * 0.12));
    else if (rawTime > duration) setElasticOffset(Math.max(-4, (duration - rawTime) * pixelsPerSecond * 0.12));
    else setElasticOffset(0);
    onTimeChange(clampedTime);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.timeline-clip')) return;
    const rect = scrollRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current!.scrollLeft - 120;
    onTimeChange(xToTime(Math.max(0, x)));
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0) - 120;
    onTimeChange(xToTime(Math.max(0, x)));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!scrollRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/x-launchly-clip'));
      if (!data?.id) return;
      const rect = scrollRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollRef.current!.scrollLeft - 120;
      const dropTime = xToTime(Math.max(0, x));
      const original = clips.find((c) => c.id === data.id) ?? data;
      onDropMedia(original, dropTime);
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

  const handleZoomChange = (newValue: number) => {
    // Minimum limit — 5s
    if (newValue <= 0 && visibleSeconds <= 5) {
      setShowMaxZoomToast(true);
      sound.limit();
      setTimeout(() => setShowMaxZoomToast(false), 1800);
      return;
    }
    // Maximum normal — 1h, need confirmation to go extended
    if (newValue >= 100 && visibleSeconds >= 3600 && !timelineExtendedUnlocked) {
      setShowExtendedConfirm(true);
      sound.limit();
      return;
    }
    const newSeconds = secondsForZoomValue(Math.max(0, Math.min(100, newValue)));
    setTimelineZoomValue(newValue);
    setTimelineVisibleSeconds(newSeconds);
    setZoomTooltip({ text: formatZoomLabel(newSeconds), x: 0 });
    setTimeout(() => setZoomTooltip(null), 900);
    // subtle tick
    if (Math.abs(newValue - zoomValue) > 2) sound.tick();
  };

  const handleExtendedConfirm = (confirm: boolean) => {
    setShowExtendedConfirm(false);
    if (confirm) {
      setTimelineExtendedUnlocked(true);
      const next = 7200; // 2h
      setTimelineVisibleSeconds(next);
      setTimelineZoomValue(100);
      sound.snap();
      addToast?.('Extended timeline unlocked — up to 30 days', { type: 'success' });
    }
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    if (!timelineExtendedUnlocked) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    if (delta > 0) {
      const next = nextExtendedDuration(visibleSeconds);
      if (next) {
        setTimelineVisibleSeconds(next);
        sound.tick();
      }
    } else {
      // go back — if currently extended, step down, else normal
      if (visibleSeconds > 3600) {
        const prevStages = [...EXTENDED_STAGES].reverse();
        let prev: number | null = 3600;
        for (const s of prevStages) {
          if (s.seconds < visibleSeconds) { prev = s.seconds; break; }
        }
        if (prev) {
          setTimelineVisibleSeconds(prev);
          if (prev <= 3600) {
            // back to normal range, keep unlocked but allow normal handling
          }
          sound.tick();
        }
      } else {
        // normal zoom back — decrease zoomValue
        const newVal = Math.max(0, zoomValue - 4);
        handleZoomChange(newVal);
      }
    }
  };

  const handleZoomDragBeyond = (clientX: number, isBeyondMax: boolean, isBeyondMin: boolean) => {
    if (isBeyondMax && !timelineExtendedUnlocked && visibleSeconds >= 3600) {
      setShowExtendedConfirm(true);
    }
    if (isBeyondMin && visibleSeconds <= 5) {
      setShowMaxZoomToast(true);
      setTimeout(() => setShowMaxZoomToast(false), 1600);
    }
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

  // Adaptive ruler
  const getRulerConfig = () => {
    if (pixelsPerSecond < 30) return { major: 30, minor: 10, minorCount: 2 };
    if (pixelsPerSecond < 60) return { major: 10, minor: 2, minorCount: 4 };
    if (pixelsPerSecond < 120) return { major: 5, minor: 1, minorCount: 4 };
    return { major: 2, minor: 0.5, minorCount: 3 };
  };
  const rulerConfig = getRulerConfig();

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    if (duration > 60) return `${m}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  const majorTicks: number[] = [];
  for (let t = 0; t <= duration + 0.001; t += rulerConfig.major) majorTicks.push(Math.round(t * 10) / 10);

  const hasClips = clips.length > 0;
  const hasTracks = tracks.length > 0;

  return (
    <div className={`timeline ${isDragOver ? 'drag-over' : ''}`} onKeyDown={handleKeyDown} tabIndex={0} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className="timeline__header">
        <div className="timeline__header-label">Timeline</div>
        <div className="timeline__ruler" ref={headerRef as any} onClick={handleRulerClick} onMouseDown={handleScrubStart} style={{ overflow: 'hidden' }}>
          <div className="timeline__ruler-content" style={{ width: contentWidth, minWidth: contentWidth }}>
            {majorTicks.map((sec) => (
              <span key={sec} className="timeline__tick timeline__tick--major" style={{ left: `${timeToX(sec)}px` }}>
                <em>{formatTime(sec)}</em>
                <i />
              </span>
            ))}
            {/* Minor ticks */}
            {majorTicks.slice(0, -1).map((sec) =>
              Array.from({ length: rulerConfig.minorCount }).map((_, i) => {
                const minorTime = sec + (i + 1) * rulerConfig.minor;
                if (minorTime >= duration) return null;
                return <span key={`${sec}-${i}`} className="timeline__tick timeline__tick--minor" style={{ left: `${timeToX(minorTime)}px` }}><i /></span>;
              })
            )}
            <div className="timeline__playhead-ruler" style={{ left: `${timeToX(currentTime)}px` }}>
              <span className="timeline__playhead-ruler-time">{formatTime(currentTime)}</span>
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

      <div ref={scrollRef} className="timeline__scroll" onClick={handleCanvasClick} onScroll={handleScroll}>
        <div className="timeline__canvas" style={{ width: contentWidth }}>
          <div className="timeline__tracks">
            {!hasTracks && !hasClips ? (
              <div className="timeline__empty-lane">
                <span>Drag media here to start editing</span>
              </div>
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
                  onSelect={handleClipSelect}
                  onMouseDown={handleMouseDown}
                  onDoubleClick={handleClipDoubleClick}
                  onToggleVisibility={handleToggleVisibility}
                  onToggleLock={handleToggleLock}
                  onToggleMute={handleToggleMute}
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
            className={`timeline__playhead ${isScrubbing ? 'dragging' : ''} ${elasticOffset !== 0 ? 'elastic' : ''}`}
            style={{ left: `${120 + timeToX(currentTime)}px`, transform: `translateX(calc(-50% + ${elasticOffset}px))` } as React.CSSProperties}
            onMouseDown={handleScrubStart}
          >
            <span className="timeline__playhead-head" />
            <span className="timeline__playhead-line" />
            {isScrubbing && <span className="timeline__playhead-time">{formatTime(currentTime)}</span>}
          </div>
        </div>
      </div>

      {/* Bottom-left zoom control: curved arc — reinvented */}
      <div className="timeline__zoombar timeline__zoombar--curved">
        <span className="timeline__zoom-icon timeline__zoom-icon--slow" title="Zoom in — detailed (5s)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 14c-1.5 0-3-1-3-3 0-2 1.5-3 3-3" />
            <path d="M9 8h5a3 3 0 0 1 3 3 3 3 0 0 1-3 3h-1" />
            <circle cx="10.5" cy="10.5" r="0.8" fill="currentColor" stroke="none"/>
            <path d="M6 14l-1 2 2-0.5" />
            <path d="M14 14l1 2 -2-0.5" />
          </svg>
        </span>
        <CurvedZoomSlider value={zoomValue} onChange={handleZoomChange} />
        <span className="timeline__zoom-icon timeline__zoom-icon--fast" title="Zoom out — overview (30s)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 13c0-2 1.5-3 3-3h2" />
            <path d="M11 10h4a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2" />
            <path d="M7 13l-1 2 1.5-0.3" />
            <path d="M13 13l1 2 -1.5-0.3" />
            <path d="M9 8l1-2" />
            <path d="M12 8l1-2" />
          </svg>
        </span>
        <span className="timeline__zoom-label">{zoomValue < 33 ? '5s' : zoomValue > 66 ? '30s' : '15s'}</span>
      </div>

      {!hasClips && hasTracks && <div className="timeline__empty">Add clips to timeline</div>}
    </div>
  );
}
