import React from 'react';
import { Clip } from '../../types';
import { VideoIcon, ImageIcon, AudioIcon } from '../common/Icon';

interface MediaItemProps {
  clip: Clip;
  onDragStart: (e: React.DragEvent, clip: Clip) => void;
  onSelect?: (clip: Clip) => void;
  isSelected?: boolean;
  onDelete?: (clip: Clip) => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MediaItem({ clip, onDragStart, onSelect, isSelected, onDelete }: MediaItemProps) {
  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(e, clip);
  };

  const handleClick = () => {
    onSelect?.(clip);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(clip);
  };

  return (
    <div
      className={`media-item-card ${isSelected ? 'selected' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      title={`Drag to timeline — ${clip.name}`}
    >
      <div className={`media-item-card__thumb media-item-card__thumb--${clip.type}`}>
        {clip.thumbnail ? (
          <img src={clip.thumbnail} alt={clip.name} className="media-item-card__img" />
        ) : clip.type === 'video' ? (
          <VideoIcon size={18} />
        ) : clip.type === 'image' ? (
          <ImageIcon size={18} />
        ) : (
          <AudioIcon size={18} />
        )}
        {clip.type === 'audio' && clip.waveform && clip.waveform.length > 0 && (
          <div className="media-item-card__wave-mini">
            {clip.waveform.slice(0, 20).map((v, i) => (
              <span key={i} style={{ height: `${Math.max(3, v * 100)}%` }} />
            ))}
          </div>
        )}
      </div>
      <div className="media-item-card__info">
        <span className="media-item-card__name" title={clip.name}>
          {clip.name}
        </span>
        <span className="media-item-card__meta">
          {formatDuration(clip.duration)}
          {clip.width && clip.height ? ` · ${clip.width}×${clip.height}` : ''}
        </span>
      </div>
      {onDelete && (
        <button className="media-item-card__delete" onClick={handleDelete} aria-label={`Delete ${clip.name}`} title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
