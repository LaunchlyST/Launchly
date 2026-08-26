import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Clip, Track } from '../../types';
import { TimelineTrack } from './TimelineTrack';

interface TimelineProps {
  clips: Clip[];
  tracks: Track[];
  selectedClipIds: string[];
  currentTime: number;
  duration: number;
  isMuted: boolean;
  onClipsChange: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;
  onSelectionChange: (ids: string[]) => void;
  onTimeChange: (time: number) => void;
  onDropMedia: (clip: Clip, dropTime: number) => void;
}

export function Timeline({ clips, tracks, selectedClipIds, currentTime, duration, isMuted, onClipsChange, onSelectionChange, onTimeChange, onDropMedia }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom] = useState(1);
  const pixelsPerSecond = zoom * 80;
  const contentWidth = Math.max(duration * pixelsPerSecond, 800);

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

  const xToTime = useCallback((x: number) => Math.max(0, Math.min(duration, x / pixelsPerSecond)), [pixelsPerSecond, duration]);
  const timeToX = useCallback((t: number) => t * pixelsPerSecond, [pixelsPerSecond]);

  const handleClipSelect = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation();
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!selectedClipIds.includes(clip.id)) {
      onSelectionChange(additive ? [...selectedClipIds, clip.id] : [clip.id]);
    }
  };

  const getTrackForClip = (clip: Clip) => tracks.find((t) => t.id === clip.trackId);

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
          const maxLeftShift = srcStart; // how much we can trim from left before sourceStart <0
          const newStart = Math.max(0, Math.min(dragState.startTime + dragState.startDuration - 0.2, dragState.startTime + deltaTime));
          let newDuration = dragState.startTime + dragState.startDuration - newStart;
          let newSrcStart = srcStart + (newStart - dragState.startTime);
          if (!isImage && srcDuration !== undefined) {
            // Clamp so source window stays within 0..srcDuration
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
          let newDuration = Math.max(0.2, dragState.startDuration + deltaTime);
          if (!isImage && srcDuration !== undefined) {
            const maxDuration = srcDuration - srcStart;
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
  }, [dragState.type, isScrubbing]);

  const handleScrubMove = useCallback(
    (e: MouseEvent) => {
      if (!isScrubbing || !scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollRef.current.scrollLeft - 120;
      onTimeChange(xToTime(Math.max(0, x)));
    },
    [isScrubbing, onTimeChange, xToTime]
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

  const handleScrubStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsScrubbing(true);
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft - 120;
    onTimeChange(xToTime(Math.max(0, x)));
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Click anywhere on track lane to seek — but ignore clip drags
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
      // Find original clip from media (or create from dragged data)
      const original = clips.find((c) => c.id === data.id) ?? data;
      onDropMedia(original, dropTime);
    } catch {
      // fallback: try files already handled elsewhere
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipIds.length > 0) {
      onClipsChange((prev) => prev.filter((c) => !selectedClipIds.includes(c.id)));
      onSelectionChange([]);
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className={`timeline ${isDragOver ? 'drag-over' : ''}`} onKeyDown={handleKeyDown} tabIndex={0} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className="timeline__header">
        <div className="timeline__header-label">Timeline</div>
        <div className="timeline__ruler" onClick={handleRulerClick} onMouseDown={handleScrubStart}>
          <div className="timeline__ruler-content" style={{ width: contentWidth }}>
            {Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, i) => i * 5).map((sec) => (
              <span key={sec} className="timeline__tick" style={{ left: `${timeToX(sec)}px` }}>
                <em>{formatTime(sec)}</em>
                <i />
              </span>
            ))}
            <div className="timeline__playhead-ruler" style={{ left: `${timeToX(currentTime)}px` }} />
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="timeline__scroll" onClick={handleCanvasClick}>
        <div className="timeline__canvas" style={{ width: contentWidth }}>
          <div className="timeline__tracks">
            {tracks.map((track) => (
              <TimelineTrack
                key={track.id}
                track={track}
                clips={clips}
                pixelsPerSecond={pixelsPerSecond}
                selectedClipIds={selectedClipIds}
                isMuted={isMuted}
                onSelect={handleClipSelect}
                onMouseDown={handleMouseDown}
              />
            ))}
          </div>
          <div
            className="timeline__playhead"
            style={{ left: `${120 + timeToX(currentTime)}px` }}
            onMouseDown={handleScrubStart}
          >
            <span className="timeline__playhead-head" />
            <span className="timeline__playhead-line" />
          </div>
        </div>
      </div>

      {clips.length === 0 && <div className="timeline__empty">Drag media from the left panel to start editing</div>}
    </div>
  );
}
