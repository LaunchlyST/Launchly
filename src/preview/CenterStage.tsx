import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../editor-state/editorStore';
import { Clip, Track } from '../editor-types/editorTypes';
import { importMediaFiles } from '../upload/mediaImport';

interface CenterStageProps {
  canvasZoom: number;
  onCanvasZoomChange: (zoom: number) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  previewVolume: number;
  onPreviewVolumeChange: (volume: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  currentTime: number;
  onCurrentTimeChange: (time: number) => void;
  duration: number;
  onDurationChange: (duration: number) => void;
  fps: number;
  onFpsChange: (fps: number) => void;
  safeZonesEnabled: boolean;
  onSafeZonesToggle: (enabled: boolean) => void;
  guidesEnabled: boolean;
  onGuidesToggle: (enabled: boolean) => void;
  gridEnabled: boolean;
  onGridToggle: (enabled: boolean) => void;
  clips: Clip[];
  tracks: Track[];
  selectedClipIds: string[];
  onClipsChange: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;
  onTracksChange: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  onSelectionChange: (ids: string[]) => void;
  onTimeChange: (time: number) => void;
}

export function CenterStage({
  canvasZoom,
  onCanvasZoomChange,
  playbackSpeed,
  onPlaybackSpeedChange,
  previewVolume,
  onPreviewVolumeChange,
  playing,
  onPlayToggle,
  currentTime,
  onCurrentTimeChange,
  duration,
  onDurationChange,
  fps,
  onFpsChange,
  safeZonesEnabled,
  onSafeZonesToggle,
  guidesEnabled,
  onGuidesToggle,
  gridEnabled,
  onGridToggle,
  clips,
  tracks,
  selectedClipIds,
  onClipsChange,
  onTracksChange,
  onSelectionChange,
  onTimeChange,
}: CenterStageProps) {
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hoveredClip, setHoveredClip] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const selectedClips = clips.filter((c) => selectedClipIds.includes(c.id));
  const activeClip = selectedClips[0] || clips.find((c) => c.trackId === 'video-1' && c.timelineStart <= currentTime && c.timelineStart + c.duration > currentTime);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    const targetTime = currentTime - activeClip.timelineStart + activeClip.start;
    if (Math.abs(video.currentTime - targetTime) > 0.1) {
      video.currentTime = targetTime;
    }
  }, [currentTime, activeClip]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        onPlayToggle();
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onTimeChange(Math.max(0, currentTime - 1 / fps));
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        onTimeChange(Math.min(duration, currentTime + 1 / fps));
      }
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        onTimeChange(Math.max(0, currentTime - 10 / fps));
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        onTimeChange(Math.min(duration, currentTime + 10 / fps));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, fps, onPlayToggle, onTimeChange]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const videoTrack = tracks.find((t) => t.type === 'video');
    const audioTrack = tracks.find((t) => t.type === 'audio');
    if (!videoTrack) return;

    const videoTrackId = videoTrack.id;
    const audioTrackId = audioTrack?.id || 'audio-1';

    const result = await importMediaFiles(files, videoTrackId, audioTrackId, clips);

    if (result.clips.length > 0) {
      onClipsChange((prev) => [...prev, ...result.clips]);
      onTimeChange(0);

      if (result.totalDuration > duration) {
        onDurationChange(result.totalDuration);
      }
    }
  };

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeClip || activeClip.type !== 'audio') return;
    if (playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playing, activeClip]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeClip || activeClip.type !== 'audio') return;
    const targetTime = currentTime - activeClip.timelineStart + activeClip.start;
    if (Math.abs(audio.currentTime - targetTime) > 0.1) {
      audio.currentTime = targetTime;
    }
  }, [currentTime, activeClip]);

  const hasMedia = clips.length > 0;

  return (
    <section className="center-stage">
      {hasMedia && (
      <div className="stage-header">
        <div className="asset-dock glass-panel">
          <div className="panel-heading">
            <p>Scene Kit</p>
            <button>Browse</button>
          </div>
          <div className="asset-grid">
            {tracks.filter((t) => t.type === 'video').map((track) => (
              <article key={track.id} className={`asset-card ${track.color.replace('#', '')} ${track.id === 'video-1' ? 'active' : ''}`}>
                <span>{track.name}</span>
                <strong>{clips.filter((c) => c.trackId === track.id).reduce((sum, c) => sum + c.duration, 0).toFixed(2)}s</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="canvas-toolbar glass-panel">
          <button className={canvasZoom === 0.5625 ? 'active' : ''} onClick={() => onCanvasZoomChange(0.5625)} title="9:16 Vertical">9:16</button>
          <button className={canvasZoom === 1 ? 'active' : ''} onClick={() => onCanvasZoomChange(1)} title="4K Landscape">4K</button>
          <button className={canvasZoom === 1.777 ? 'active' : ''} onClick={() => onCanvasZoomChange(1.777)} title="16:9 HD">16:9</button>
          <button className={canvasZoom === 1 ? 'active' : ''} onClick={() => onCanvasZoomChange(1)} title="1:1 Square">1:1</button>
          <button onClick={() => onSafeZonesToggle(!safeZonesEnabled)} className={safeZonesEnabled ? 'active' : ''} title="Safe Zones">Safe Zones</button>
          <button onClick={() => onGuidesToggle(!guidesEnabled)} className={guidesEnabled ? 'active' : ''} title="Guides">Guides</button>
          <button onClick={() => onGridToggle(!gridEnabled)} className={gridEnabled ? 'active' : ''} title="Grid">Grid</button>
          <button title="Fullscreen Preview">⛶</button>
        </div>

        <div className="ai-strip glass-panel">
          <span>Creative Assist</span>
          <p>Pacing, caption, and polish suggestions.</p>
        </div>
      </div>
      )}

      <div className="viewer">
        <div className="ambient-ring" />
        <div
          ref={videoFrameRef}
          className={`video-frame ${safeZonesEnabled ? 'show-safe' : ''} ${guidesEnabled ? 'show-guides' : ''} ${gridEnabled ? 'show-grid' : ''} ${dragOver ? 'drag-over' : ''}`}
          style={{
            transform: `scale(${canvasZoom})`,
            filter: `hue-rotate(0deg) brightness(1) contrast(1) saturate(1)`,
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="safe-zone-overlay" />
          <div className="guide-overlay" />
          <div className="grid-overlay" />
          <div className="render-scanline" style={{ width: `${(currentTime / duration) * 100}%` }} />
          <div className="effects-preview-overlay" />
          <div className="frame-glow" />

          {activeClip && activeClip.type === 'video' && (
            <video
              ref={videoRef}
              src={activeClip.src}
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}

          {activeClip && activeClip.type === 'audio' && (
            <>
              <audio ref={audioRef} src={activeClip.src} />
              <div className="audio-visual" style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(255, 212, 122, 0.05) 0%, rgba(255, 140, 173, 0.05) 100%)',
              }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--accent-amber, #ffd47a)', opacity: 0.4 }}>
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            </>
          )}

          <div className="preview-hud">
            <span data-preview-status>{playing ? 'GPU smooth' : 'Paused'}</span>
            <span data-preview-fps>{fps} fps</span>
          </div>

          {activeClip && activeClip.type === 'text' && activeClip.textContent && (
            <div className="scene-card" style={activeClip.textStyle as React.CSSProperties}>
              <span className="scene-kicker">{activeClip.name}</span>
              <h1>{activeClip.textContent}</h1>
            </div>
          )}

          {clips.length === 0 ? (
            <div className="empty-workspace" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
              <div className="ew-topbar">
                <div className="ew-topbar-left">
                  <span className="ew-logo">Launchly</span>
                  <span className="ew-separator">|</span>
                  <span className="ew-project-name">Untitled Project</span>
                </div>
                <div className="ew-topbar-right">
                  <button className="ew-topbar-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                    Search
                  </button>
                  <button className="ew-topbar-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" /></svg>
                    Shortcuts
                  </button>
                </div>
              </div>

              <div className="ew-hero">
                <div className={`ew-dropzone ${dragOver ? 'drag-over' : ''}`}>
                  <div className="ew-dropzone-border" />
                  <div className="ew-dropzone-content">
                    <div className="ew-upload-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <button className="ew-upload-btn" onClick={() => document.getElementById('ew-upload-all')?.click()}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Upload Media
                    </button>
                    <input id="ew-upload-all" type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
                    <span className="ew-drop-hint">or drag & drop files anywhere</span>
                  </div>
                </div>

                <div className="ew-quick-row">
                  <button className="ew-quick" onClick={() => document.getElementById('ew-upload-video')?.click()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><polygon points="23,7 16,12 23,17" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                    Video
                  </button>
                  <input id="ew-upload-video" type="file" accept="video/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
                  <button className="ew-quick" onClick={() => document.getElementById('ew-upload-image')?.click()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21,15 16,10 5,21" /></svg>
                    Images
                  </button>
                  <input id="ew-upload-image" type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
                  <button className="ew-quick" onClick={() => document.getElementById('ew-upload-audio')?.click()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                    Audio
                  </button>
                  <input id="ew-upload-audio" type="file" accept="audio/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
                  <div className="ew-quick-divider" />
                  <button className="ew-quick accent">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 4l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></svg>
                    AI Generate
                  </button>
                  <button className="ew-quick">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                    Templates
                  </button>
                </div>
              </div>

              <div className="ew-grid">
                <div className="ew-section">
                  <div className="ew-section-head">
                    <h3>Recent Projects</h3>
                    <button className="ew-section-link">View all</button>
                  </div>
                  <div className="ew-cards">
                    <div className="ew-card project-card empty">
                      <div className="ew-card-thumb">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                      </div>
                      <span className="ew-card-title">No projects yet</span>
                      <span className="ew-card-sub">Create your first project</span>
                    </div>
                  </div>
                </div>

                <div className="ew-section">
                  <div className="ew-section-head">
                    <h3>Templates</h3>
                    <button className="ew-section-link">Browse all</button>
                  </div>
                  <div className="ew-cards">
                    {['Product Launch', 'Social Reel', 'Podcast Intro', 'Corporate'].map((t) => (
                      <div key={t} className="ew-card template-card">
                        <div className="ew-card-thumb template" data-template={t.toLowerCase().replace(/\s/g, '-')}>
                          <span>{t.charAt(0)}</span>
                        </div>
                        <span className="ew-card-title">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ew-section">
                  <div className="ew-section-head">
                    <h3>AI Projects</h3>
                    <button className="ew-section-link">Explore</button>
                  </div>
                  <div className="ew-cards">
                    {['Auto Edit', 'Captions', 'Color Grade', 'Scene Detect'].map((t) => (
                      <div key={t} className="ew-card ai-card">
                        <div className="ew-card-thumb ai">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 4l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></svg>
                        </div>
                        <span className="ew-card-title">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ew-section">
                  <div className="ew-section-head">
                    <h3>Stock Library</h3>
                    <button className="ew-section-link">Browse</button>
                  </div>
                  <div className="ew-cards">
                    <div className="ew-card stock-card">
                      <div className="ew-card-thumb stock">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="23,7 16,12 23,17" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      </div>
                      <span className="ew-card-title">Free Videos</span>
                      <span className="ew-card-sub">10,000+ clips</span>
                    </div>
                    <div className="ew-card stock-card">
                      <div className="ew-card-thumb stock">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                      </div>
                      <span className="ew-card-title">Music</span>
                      <span className="ew-card-sub">5,000+ tracks</span>
                    </div>
                    <div className="ew-card stock-card">
                      <div className="ew-card-thumb stock">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21,15 16,10 5,21" /></svg>
                      </div>
                      <span className="ew-card-title">Images</span>
                      <span className="ew-card-sub">50,000+ images</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ew-footer">
                <div className="ew-shortcuts">
                  <span className="ew-shortcut"><kbd>Space</kbd> Play</span>
                  <span className="ew-shortcut"><kbd>Ctrl+K</kbd> Search</span>
                  <span className="ew-shortcut"><kbd>Ctrl+E</kbd> Export</span>
                  <span className="ew-shortcut"><kbd>S</kbd> Split</span>
                  <span className="ew-shortcut"><kbd>Del</kbd> Delete</span>
                  <span className="ew-shortcut"><kbd>?</kbd> All shortcuts</span>
                </div>
                <div className="ew-formats">
                  MP4, MOV, AVI, MKV, WebM, PNG, JPG, WebP, GIF, MP3, WAV, AAC, FLAC
                </div>
              </div>
            </div>
          ) : null}

          {clips.length > 0 && (
            <div className="play-head">
              <button onClick={onPlayToggle} aria-label={playing ? 'Pause preview' : 'Play preview'}>
                {playing ? '⏸' : '▶'}
              </button>
            </div>
          )}

          {clips.length > 0 && <div className="focus-chip">Subject lock: 92%</div>}
          {clips.length > 0 && <div className="meter-chip">Luma balanced</div>}
        </div>
      </div>

      {hasMedia && (
      <div className="transport glass-panel">
        <div className="timecode">
          <span data-timecode>{formatTime(currentTime)}</span>
          <small>/ <span data-total-duration>{formatTime(duration)}</span></small>
        </div>
        <div className="transport-buttons">
          <button onClick={() => onTimeChange(Math.max(0, currentTime - 10 / fps))} title="-10 frames">-10</button>
          <button onClick={() => onTimeChange(Math.max(0, currentTime - 1 / fps))} title="-1 frame">-1</button>
          <button className="play" onClick={onPlayToggle} title={playing ? 'Pause' : 'Play'}>
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={() => onTimeChange(Math.min(duration, currentTime + 1 / fps))} title="+1 frame">+1</button>
          <button onClick={() => onTimeChange(Math.min(duration, currentTime + 10 / fps))} title="+10 frames">+10</button>
        </div>
        <div className="preview-controls">
          <label className="speed-control">
            Speed
            <select value={playbackSpeed} onChange={(e) => onPlaybackSpeedChange(Number(e.target.value))} aria-label="Playback speed">
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </label>
          <label className="volume-control">
            Vol
            <input
              type="range"
              min="0"
              max="100"
              value={previewVolume * 100}
              onChange={(e) => onPreviewVolumeChange(Number(e.target.value) / 100)}
              aria-label="Preview volume"
            />
          </label>
          <label>
            Canvas
            <input
              type="range"
              min="25"
              max="400"
              value={canvasZoom * 100}
              onChange={(e) => onCanvasZoomChange(Number(e.target.value) / 100)}
              aria-label="Canvas zoom"
            />
          </label>
        </div>
      </div>
      )}
    </section>
  );
}