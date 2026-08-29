import React from 'react';
import { Track, Clip } from '../editor-types/editorTypes';
import { TimelineClip } from './TimelineClip';

interface TimelineTrackProps {
  track: Track;
  clips: Clip[];
  pixelsPerSecond: number;
  selectedClipIds: string[];
  isMuted: boolean;
  trimLimitId?: string | null;
  /** Sequential number within this track's own type: V1, V2 … A1, A2 … T1. */
  displayNumber: number;
  /** True for the first row, or any row holding a clip of any kind. */
  showControls: boolean;
  onSelect: (e: React.MouseEvent, clip: Clip) => void;
  onMouseDown: (e: React.MouseEvent, clip: Clip, edge?: 'left' | 'right') => void;
  onDoubleClick?: (clip: Clip) => void;
  onToggleVisibility: (trackId: string) => void;
  onToggleLock: (trackId: string) => void;
  onToggleMute: (trackId: string) => void;
  /** Media dragged over this lane — used to highlight the row under the cursor. */
  isDropTarget?: boolean;
  onLaneDragOver?: (e: React.DragEvent, trackId: string) => void;
  onLaneDrop?: (e: React.DragEvent, trackId: string) => void;
}

const TRACK_META: Record<string, { icon: string; label: string }> = {
  video: { icon: '🎬', label: 'V' },
  audio: { icon: '♪', label: 'A' },
  text: { icon: 'T', label: 'T' },
  caption: { icon: '≡', label: 'T' },
};

function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.59 9.59A2 2 0 0 0 12 14a2 2 0 0 0 2.41-2.41" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return locked ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.02" />
    </svg>
  );
}

export function TimelineTrack({ track, clips, pixelsPerSecond, selectedClipIds, isMuted, trimLimitId, displayNumber, showControls, onSelect, onMouseDown, onDoubleClick, onToggleVisibility, onToggleLock, onToggleMute, isDropTarget, onLaneDragOver, onLaneDrop }: TimelineTrackProps) {
  const meta = TRACK_META[track.type] ?? { icon: '•', label: (track.type[0] ?? 'V').toUpperCase() };
  // Always derive the label from the live position. The `label` stored on the
  // track is fixed at creation and goes stale as soon as a row is removed.
  const displayLabel = `${meta.label}${displayNumber}`;
  const isHidden = track.visible === false;
  const isLocked = track.locked;
  const isTrackMuted = track.muted || isMuted;
  const laneClips = clips.filter((c) => c.trackId === track.id);

  return (
    <div className={`timeline-track ${isLocked ? 'locked' : ''} ${isHidden ? 'hidden-track' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}>
      <div className={`timeline-track__label ${showControls ? '' : 'timeline-track__label--empty'}`}>
        {showControls && (
          <>
            <span className="timeline-track__name" title={`${track.type} • ${track.name}`}>{displayLabel}</span>
            <div className="timeline-track__controls">
              <button
                className={`track-ctrl ${isHidden ? 'off' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(track.id); }}
                title={isHidden ? 'Show track' : 'Hide track'}
                aria-label={isHidden ? 'Show' : 'Hide'}
              >
                <EyeIcon off={isHidden} />
              </button>
              <button
                className={`track-ctrl ${isLocked ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleLock(track.id); }}
                title={isLocked ? 'Unlock track' : 'Lock track'}
                aria-label={isLocked ? 'Unlock' : 'Lock'}
              >
                <LockIcon locked={isLocked} />
              </button>
              {track.type === 'audio' ? (
                <button
                  className={`track-ctrl ${isTrackMuted ? 'off' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleMute(track.id); }}
                  title={isTrackMuted ? 'Unmute' : 'Mute'}
                  aria-label={isTrackMuted ? 'Unmute' : 'Mute'}
                >
                  <SpeakerIcon muted={!!isTrackMuted} />
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
      <div
        className={`timeline-track__lane ${isHidden ? 'lane-hidden' : ''}`}
        onDragOver={(e) => onLaneDragOver?.(e, track.id)}
        onDrop={(e) => onLaneDrop?.(e, track.id)}
      >
        {laneClips
          .map((clip) => (
            <TimelineClip
              key={clip.id}
              clip={clip}
              pixelsPerSecond={pixelsPerSecond}
              isSelected={selectedClipIds.includes(clip.id)}
              isMuted={!!isTrackMuted}
              isLocked={isLocked}
              isHidden={isHidden}
              isAtLimit={trimLimitId === clip.id}
              onSelect={onSelect}
              onMouseDown={onMouseDown}
              onDoubleClick={onDoubleClick}
            />
          ))}
      </div>
    </div>
  );
}
