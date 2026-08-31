import React from 'react';
import { Plus, Film } from 'lucide-react';
import { Clip } from '../editor-types/editorTypes';
import { MediaItem } from './MediaItem';
import { MediaView } from './MediaToolbar';

interface MediaLibraryProps {
  clips: Clip[];
  view: MediaView;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, clip: Clip) => void;
  onDelete?: (clip: Clip) => void;
  onSelect?: (clip: Clip) => void;
  onAddToTimeline?: (clip: Clip) => void;
  onRename?: (clip: Clip, name: string) => void;
  selectedClipIds?: string[];
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onClearFilters: () => void;
}

/** The scrolling list/grid of library items, plus its filtered-empty state. */
export function MediaLibrary({
  clips,
  view,
  isDragOver,
  onDragStart,
  onDelete,
  onSelect,
  onAddToTimeline,
  onRename,
  selectedClipIds,
  onDrop,
  onDragOver,
  onDragLeave,
  onClearFilters,
}: MediaLibraryProps) {
  if (clips.length === 0) {
    return (
      <div className="media-panel__no-results" onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
        <Film size={20} />
        <p>No media in this view</p>
        <button className="media-panel__link-btn" onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div
      className={`media-panel__list media-panel__list--${view} ${isDragOver ? 'is-dragover' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {clips.map((clip) => (
        <MediaItem
          key={clip.id}
          clip={clip}
          view={view}
          onDragStart={onDragStart}
          onDelete={onDelete}
          onSelect={onSelect}
          onAddToTimeline={onAddToTimeline}
          onRename={onRename}
          isSelected={selectedClipIds?.includes(clip.id)}
        />
      ))}
      {isDragOver && (
        <div className="media-panel__drop-overlay">
          <Plus size={18} /> Drop to add
        </div>
      )}
    </div>
  );
}
