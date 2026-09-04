import React from 'react';
import { Clip } from '../editor-types/editorTypes';
import { VideoIcon, ImageIcon, AudioIcon } from '../icons/Icon';

interface TimelineClipProps {
  clip: Clip;
  pixelsPerSecond: number;
  isSelected: boolean;
  isMuted: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
  isAtLimit?: boolean;
  onSelect: (e: React.MouseEvent, clip: Clip) => void;
  onMouseDown: (e: React.MouseEvent, clip: Clip, edge?: 'left' | 'right') => void;
  onDoubleClick?: (clip: Clip) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimelineClip({ clip, pixelsPerSecond, isSelected, isMuted, isLocked, isHidden, isAtLimit, onSelect, onMouseDown, onDoubleClick }: TimelineClipProps) {
  const left = clip.timelineStart * pixelsPerSecond;
  const width = Math.max(48, clip.duration * pixelsPerSecond);

  const typeColor =
    clip.type === 'video' ? '#0891B2' : clip.type === 'audio' ? '#D97706' : clip.type === 'image' ? '#16A34A' : '#7C3AED';

  const handleMouseDown = (e: React.MouseEvent, edge?: 'left' | 'right') => {
    if (isLocked || isHidden) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onMouseDown(e, clip, edge);
  };

  const thumbs = (clip as any).thumbnails as string[] | undefined;

  const hasEffect = !!(clip as any).effects?.length || !!(clip as any).colorGrade && Object.keys((clip as any).colorGrade).length;
  const isVideoWithAudio = clip.type === 'video' && (clip as any).hasEmbeddedAudio;

  return (
    <div
      className={`timeline-clip timeline-clip--${clip.type} ${isSelected ? 'selected' : ''} ${clip.hidden || isMuted || isHidden ? 'muted' : ''} ${isLocked ? 'locked' : ''} ${isVideoWithAudio && (clip as any).embeddedAudioMuted ? 'audio-muted' : ''} ${isAtLimit ? 'at-limit' : ''}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        borderColor: isAtLimit ? '#F472B6' : isSelected ? 'var(--launchly-accent, #0891B2)' : 'transparent',
        opacity: isHidden ? 0.45 : undefined,
      } as React.CSSProperties}
      onClick={(e) => onSelect(e, clip)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (clip.type === 'video' && (clip as any).hasEmbeddedAudio !== undefined) {
          // only video tracks allow audio toggle; image/text not
          if ((e as any).detail === 2) {
            (onDoubleClick as any)?.(clip);
          }
        } else if (clip.type === 'video') {
          (onDoubleClick as any)?.(clip);
        }
      }}
      onMouseDown={(e) => handleMouseDown(e)}
      title={`${clip.name} · ${formatDuration(clip.duration)}${isLocked ? ' — locked' : ''}${isVideoWithAudio ? ((clip as any).embeddedAudioMuted ? ' · audio muted (double-click to unmute)' : ' · video + audio (double-click to mute audio)') : ''}${hasEffect ? ' · has effect' : ''} — drag to move, edges to trim`}
    >
      <div className="timeline-clip__accent" style={{ background: typeColor }} />
      {clip.type === 'video' && (thumbs && thumbs.length ? (
        <div className="timeline-clip__filmstrip">
          {Array.from({ length: Math.max(1, Math.ceil(width / 80)) }).map((_, i) => {
            const thumb = thumbs[i % thumbs.length];
            return <div key={i} className="timeline-clip__filmstrip-frame" style={{ backgroundImage: `url(${thumb})` }} />;
          })}
        </div>
      ) : clip.thumbnail ? (
        <div className="timeline-clip__thumb" style={{ backgroundImage: `url(${clip.thumbnail})` }} />
      ) : null)}
      {clip.type === 'image' && clip.thumbnail && (
        <div className="timeline-clip__thumb" style={{ backgroundImage: `url(${clip.thumbnail})` }} />
      )}
      <div className="timeline-clip__content">
        <span className="timeline-clip__icon">
          {clip.type === 'video' ? <VideoIcon size={12} /> : clip.type === 'image' ? <ImageIcon size={12} /> : <AudioIcon size={12} />}
        </span>
        <span className="timeline-clip__name">{clip.name}</span>
        <span className="timeline-clip__duration">{formatDuration(clip.duration)}</span>
        {clip.hasEmbeddedAudio && !clip.audioDetached && (
          <span className={`timeline-clip__linked-badge ${(clip as any).embeddedAudioMuted ? 'muted' : ''}`} title={(clip as any).embeddedAudioMuted ? 'Audio muted — double-click to unmute' : 'Linked audio — double-click to mute'}>♪</span>
        )}
        {hasEffect && <span className="timeline-clip__effect-badge" title="Has effect">fx</span>}
      </div>
      {clip.type === 'video' && (clip as any).hasEmbeddedAudio && clip.waveform && (
        <div className="timeline-clip__embedded-wave">
          {clip.waveform.slice(0, Math.max(12, Math.floor(width / 6))).map((v: number, i: number) => (
            <span key={i} style={{ height: `${Math.max(2, v * 100)}%` }} />
          ))}
        </div>
      )}
      {clip.waveform && clip.waveform.length > 0 && clip.type === 'audio' && (
        <div className="timeline-clip__waveform">
          {clip.waveform.slice(0, 40).map((v, i) => (
            <span key={i} style={{ height: `${Math.max(4, v * 100)}%` }} />
          ))}
        </div>
      )}
      {!isLocked && !isHidden && (
        <>
          <div className="timeline-clip__handle timeline-clip__handle--left" onMouseDown={(e) => handleMouseDown(e, 'left')} title="Trim start" />
          <div className="timeline-clip__handle timeline-clip__handle--right" onMouseDown={(e) => handleMouseDown(e, 'right')} title="Trim end" />
        </>
      )}
    </div>
  );
}
