import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Clip } from '../../shared/types';
import { getAspectRatioById } from '../../preview/config/aspectRatios';
import { sound } from '../../shared/utils/sound';
import { useEditorStore } from '../../editor-core/logic/editorStore';
import { PreviewMediaLayer } from './PreviewMediaLayer';
import { useMediaResize } from '../../shared/hooks/useMediaResize';
import { EDITOR_LIMITS } from '../../editor-core/config/editorLimits';
import { ExceededSide, PreviewBorderState } from '../../preview/types/preview.types';

interface VideoPreviewProps {
  clips: Clip[];
  tracks?: any[];
  selectedClipIds: string[];
  currentTime: number;
  duration: number;
  playing: boolean;
  onPlayToggle: () => void;
  aspectRatio: string;
  isMuted: boolean;
  onDrop?: (e: React.DragEvent) => void;
  /** Persists a media object's position after a drag ends. Optional — the
   *  layer still drags smoothly without it, it just won't be remembered. */
  onClipsChange?: (updater: (prev: Clip[]) => Clip[]) => void;
}

export function VideoPreview({ clips, tracks = [], selectedClipIds, currentTime, duration, playing, onPlayToggle, aspectRatio, isMuted, onDrop, onClipsChange }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);

  // Whole-preview corner-resize zoom (editing convenience, not the media's own scale).
  const [previewScale, setPreviewScale] = useState(1);
  const previewScaleRef = useRef(1);
  /**
   * Which limit the current resize is pressed against.
   *  'max' — grown as far as the white workspace allows → red
   *  'min' — shrunk as small as allowed → green
   * Growing is the direction that can go wrong, so it gets the warning colour;
   * shrinking is always safe, so it gets the reassuring one.
   */
  const [zoomBoundary, setZoomBoundary] = useState<'min' | 'max' | null>(null);
  const [zoomActive, setZoomActive] = useState(false);

  // Per-object drag boundary (the media positioned inside the canvas).
  const [dragBoundary, setDragBoundary] = useState<{ exceeded: boolean; side: ExceededSide }>({ exceeded: false, side: null });
  const boundaryLingerTimer = useRef<number | null>(null);

  const preset = getAspectRatioById(aspectRatio);
  const ratioStyle = preset ? `${preset.width} / ${preset.height}` : '16 / 9';

  /**
   * A small, self-dismissing note — never a red wall of text. Used only when a
   * gesture has genuinely run out of room.
   */
  const [limitNote, setLimitNote] = useState<{ text: string; tone: 'max' | 'min' } | null>(null);
  const limitNoteTimer = useRef<number | null>(null);
  const showLimitNote = useCallback((text: string, tone: 'max' | 'min') => {
    setLimitNote({ text, tone });
    if (limitNoteTimer.current) window.clearTimeout(limitNoteTimer.current);
    limitNoteTimer.current = window.setTimeout(() => setLimitNote(null), 2000);
  }, []);

  /**
   * How far the preview may grow before an edge reaches the white workspace.
   * Measured live at gesture start, so the frame can be scaled right up to the
   * canvas edge instead of stopping at some fixed number.
   */
  const getZoomLimits = useCallback(() => {
    const el = zoomLayerRef.current;
    const host = el?.parentElement;
    // Measure the visible canvas, not its wrapper: the wrapper is stretched to
    // fill the workspace, so it would always read as already at the edge.
    const canvas = frameRef.current;
    const fallback = { min: EDITOR_LIMITS.previewZoomMin, max: EDITOR_LIMITS.previewZoomMax };
    if (!el || !host || !canvas) return fallback;

    const rect = canvas.getBoundingClientRect();
    const scale = previewScaleRef.current || 1;
    const baseW = rect.width / scale;
    const baseH = rect.height / scale;
    if (baseW < 1 || baseH < 1) return fallback;

    // Content box of the white area — the hard boundary for the media.
    const cs = window.getComputedStyle(host);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const availW = Math.max(0, host.clientWidth - padX);
    const availH = Math.max(0, host.clientHeight - padY);

    // Grow until whichever edge reaches the workspace first.
    const max = Math.min(availW / baseW, availH / baseH);
    const min = EDITOR_LIMITS.previewZoomMin;
    return { min, max: Math.max(min, max) };
  }, []);

  /** Shared behaviour for every resize handle — corner and both sides. */
  const resizeBehaviour = {
    layerRef: zoomLayerRef,
    getScale: () => previewScaleRef.current,
    minScale: EDITOR_LIMITS.previewZoomMin,
    maxScale: EDITOR_LIMITS.previewZoomMax,
    getLimits: getZoomLimits,
    onResizeMove: (s: number) => {
      if (Math.abs(s - previewScaleRef.current) > 0.01) sound.tick();
      previewScaleRef.current = s;
      setPreviewScale(s);
    },
    onBoundaryChange: (exceeded: boolean, edge: 'min' | 'max' | null) => {
      setZoomBoundary(exceeded ? edge : null);
      if (!exceeded) return;
      sound.limit();
      if (edge === 'max') showLimitNote('Maximum size reached', 'max');
      else showLimitNote('Minimum size reached', 'min');
    },
    onResizeEnd: (s: number) => {
      previewScaleRef.current = s;
      setPreviewScale(s);
      setZoomActive(false);
      setZoomBoundary(null);
    },
  };

  // Corner handle — horizontal + vertical.
  const { onPointerDown: onCornerDown } = useMediaResize(resizeBehaviour);
  // Side handles — horizontal only. The left one grows when dragged outwards,
  // i.e. to the left, so its delta is inverted.
  const { onPointerDown: onRightDown } = useMediaResize({ ...resizeBehaviour, axis: 'x' });
  const { onPointerDown: onLeftDown } = useMediaResize({ ...resizeBehaviour, axis: 'x', invert: true });

  /** Wraps a handle so the preview enters its "resizing" state on grab. */
  const beginResize = (handler: (e: React.PointerEvent) => void) => (e: React.PointerEvent) => {
    setZoomActive(true);
    handler(e);
  };

  // Boundary-error visual lingers briefly after release rather than snapping off.
  const flagBoundary = useCallback((exceeded: boolean, side: ExceededSide) => {
    if (boundaryLingerTimer.current) window.clearTimeout(boundaryLingerTimer.current);
    if (exceeded) {
      setDragBoundary({ exceeded: true, side });
      showLimitNote('Edge of the canvas', 'max');
    } else {
      boundaryLingerTimer.current = window.setTimeout(() => {
        setDragBoundary({ exceeded: false, side: null });
      }, EDITOR_LIMITS.boundaryErrorLingerMs);
    }
  }, [showLimitNote]);

  useEffect(() => () => {
    if (boundaryLingerTimer.current) window.clearTimeout(boundaryLingerTimer.current);
    if (limitNoteTimer.current) window.clearTimeout(limitNoteTimer.current);
  }, []);

  const commitPosition = useCallback(
    (clipId: string, x: number, y: number) => {
      onClipsChange?.((prev) => prev.map((c) => (c.id === clipId ? { ...c, transform: { ...c.transform, position: { x, y } } } : c)));
    },
    [onClipsChange]
  );

  // Find active clip at current time — respect hidden tracks
  const isTrackVisible = (clip: Clip) => {
    if (!tracks.length) return true;
    const t = tracks.find((tr: any) => tr.id === clip.trackId);
    return t ? t.visible !== false : true;
  };
  const visibleClips = clips.filter(isTrackVisible);
  const selectedClips = visibleClips.filter((c) => selectedClipIds.includes(c.id));
  const activeClip =
    selectedClips[0] ||
    visibleClips.find((c) => c.timelineStart <= currentTime && c.timelineStart + c.duration > currentTime) ||
    null;

  const isActiveMuted = (() => {
    if (!activeClip) return false;
    if ((activeClip as any).embeddedAudioMuted) return true;
    if (isMuted) return true;
    const t = tracks.find((tr: any) => tr.id === activeClip.trackId);
    return !!(t?.muted);
  })();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip || activeClip.type !== 'video') return;
    const sourceStart = (activeClip as any).sourceStart ?? activeClip.start ?? 0;
    const targetTime = currentTime - activeClip.timelineStart + sourceStart;
    if (Math.abs(video.currentTime - targetTime) > 0.15) video.currentTime = Math.max(0, targetTime);
    video.muted = isActiveMuted;
  }, [currentTime, activeClip, isActiveMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip || activeClip.type !== 'video') return;
    if (playing) video.play().catch(() => {});
    else video.pause();
  }, [playing, activeClip, isActiveMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeClip || activeClip.type !== 'audio') return;
    const sourceStart = (activeClip as any).sourceStart ?? activeClip.start ?? 0;
    const targetTime = currentTime - activeClip.timelineStart + sourceStart;
    if (Math.abs(audio.currentTime - targetTime) > 0.15) audio.currentTime = Math.max(0, targetTime);
    audio.muted = isActiveMuted;
    if (playing && !isActiveMuted) audio.play().catch(() => {});
    else audio.pause();
  }, [playing, currentTime, activeClip, isActiveMuted]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const hasMedia = clips.length > 0;
  const isPositionable = hasMedia && (activeClip?.type === 'video' || activeClip?.type === 'image');
  // Timeline zoom-limit errors ring the preview too, so the error is visible
  // even when the user is looking at the picture rather than the timeline.
  const timelineFeedback = useEditorStore((s) => (s as any).timelineFeedback) as 'error' | 'ok' | null;
  // A brief green flash when an unrelated system (the timeline zoom) reports
  // "back to normal" — separate from the persistent border-state below.
  const [okFlash, setOkFlash] = useState(false);
  useEffect(() => {
    if (timelineFeedback !== 'ok') return;
    setOkFlash(true);
    const t = window.setTimeout(() => setOkFlash(false), 1400);
    return () => window.clearTimeout(t);
  }, [timelineFeedback]);

  /**
   * Running out of canvas is not an error — it is the edge doing its job. It
   * reads as a brief highlight on the boundary, while `error` stays reserved
   * for a genuine fault reported by another system (the timeline zoom limit).
   */
  /**
   * Growing into the workspace edge is the failure direction, so it reads red.
   * Shrinking to the floor is harmless, so it reads green.
   */
  const borderState: PreviewBorderState =
    timelineFeedback === 'error' || zoomBoundary === 'max' || dragBoundary.exceeded
      ? 'error'
      : zoomBoundary === 'min'
        ? 'ok'
        : zoomActive || (isPositionable && selectedClipIds.includes(activeClip!.id))
          ? 'active'
          : 'normal';

  const zoomDeltaPct = Math.round((previewScale - 1) * 100);
  const zoomLabel = `${zoomDeltaPct >= 0 ? '+' : ''}${zoomDeltaPct}%`;

  return (
    <div className="video-preview" onDragOver={handleDragOver} onDrop={onDrop}>
      <div
        ref={zoomLayerRef}
        className={`video-preview__frame-wrap ${zoomActive ? 'is-zoom-live' : ''}`}
        style={{ aspectRatio: ratioStyle, transform: `scale(${previewScale})`, transformOrigin: 'center' }}
      >
        <div
          ref={frameRef}
          className={`video-preview__frame preview-border--${borderState} ${zoomActive ? 'is-zooming' : ''} ${okFlash && borderState === 'normal' ? 'is-ok-flash' : ''}`}
        >
          {!hasMedia ? (
            <div className="video-preview__empty">
              <div className="video-preview__empty-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="15" height="14" rx="2" ry="2" />
                  <polygon points="23 7 16 12 23 17" />
                </svg>
              </div>
              <p className="video-preview__empty-title">Add media to start editing</p>
              <p className="video-preview__empty-subtitle">Your preview will appear here</p>
              <p className="video-preview__empty-hint">Upload media in the library, or drag an item onto the timeline</p>
            </div>
          ) : isPositionable ? (
            <PreviewMediaLayer
              clip={activeClip as Clip}
              canvasRef={frameRef}
              isSelected={selectedClipIds.includes((activeClip as Clip).id)}
              onCommitPosition={commitPosition}
              onBoundaryChange={flagBoundary}
            >
              {activeClip!.type === 'video' && activeClip!.src ? (
                <video ref={videoRef} src={activeClip!.src} className="video-preview__video" playsInline muted={isActiveMuted} draggable={false} />
              ) : (
                <img src={activeClip!.src} alt={activeClip!.name} className="video-preview__image" draggable={false} />
              )}
            </PreviewMediaLayer>
          ) : activeClip?.type === 'audio' ? (
            <>
              <audio ref={audioRef} src={activeClip.src} preload="metadata" />
              <div className="video-preview__audio">
                <div className="video-preview__audio-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <span className="video-preview__audio-name">{activeClip.name}</span>
                {activeClip.waveform && (
                  <div className="video-preview__audio-wave">
                    {activeClip.waveform.slice(0, 48).map((v, i) => (
                      <span key={i} style={{ height: `${Math.max(4, v * 100)}%` }} />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="video-preview__empty">
              <p className="video-preview__empty-title">Select a clip to preview</p>
            </div>
          )}

          {hasMedia && activeClip?.type === 'text' && (activeClip as any).textContent && (
            <div className="video-preview__text" style={(activeClip as any).textStyle as React.CSSProperties}>
              <h2>{(activeClip as any).textContent}</h2>
            </div>
          )}

          {/* Side handles — drag outwards to make the canvas longer. */}
          <div
            className={`video-preview__side-handle is-left ${zoomActive ? 'is-active' : ''} ${zoomBoundary ? `is-at-${zoomBoundary}` : ''}`}
            onPointerDown={beginResize(onLeftDown)}
            title="Drag to resize"
            aria-label="Resize preview from the left"
          >
            <span className="video-preview__grip" />
          </div>
          <div
            className={`video-preview__side-handle is-right ${zoomActive ? 'is-active' : ''} ${zoomBoundary ? `is-at-${zoomBoundary}` : ''}`}
            onPointerDown={beginResize(onRightDown)}
            title="Drag to resize"
            aria-label="Resize preview from the right"
          >
            <span className="video-preview__grip" />
          </div>

          {/* Corner drag to resize the whole preview (editing convenience zoom) */}
          <div
            className={`video-preview__corner-handle ${zoomActive ? 'is-active' : ''} ${zoomBoundary ? `is-at-${zoomBoundary}` : ''}`}
            onPointerDown={beginResize(onCornerDown)}
            title="Drag corner to resize"
            aria-label="Resize preview"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M8 2 L8 8 L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              <path d="M8 5 L5 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
            </svg>
          </div>

          {/* Live scale readout while resizing — quiet, and only while dragging. */}
          {zoomActive && !limitNote && <div className="preview-limit-indicator">{zoomLabel}</div>}

          {/* One short line at the bottom, gone in 2s, when a limit is reached. */}
          {limitNote && (
            <div className={`preview-limit-indicator is-note is-${limitNote.tone}`}>{limitNote.text}</div>
          )}
        </div>
      </div>

      {hasMedia && (
        <button className="video-preview__play" onClick={onPlayToggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
          )}
        </button>
      )}
    </div>
  );
}
