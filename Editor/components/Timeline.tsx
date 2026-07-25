import React, { forwardRef, useRef, useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { glassmorphismStyles, theme } from '../styles/theme';
import { Clip, Track } from '../types';

export interface TimelineProps {
  height: number;
  clips: Clip[];
  tracks: Track[];
  selectedClipIds: string[];
  currentTime: number;
  duration: number;
  fps: number;
  playing: boolean;
  snapEnabled: boolean;
  magneticTimeline: boolean;
  waveformsEnabled: boolean;
  thumbnailsEnabled: boolean;
  onClipsChange: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;
  onTracksChange: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  onSelectionChange: (ids: string[]) => void;
  onTimeChange: (time: number) => void;
  onPlayToggle: () => void;
  onZoomChange: (zoom: number) => void;
}

export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(
  ({
    height,
    clips,
    tracks,
    selectedClipIds,
    currentTime,
    duration,
    fps,
    playing,
    snapEnabled,
    magneticTimeline,
    waveformsEnabled,
    thumbnailsEnabled,
    onClipsChange,
    onTracksChange,
    onSelectionChange,
    onTimeChange,
    onPlayToggle,
    onZoomChange,
  }, ref) => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const rulerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [dragState, setDragState] = useState<{
      type: 'clip' | 'resize' | null;
      clipId: string | null;
      edge: 'left' | 'right' | null;
      startX: number;
      startTime: number;
    }>({ type: null, clipId: null, edge: null, startX: 0, startTime: 0 });
    const [snapLine, setSnapLine] = useState<{ x: number; time: number } | null>(null);
    const [hoveredClip, setHoveredClip] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      scrollToTime: (time: number) => {
        if (canvasRef.current) {
          const pixelsPerSecond = zoom * 100;
          canvasRef.current.scrollLeft = time * pixelsPerSecond - canvasRef.current.clientWidth / 2;
        }
      },
      zoomToFit: () => {},
    }));

    const pixelsPerSecond = zoom * 100;
    const contentWidth = Math.max(duration * pixelsPerSecond, timelineRef.current?.clientWidth || 1920);

    const formatTime = (time: number) => {
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const timeToX = (time: number) => time * pixelsPerSecond;
    const xToTime = (x: number) => Math.max(0, Math.min(duration, x / pixelsPerSecond));

    const getClipStyle = (clip: Clip) => ({
      left: `${timeToX(clip.timelineStart)}px`,
      width: `${Math.max(theme.timeline.minClipWidth, timeToX(clip.timelineStart + clip.duration) - timeToX(clip.timelineStart))}px`,
      height: '100%',
      background: clip.type === 'video' ? theme.colors.accentCyan : clip.type === 'audio' ? theme.colors.accentAmber : theme.colors.accentViolet,
      borderRadius: theme.radius.sm,
      position: 'absolute' as const,
      top: 0,
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${theme.spacing[2]}`,
      cursor: 'grab',
      transition: 'box-shadow 0.15s ease',
      boxShadow: selectedClipIds.includes(clip.id)
        ? `0 0 0 2px ${theme.colors.accentCyan}, ${theme.shadows.md}`
        : hoveredClip === clip.id
          ? theme.shadows.sm
          : 'none',
      zIndex: selectedClipIds.includes(clip.id) ? 10 : 1,
      overflow: 'hidden',
      userSelect: 'none' as const,
    });

    const handleMouseDown = (e: React.MouseEvent, clip: Clip, edge?: 'left' | 'right') => {
      e.stopPropagation();
      e.preventDefault();

      if (edge) {
        setDragState({
          type: 'resize',
          clipId: clip.id,
          edge,
          startX: e.clientX,
          startTime: edge === 'left' ? clip.timelineStart : clip.timelineStart + clip.duration,
        });
        document.body.style.cursor = edge === 'left' ? 'w-resize' : 'e-resize';
      } else {
        const additive = e.shiftKey || e.ctrlKey || e.metaKey;
        if (!selectedClipIds.includes(clip.id)) {
          onSelectionChange(additive ? [...selectedClipIds, clip.id] : [clip.id]);
        }
        setDragState({
          type: 'clip',
          clipId: clip.id,
          edge: null,
          startX: e.clientX,
          startTime: clip.timelineStart,
        });
        document.body.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.type || !dragState.clipId) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const clip = clips.find((c) => c.id === dragState.clipId);
      if (!clip) return;

      if (dragState.type === 'resize') {
        const newTime = Math.max(0, Math.min(duration, dragState.startTime + deltaTime));
        if (dragState.edge === 'left') {
          const clampedTime = Math.min(newTime, clip.timelineStart + clip.duration - 0.1);
          const newDuration = clip.timelineStart + clip.duration - clampedTime;
          onClipsChange((prev) =>
            prev.map((c) => (c.id === clip.id ? { ...c, timelineStart: clampedTime, duration: newDuration } : c))
          );
          checkSnap(clampedTime);
        } else {
          const clampedTime = Math.max(newTime, clip.timelineStart + 0.1);
          onClipsChange((prev) =>
            prev.map((c) => (c.id === clip.id ? { ...c, duration: clampedTime - clip.timelineStart } : c))
          );
          checkSnap(clampedTime);
        }
      } else if (dragState.type === 'clip') {
        const newStart = Math.max(0, Math.min(duration - clip.duration, dragState.startTime + deltaTime));
        if (magneticTimeline) {
          const newEnd = newStart + clip.duration;
          let snapped = false;
          clips.forEach((c) => {
            if (c.id === clip.id) return;
            [c.timelineStart, c.timelineStart + c.duration].forEach((snapTime) => {
              if (Math.abs(newStart - snapTime) < 0.1) {
                onClipsChange((prev) =>
                  prev.map((cl) => (cl.id === clip.id ? { ...cl, timelineStart: snapTime } : cl))
                );
                snapped = true;
              } else if (Math.abs(newEnd - snapTime) < 0.1) {
                onClipsChange((prev) =>
                  prev.map((cl) => (cl.id === clip.id ? { ...cl, timelineStart: snapTime - clip.duration } : cl))
                );
                snapped = true;
              }
            });
          });
          if (!snapped) {
            onClipsChange((prev) =>
              prev.map((c) => (c.id === clip.id ? { ...c, timelineStart: newStart } : c))
            );
          }
        } else {
          onClipsChange((prev) =>
            prev.map((c) => (c.id === clip.id ? { ...c, timelineStart: newStart } : c))
          );
          checkSnap(newStart);
          checkSnap(newStart + clip.duration);
        }
      }
    };

    const handleMouseUp = () => {
      if (dragState.type) {
        setDragState({ type: null, clipId: null, edge: null, startX: 0, startTime: 0 });
        setSnapLine(null);
        document.body.style.cursor = '';
      }
    };

    const checkSnap = (time: number) => {
      if (!snapEnabled) {
        setSnapLine(null);
        return;
      }

      const threshold = theme.timeline.snapThreshold / pixelsPerSecond;
      let nearestSnap: { x: number; time: number } | null = null;
      let minDist = threshold;

      clips.forEach((clip) => {
        if (clip.id === dragState.clipId) return;
        [clip.timelineStart, clip.timelineStart + clip.duration].forEach((snapTime) => {
          const dist = Math.abs(time - snapTime);
          if (dist < minDist) {
            minDist = dist;
            nearestSnap = { x: timeToX(snapTime), time: snapTime };
          }
        });
      });

      [0, duration].forEach((snapTime) => {
        const dist = Math.abs(time - snapTime);
        if (dist < minDist) {
          minDist = dist;
          nearestSnap = { x: timeToX(snapTime), time: snapTime };
        }
      });

      const dist = Math.abs(time - currentTime);
      if (dist < minDist) {
        minDist = dist;
        nearestSnap = { x: timeToX(currentTime), time: currentTime };
      }

      setSnapLine(nearestSnap);
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || e.target === rulerRef.current) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left + canvasRef.current!.scrollLeft;
        const time = xToTime(x);
        onTimeChange(time);
      }
    };

    const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const newZoom = Math.max(0.1, Math.min(10, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
        setZoom(newZoom);
        onZoomChange(newZoom);
      } else {
        canvasRef.current!.scrollLeft += e.deltaY;
      }
    };

    useEffect(() => {
      const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
      const handleGlobalMouseUp = () => handleMouseUp();
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }, [dragState, pixelsPerSecond, clips, duration, snapEnabled, magneticTimeline]);

    useEffect(() => {
      if (canvasRef.current && !isScrubbing) {
        const targetX = timeToX(currentTime) - canvasRef.current.clientWidth / 2;
        canvasRef.current.scrollLeft = Math.max(0, Math.min(contentWidth - canvasRef.current.clientWidth, targetX));
      }
    }, [currentTime, zoom, isScrubbing]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipIds.length > 0) {
          onClipsChange((prev) => prev.filter((c) => !selectedClipIds.includes(c.id)));
          onSelectionChange([]);
        }
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (selectedClipIds.length === 1) {
          const clip = clips.find((c) => c.id === selectedClipIds[0]);
          if (clip && currentTime > clip.timelineStart && currentTime < clip.timelineStart + clip.duration) {
            const splitPoint = currentTime - clip.timelineStart;
            const newClip: Clip = {
              ...clip,
              id: `${clip.id}-split-${Date.now()}`,
              timelineStart: currentTime,
              start: clip.start + splitPoint,
              duration: clip.duration - splitPoint,
            };
            onClipsChange((prev) =>
              prev.map((c) => (c.id === clip.id ? { ...c, duration: splitPoint } : c)).concat(newClip)
            );
          }
        }
      }
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        onPlayToggle();
      }
    };

    return (
      <div
        ref={timelineRef}
        className="timeline"
        style={{ ...glassmorphismStyles.timelineContainer, height }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="timeline-header" style={glassmorphismStyles.timelineHeader}>
          <div className="track-headers" style={glassmorphismStyles.trackHeaders}>
            {tracks.map((track, index) => (
              <div key={track.id} className="track-header" style={glassmorphismStyles.trackHeader}>
                <div className="track-controls" style={glassmorphismStyles.trackControls}>
                  <button
                    className="track-toggle"
                    onClick={() =>
                      onTracksChange((prev) =>
                        prev.map((t) => (t.id === track.id ? { ...t, visible: !t.visible } : t))
                      )
                    }
                    style={glassmorphismStyles.trackButton}
                    aria-label={`Toggle ${track.name} visibility`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {track.visible ? (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M1 1l22 22" />
                        </>
                      )}
                    </svg>
                  </button>
                  <button
                    className="track-toggle"
                    onClick={() =>
                      onTracksChange((prev) =>
                        prev.map((t) => (t.id === track.id ? { ...t, locked: !t.locked } : t))
                      )
                    }
                    style={glassmorphismStyles.trackButton}
                    aria-label={`Lock ${track.name}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      {track.locked ? <path d="M7 11V7a5 5 0 0 1 10 0v4" /> : <path d="M7 11V7a5 5 0 0 1 9.9-1" />}
                    </svg>
                  </button>
                </div>
                <div className="track-info" style={glassmorphismStyles.trackInfo}>
                  <span
                    className="track-icon"
                    style={{
                      background: track.color || theme.colors.accentCyan,
                      ...glassmorphismStyles.trackIcon,
                    }}
                  />
                  <span className="track-name" style={glassmorphismStyles.trackName}>
                    {track.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="timeline-ruler" ref={rulerRef} style={glassmorphismStyles.timelineRuler}>
          <div
            className="ruler-content"
            style={{
              ...glassmorphismStyles.rulerContent,
              width: contentWidth,
            }}
          >
            {Array.from({ length: Math.ceil(duration / 10) + 1 }, (_, i) => i * 10).map((sec) => (
              <div
                key={sec}
                className="time-marker"
                style={{
                  ...glassmorphismStyles.timeMarker,
                  left: `${timeToX(sec)}px`,
                }}
              >
                <span style={glassmorphismStyles.timeMarkerText}>{formatTime(sec)}</span>
                <div className="marker-line" style={glassmorphismStyles.markerLine} />
              </div>
            ))}
          </div>
        </div>

        <div
          ref={canvasRef}
          className="timeline-canvas"
          style={{
            ...glassmorphismStyles.timelineCanvas,
            width: contentWidth,
          }}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          onMouseDown={(e) => {
            if (e.target === canvasRef.current) {
              setIsScrubbing(true);
              const rect = canvasRef.current!.getBoundingClientRect();
              const x = e.clientX - rect.left + canvasRef.current!.scrollLeft;
              onTimeChange(xToTime(x));
            }
          }}
          onMouseMove={(e) => {
            if (isScrubbing) {
              const rect = canvasRef.current!.getBoundingClientRect();
              const x = e.clientX - rect.left + canvasRef.current!.scrollLeft;
              onTimeChange(xToTime(x));
            }
          }}
          onMouseUp={() => setIsScrubbing(false)}
          onMouseLeave={() => setIsScrubbing(false)}
        >
          <div className="tracks-container" style={glassmorphismStyles.tracksContainer}>
            {tracks.map((track, trackIndex) => (
              <div
                key={track.id}
                className="track-lane"
                style={{
                  ...glassmorphismStyles.trackLane,
                  background: trackIndex % 2 === 0 ? theme.colors.surfaceBase : theme.colors.bgSecondary,
                }}
              >
                {clips
                  .filter((c) => c.trackId === track.id)
                  .map((clip) => (
                    <div
                      key={clip.id}
                      className="timeline-clip"
                      style={getClipStyle(clip)}
                      onMouseDown={(e) => handleMouseDown(e, clip)}
                      onMouseEnter={() => setHoveredClip(clip.id)}
                      onMouseLeave={() => setHoveredClip(null)}
                    >
                      {clip.thumbnail && (
                        <div className="clip-thumbnail" style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundImage: `url(${clip.thumbnail})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          opacity: 0.3,
                          borderRadius: theme.radius.sm,
                        }} />
                      )}
                      {clip.waveform && clip.waveform.length > 0 && clip.type === 'audio' && (
                        <div className="clip-waveform" style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: '60%',
                          display: 'flex',
                          alignItems: 'flex-end',
                          gap: '1px',
                          padding: '0 2px',
                          opacity: 0.6,
                        }}>
                          {clip.waveform.map((v, i) => (
                            <div key={i} style={{
                              flex: 1,
                              height: `${Math.max(4, v * 100)}%`,
                              background: 'currentColor',
                              borderRadius: '1px',
                              opacity: 0.7,
                            }} />
                          ))}
                        </div>
                      )}
                      <div className="clip-content" style={{ ...glassmorphismStyles.clipContent, position: 'relative', zIndex: 1 }}>
                        <span className="clip-name" style={glassmorphismStyles.clipName}>{clip.name}</span>
                        <span className="clip-duration" style={glassmorphismStyles.clipDuration}>
                          {formatTime(clip.duration)}
                        </span>
                      </div>
                      <div
                        className="resize-handle left"
                        onMouseDown={(e) => handleMouseDown(e, clip, 'left')}
                        style={glassmorphismStyles.resizeHandle}
                        aria-label="Trim start"
                      />
                      <div
                        className="resize-handle right"
                        onMouseDown={(e) => handleMouseDown(e, clip, 'right')}
                        style={{ ...glassmorphismStyles.resizeHandle, right: 0 }}
                        aria-label="Trim end"
                      />
                    </div>
                  ))}
              </div>
            ))}
          </div>

          {snapLine && (
            <div
              className="snap-guide"
              style={{
                ...glassmorphismStyles.snapGuide,
                left: `${snapLine.x}px`,
              }}
            />
          )}

          <div
            className="playhead"
            style={{
              ...glassmorphismStyles.playhead,
              left: `${timeToX(currentTime)}px`,
            }}
          >
            <div className="playhead-handle" style={glassmorphismStyles.playheadHandle} />
            <div className="playhead-line" style={glassmorphismStyles.playheadLine} />
          </div>
        </div>
      </div>
    );
  }
);

Timeline.displayName = 'Timeline';
