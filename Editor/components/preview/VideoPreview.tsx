import React, { useRef, useEffect, useState } from 'react';
import { Clip } from '../../types';
import { getAspectRatioById } from '../../config/aspectRatios';
import { sound } from '../../lib/sound';

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
}

export function VideoPreview({ clips, tracks = [], selectedClipIds, currentTime, duration, playing, onPlayToggle, aspectRatio, isMuted, onDrop }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [limitPhase, setLimitPhase] = useState<'idle' | 'near' | 'limit'>('idle');
  const [isBouncing, setIsBouncing] = useState(false);
  const resizingRef = useRef<{ startX: number; startY: number; startScale: number } | null>(null);
  const lastTickRef = useRef(0);
  const hasHitLimitRef = useRef(false);

  const preset = getAspectRatioById(aspectRatio);
  const ratioStyle = preset ? `${preset.width} / ${preset.height}` : '16 / 9';

  const handleCornerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { startX: e.clientX, startY: e.clientY, startScale: previewScale };
    hasHitLimitRef.current = false;
    let lastScale = previewScale;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const dx = ev.clientX - resizingRef.current.startX;
      const dy = ev.clientY - resizingRef.current.startY;
      const rawDelta = (dx + dy) / 400;
      const rawNext = resizingRef.current.startScale + rawDelta;
      const clamped = Math.max(0.6, Math.min(1.6, rawNext));
      const isAtLimit = rawNext < 0.6 || rawNext > 1.6;
      // Resistance near limit + progressive color
      const distToMin = clamped - 0.6;
      const distToMax = 1.6 - clamped;
      const nearestDist = Math.min(distToMin, distToMax);
      if (nearestDist < 0.15) {
        setLimitPhase('near');
        // subtle resistance: move slower near limit
        const resistance = 0.35 + (nearestDist / 0.15) * 0.65;
        const resistedDelta = rawDelta * resistance;
        const resisted = Math.max(0.6, Math.min(1.6, resizingRef.current.startScale + resistedDelta));
        if (Math.abs(resisted - lastScale) > 0.008 && Date.now() - lastTickRef.current > 90) {
          lastTickRef.current = Date.now();
          sound.tick();
        }
        setPreviewScale(resisted);
        lastScale = resisted;
      } else {
        setLimitPhase('idle');
        if (Math.abs(clamped - lastScale) > 0.015 && Date.now() - lastTickRef.current > 70) {
          lastTickRef.current = Date.now();
          sound.tick();
        }
        setPreviewScale(clamped);
        lastScale = clamped;
      }
      if (isAtLimit && !hasHitLimitRef.current) {
        hasHitLimitRef.current = true;
        setLimitPhase('limit');
        setIsBouncing(true);
        sound.limit();
        setTimeout(() => setIsBouncing(false), 280);
        setTimeout(() => setLimitPhase('idle'), 700);
      } else if (!isAtLimit) {
        hasHitLimitRef.current = false;
      }
    };
    const onUp = () => {
      resizingRef.current = null;
      setLimitPhase('idle');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

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
    if (playing && !isActiveMuted) video.play().catch(() => {});
    else if (playing && isActiveMuted) video.play().catch(() => {}); // still play picture muted
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

  return (
    <div className="video-preview" onDragOver={handleDragOver} onDrop={onDrop}>
      <div className="video-preview__frame-wrap" style={{ aspectRatio: ratioStyle, transform: `scale(${previewScale})`, transformOrigin: 'center' } as React.CSSProperties}>
        <div className={`video-preview__frame limit-${limitPhase} ${isBouncing ? 'limit-bounce' : ''}`} ref={frameRef}>
          {!hasMedia ? (
            <div className="video-preview__empty">
              <div className="video-preview__empty-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="15" height="14" rx="2" ry="2" />
                  <polygon points="23 7 16 12 23 17" />
                </svg>
              </div>
              <p className="video-preview__empty-title">Upload Project</p>
              <p className="video-preview__empty-subtitle">Your preview will appear here</p>
              <p className="video-preview__empty-hint">Upload media and drag it to the timeline to start editing</p>
            </div>
          ) : activeClip?.type === 'video' && activeClip.src ? (
            <video
              ref={videoRef}
              src={activeClip.src}
              className="video-preview__video"
              playsInline
              muted={isActiveMuted}
            />
          ) : activeClip?.type === 'image' && activeClip.src ? (
            <img src={activeClip.src} alt={activeClip.name} className="video-preview__image" />
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

          {hasMedia && activeClip?.type === 'text' && activeClip.textContent && (
            <div className="video-preview__text" style={activeClip.textStyle as React.CSSProperties}>
              <h2>{activeClip.textContent}</h2>
            </div>
          )}
          {/* Corner drag to resize preview */}
          <div className="video-preview__corner-handle" onMouseDown={handleCornerMouseDown} title="Drag corner to resize" aria-label="Resize preview">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M8 2 L8 8 L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
              <path d="M8 5 L5 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </div>
          {limitPhase !== 'idle' && (
            <div className={`preview-limit-indicator ${limitPhase}`}>
              {limitPhase === 'limit' ? 'Limit reached' : `${Math.round(previewScale * 100)}%`}
            </div>
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
