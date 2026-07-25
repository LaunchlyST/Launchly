import React, { forwardRef, useState, useRef, useEffect, useImperativeHandle } from 'react';
import { glassmorphismStyles, theme } from '../styles/theme';

export interface VideoPreviewProps {
  clips: any[];
  tracks: any[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  projectSettings: any;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  ref?: React.RefObject<HTMLVideoElement>;
}

export const VideoPreview = forwardRef<HTMLDivElement, VideoPreviewProps>(
  ({ clips, tracks, currentTime, duration, isPlaying, volume, playbackRate, projectSettings, onTimeUpdate, onSeek }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>();

    useImperativeHandle(ref, () => ({
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      seek: (time: number) => { videoRef.current!.currentTime = time; },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
      getDuration: () => videoRef.current?.duration || 0,
    }));

    const activeClips = clips.filter(clip => 
      clip.startTime <= currentTime && clip.endTime > currentTime
    ).sort((a, b) => (a.trackIndex || 0) - (b.trackIndex || 0));

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.volume = volume;
        videoRef.current.playbackRate = playbackRate;
      }
    }, [volume, playbackRate]);

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        onTimeUpdate(videoRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        onSeek(currentTime);
      }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);

      const rect = containerRef.current!.getBoundingClientRect();
      const percentage = (e.clientX - rect.left) / rect.width;
      setHoverTime(percentage * duration);
    };

    const handleMouseLeave = () => {
      setHoverTime(null);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 1000);
    };

    const formatTime = (time: number) => {
      const h = Math.floor(time / 3600);
      const m = Math.floor((time % 3600) / 60);
      const s = Math.floor(time % 60);
      const ms = Math.floor((time % 1) * 100);
      return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}` 
        : `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    return (
      <div
        ref={containerRef}
        className="video-preview"
        style={{
          ...glassmorphismStyles.previewContainer,
          aspectRatio: projectSettings.aspectRatio || '16/9',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="preview-frame" style={glassmorphismStyles.previewFrame}>
          <canvas
            ref={canvasRef}
            className="preview-canvas"
            style={glassmorphismStyles.previewCanvas}
            width={projectSettings.width || 1920}
            height={projectSettings.height || 1080}
          />
          <video
            ref={videoRef}
            className="preview-video"
            style={glassmorphismStyles.previewVideo}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            playsInline
            muted={false}
          >
            {activeClips.map(clip => (
              <source key={clip.id} src={clip.mediaUrl} type={clip.mimeType} />
            ))}
          </video>

          <div className="preview-overlay" style={glassmorphismStyles.previewOverlay}>
            {activeClips.length === 0 && (
              <div className="preview-placeholder" style={glassmorphismStyles.previewPlaceholder}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                  <line x1="7" y1="2" x2="7" y2="22" />
                  <line x1="17" y1="2" x2="17" y2="22" />
                  <line x1="2" y1="7" x2="22" y2="7" />
                  <line x1="2" y1="17" x2="22" y2="17" />
                </svg>
                <p style={glassmorphismStyles.placeholderText}>No clip at playhead</p>
                <span style={glassmorphismStyles.placeholderSubtext}>{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
            )}

            {hoverTime !== null && (
              <div className="hover-time-indicator" style={{
                ...glassmorphismStyles.hoverIndicator,
                left: `${(hoverTime / duration) * 100}%`,
              }}>
                <span style={glassmorphismStyles.hoverTimeText}>{formatTime(hoverTime)}</span>
                <div style={glassmorphismStyles.hoverLine} />
              </div>
            )}
          </div>

          <div className="safe-zones" style={glassmorphismStyles.safeZones}>
            <div className="safe-zone action" style={glassmorphismStyles.actionSafe} title="Action Safe (90%)" />
            <div className="safe-zone title" style={glassmorphismStyles.titleSafe} title="Title Safe (80%)" />
          </div>
        </div>

        {showControls && (
          <div className="preview-controls" style={glassmorphismStyles.previewControls}>
            <div className="controls-left" style={glassmorphismStyles.controlsGroup}>
              <button
                className="control-btn"
                onClick={() => videoRef.current?.play()}
                disabled={isPlaying}
                style={glassmorphismStyles.controlButton}
                aria-label="Play"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21" /></svg>
              </button>
              <button
                className="control-btn"
                onClick={() => videoRef.current?.pause()}
                disabled={!isPlaying}
                style={glassmorphismStyles.controlButton}
                aria-label="Pause"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              </button>
              <button
                className="control-btn"
                onClick={() => videoRef.current && (videoRef.current.currentTime = 0)}
                style={glassmorphismStyles.controlButton}
                aria-label="Restart"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v16l12-8z" /></svg>
              </button>
            </div>

            <div className="controls-center" style={glassmorphismStyles.controlsGroup}>
              <div className="timecode-display" style={glassmorphismStyles.timecodeDisplay}>
                <span>{formatTime(currentTime)}</span>
                <span style={{ color: theme.colors.textMuted, margin: '0 8px' }}> / </span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="progress-bar" style={glassmorphismStyles.progressBar} onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percentage = (e.clientX - rect.left) / rect.width;
                onSeek(percentage * duration);
              }}>
                <div 
                  className="progress-fill" 
                  style={{
                    ...glassmorphismStyles.progressFill,
                    width: `${(currentTime / duration) * 100}%`,
                  }}
                />
                <div 
                  className="progress-handle" 
                  style={{
                    ...glassmorphismStyles.progressHandle,
                    left: `${(currentTime / duration) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="controls-right" style={glassmorphismStyles.controlsGroup}>
              <div className="volume-control" style={glassmorphismStyles.volumeControl}>
                <button
                  className="control-btn"
                  onClick={() => videoRef.current && (videoRef.current.muted = !videoRef.current.muted)}
                  style={glassmorphismStyles.controlButton}
                  aria-label={videoRef.current?.muted ? 'Unmute' : 'Mute'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    {videoRef.current?.muted ? (
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </>
                    ) : (
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    )}
                  </svg>
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => { videoRef.current!.volume = parseFloat(e.target.value); }}
                  style={glassmorphismStyles.volumeSlider}
                />
              </div>

              <div className="playback-rate" style={glassmorphismStyles.playbackRate}>
                <select
                  value={playbackRate}
                  onChange={(e) => { videoRef.current!.playbackRate = parseFloat(e.target.value); }}
                  style={glassmorphismStyles.rateSelect}
                  aria-label="Playback speed"
                >
                  <option value="0.25">0.25x</option>
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>

              <button
                className="control-btn"
                onClick={() => {
                  if (containerRef.current) {
                    if (!isFullscreen) {
                      containerRef.current.requestFullscreen();
                    } else {
                      document.exitFullscreen();
                    }
                    setIsFullscreen(!isFullscreen);
                  }
                }}
                style={glassmorphismStyles.controlButton}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {isFullscreen ? (
                    <>
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    </>
                  ) : (
                    <>
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="preview-quality-badge" style={glassmorphismStyles.qualityBadge}>
          {projectSettings.resolution || '1080p'} • {projectSettings.fps || 30}fps
        </div>
      </div>
    );
  }
);

VideoPreview.displayName = 'VideoPreview';