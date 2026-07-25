import React, { useState } from 'react';
import { useEditorStore } from '../store';
import { importMediaFiles } from '../lib/mediaImport';

interface ToolPanelProps {
  activeTool: string;
  openPanels: Record<string, boolean>;
  onPanelClose: (toolId: string) => void;
}

const PANEL_CONTENT: Record<string, React.ReactNode> = {
  media: (
    <MediaPanel />
  ),
  text: (
    <TextPanel />
  ),
  captions: (
    <CaptionsPanel />
  ),
  audio: (
    <AudioPanel />
  ),
  brand: (
    <BrandPanel />
  ),
  templates: (
    <TemplatesPanel />
  ),
  effects: (
    <EffectsPanel />
  ),
  transitions: (
    <TransitionsPanel />
  ),
  'ai-tools': (
    <AIToolsPanel />
  ),
};

function MediaPanel() {
  const { clips, setClips } = useEditorStore();
  const { addFiles, handleDrop } = useUploadHandler();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Video' | 'Image' | 'Audio'>('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filteredClips = clips.filter((clip) => {
    if (filter !== 'All' && clip.type !== filter.toLowerCase()) return false;
    if (search && !clip.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="tool-panel-content media-panel">
      <div className="panel-header">
        <div>
          <span className="panel-label">Media</span>
          <strong className="panel-title">Project Media</strong>
        </div>
        <button className="upload-button" onClick={() => document.getElementById('media-upload')?.click()}>
          Upload Media
        </button>
        <input id="media-upload" type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>

      <div className="media-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <strong>Drop files here</strong>
        <span>Video, image, and audio sources</span>
      </div>

      <label className="media-search">
        <span>Search</span>
        <input type="search" placeholder="Search media..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>

      <div className="media-tabs" role="tablist" aria-label="Media filters">
        {(['All', 'Video', 'Image', 'Audio'] as const).map((type) => (
          <button
            key={type}
            className={filter === type ? 'active' : ''}
            data-asset-type={type}
            aria-selected={filter === type}
            onClick={() => setFilter(type)}
          >
            {type}
          </button>
        ))}
        <button data-asset-type="Favorites" data-asset-favorites="true" aria-selected={false}>Favorites</button>
      </div>

      <div className="media-view-toggle" aria-label="View mode">
        <button className={view === 'grid' ? 'active' : ''} data-media-view="grid" aria-selected={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
        <button className={view === 'list' ? 'active' : ''} data-media-view="list" aria-selected={view === 'list'} onClick={() => setView('list')}>List</button>
      </div>

      <div className="media-library" data-media-library>
        <div className="media-section">
          <h3>Project Media</h3>
          <div className={`media-grid ${view}`}>
            {filteredClips.map((clip) => (
              <article key={clip.id} className="media-item" draggable="true" data-media-name={clip.name} data-media-type={clip.type} data-media-duration={clip.duration}>
                <div className={`media-thumb ${clip.type}`}>
                  {clip.thumbnail ? (
                    <img src={clip.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : clip.type === 'video' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ margin: 'auto', display: 'block', opacity: 0.5 }}><polygon points="23,7 16,12 23,17" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                  ) : clip.type === 'audio' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ margin: 'auto', display: 'block', opacity: 0.5 }}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                  ) : clip.type === 'image' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ margin: 'auto', display: 'block', opacity: 0.5 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21,15 16,10 5,21" /></svg>
                  ) : null}
                </div>
                <div>
                  <strong>{clip.name}</strong>
                  <span>
                    {formatDuration(clip.duration)}
                    {clip.width && clip.height && <> · {clip.width}×{clip.height}</>}
                    {clip.fps && <> · {clip.fps}fps</>}
                    {!clip.width && !clip.fps && <> · {clip.type}</>}
                  </span>
                </div>
                <button aria-label="Context menu">⋯</button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextPanel() {
  return (
    <div className="tool-panel-content text-panel">
      <div className="panel-header">
        <div>
          <span className="panel-label">Text</span>
          <strong className="panel-title">Typography</strong>
        </div>
        <button className="tool-panel-action">Add Title</button>
      </div>
      <div className="panel-body">
        <p className="panel-placeholder">Text tools and typography controls coming soon.</p>
      </div>
    </div>
  );
}

function CaptionsPanel() {
  return (
    <div className="tool-panel-content captions-panel">
      <div className="panel-header">
        <div>
          <span className="panel-label">Captions</span>
          <strong className="panel-title">Caption Studio</strong>
        </div>
        <button className="tool-panel-action">Auto Caption</button>
      </div>
      <div className="panel-body">
        <p className="panel-placeholder">Caption generation and editing coming soon.</p>
      </div>
    </div>
  );
}

function AudioPanel() {
  return (
    <div className="tool-panel-content audio-panel">
      <div className="panel-header">
        <div>
          <span className="panel-label">Audio</span>
          <strong className="panel-title">Audio Engine</strong>
        </div>
        <button className="tool-panel-action">Import Audio</button>
      </div>
      <div className="panel-body">
        <p className="panel-placeholder">Audio mixing and effects coming soon.</p>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="tool-panel-content brand-panel">
      <div className="panel-header">
        <div>
          <span className="panel-label">Brand</span>
          <strong className="panel-title">Brand Kit</strong>
        </div>
        <button className="tool-panel-action">Save Brand</button>
      </div>
      <div className="panel-body">
        <p className="panel-placeholder">Brand colors, logos, and type system coming soon.</p>
      </div>
    </div>
  );
}

function TemplatesPanel() {
  return (
    <div className="tool-panel-content templates-panel">
      <div className="panel-header">
        <div>
          <span className="panel-label">Templates</span>
          <strong className="panel-title">Production Starters</strong>
        </div>
        <button className="tool-panel-action">Save Current</button>
      </div>
      <div className="panel-body">
        <p className="panel-placeholder">Template library and starters coming soon.</p>
      </div>
    </div>
  );
}

function EffectsPanel() {
  return (
    <div className="tool-panel-content effects-panel">
      <div className="panel-header">
        <div>
          <span className="panel-label">Effects</span>
          <strong className="panel-title">Effects Library</strong>
        </div>
      </div>
      <div className="panel-body">
        <p className="panel-placeholder">Visual effects and filters coming soon.</p>
      </div>
    </div>
  );
}

function TransitionsPanel() {
  return (
    <div className="tool-panel-content transitions-panel">
      <div className="panel-header">
        <div>
          <span className="panel-label">Transitions</span>
          <strong className="panel-title">Transition Browser</strong>
        </div>
      </div>
      <div className="panel-body">
        <p className="panel-placeholder">Transition presets and editor coming soon.</p>
      </div>
    </div>
  );
}

function AIToolsPanel() {
  return (
    <div className="tool-panel-content ai-panel">
      <div className="panel-header">
        <div>
          <span className="panel-label">AI Assistant</span>
          <strong className="panel-title">Production Tools</strong>
        </div>
        <button className="tool-panel-action">Queue</button>
      </div>
      <div className="panel-body">
        <p className="panel-placeholder">AI-powered editing tools coming soon.</p>
      </div>
    </div>
  );
}

function useUploadHandler() {
  const { clips, setClips, tracks } = useEditorStore();

  const addFiles = async (files: FileList | null) => {
    if (!files) return;

    const videoTrack = tracks.find((t) => t.type === 'video');
    const audioTrack = tracks.find((t) => t.type === 'audio');
    if (!videoTrack) return;

    const result = await importMediaFiles(
      files,
      videoTrack.id,
      audioTrack?.id || 'audio-1',
      clips
    );

    if (result.clips.length > 0) {
      setClips((prev) => [...prev, ...result.clips]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  return { addFiles, handleDrop };
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ToolPanel({ activeTool, openPanels, onPanelClose }: ToolPanelProps) {
  if (!openPanels[activeTool]) return null;

  const panelContent = PANEL_CONTENT[activeTool] || (
    <div className="tool-panel-content">
      <div className="panel-header">
        <div>
          <span className="panel-label">{activeTool}</span>
          <strong className="panel-title">Panel</strong>
        </div>
      </div>
      <div className="panel-body">
        <p className="panel-placeholder">Panel content coming soon.</p>
      </div>
    </div>
  );

  return (
    <aside className="tool-panel glass-panel open" aria-live="polite" role="complementary">
      <div className="panel-header-bar">
        <h2 className="panel-title-main">{activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}</h2>
        <button className="panel-close" onClick={() => onPanelClose(activeTool)} aria-label="Close panel">
          ✕
        </button>
      </div>
      {panelContent}
    </aside>
  );
}