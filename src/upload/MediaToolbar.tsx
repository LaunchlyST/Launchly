import React from 'react';
import { Upload, Search, LayoutGrid, List as ListIcon, X } from 'lucide-react';

export type MediaView = 'grid' | 'list';

interface MediaToolbarProps {
  view: MediaView;
  onViewChange: (view: MediaView) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  onUploadClick: () => void;
}

/** Upload, search and the grid/list toggle. */
export function MediaToolbar({
  view,
  onViewChange,
  search,
  onSearchChange,
  searchOpen,
  onSearchOpenChange,
  onUploadClick,
}: MediaToolbarProps) {
  return (
    <>
      <div className="media-panel__toolbar">
        <button className="media-tool-btn media-tool-btn--primary" onClick={onUploadClick} title="Upload media">
          <Upload size={13} strokeWidth={2.2} />
          <span>Upload</span>
        </button>
        <div className="media-panel__toolbar-spacer" />
        <button
          className={`media-tool-btn media-tool-btn--icon ${searchOpen ? 'is-active' : ''}`}
          onClick={() => {
            onSearchOpenChange(!searchOpen);
            if (searchOpen) onSearchChange('');
          }}
          title="Search media"
          aria-label="Search media"
          aria-pressed={searchOpen}
        >
          <Search size={14} />
        </button>
        <div className="media-panel__view-toggle" role="group" aria-label="Media view">
          <button
            className={`media-view-btn ${view === 'grid' ? 'is-active' : ''}`}
            onClick={() => onViewChange('grid')}
            title="Grid view"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
          >
            <LayoutGrid size={13} />
          </button>
          <button
            className={`media-view-btn ${view === 'list' ? 'is-active' : ''}`}
            onClick={() => onViewChange('list')}
            title="List view"
            aria-label="List view"
            aria-pressed={view === 'list'}
          >
            <ListIcon size={13} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="media-panel__search">
          <Search size={13} className="media-panel__search-icon" />
          <input
            autoFocus
            className="media-panel__search-input"
            placeholder="Search media…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onSearchChange('');
                onSearchOpenChange(false);
              }
            }}
          />
          {search && (
            <button className="media-panel__search-clear" onClick={() => onSearchChange('')} aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
