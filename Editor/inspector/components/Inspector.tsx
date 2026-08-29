import React from 'react';
import { Clip, Track } from '../../shared/types';

export interface InspectorProps {
  clips: Clip[];
  tracks: Track[];
  selectedClipIds: string[];
  onClipsChange: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;
  onTracksChange: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  onSelectionChange: (ids: string[]) => void;
  canvasZoom: number;
  onCanvasZoomChange: (zoom: number) => void;
}

export function Inspector({ clips, tracks, selectedClipIds, onClipsChange, canvasZoom, onCanvasZoomChange }: InspectorProps) {
  const selectedClips = clips.filter((c) => selectedClipIds.includes(c.id));
  const clip = selectedClips.length === 1 ? selectedClips[0] : null;

  if (!clip) {
    return (
      <aside className="inspector glass-panel">
        <div className="inspector-header">
          <span className="panel-label">Inspector</span>
          <strong className="panel-title">Properties</strong>
        </div>
        <div className="inspector-empty">
          <p>Select a clip to edit properties</p>
        </div>
      </aside>
    );
  }

  const updateClip = (updates: Partial<Clip>) => {
    onClipsChange((prev) => prev.map((c) => (c.id === clip.id ? { ...c, ...updates } : c)));
  };

  const formatTimecode = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <aside className="inspector glass-panel">
      <div className="inspector-header">
        <span className="panel-label">Inspector</span>
        <strong className="panel-title">{clip.name}</strong>
      </div>

      {(clip.width || clip.height || clip.fps || clip.duration) && (
        <div className="inspector-section">
          <h3>Media Info</h3>
          <div className="inspector-meta-grid">
            {clip.width && clip.height && (
              <div className="meta-item">
                <span className="meta-label">Resolution</span>
                <span className="meta-value">{clip.width}×{clip.height}</span>
              </div>
            )}
            {clip.fps && (
              <div className="meta-item">
                <span className="meta-label">Frame Rate</span>
                <span className="meta-value">{clip.fps} fps</span>
              </div>
            )}
            {clip.duration > 0 && (
              <div className="meta-item">
                <span className="meta-label">Duration</span>
                <span className="meta-value">{formatTimecode(clip.duration)}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">Type</span>
              <span className="meta-value">{clip.type}</span>
            </div>
            {clip.width && clip.height && (
              <div className="meta-item">
                <span className="meta-label">Aspect</span>
                <span className="meta-value">{(clip.width / clip.height).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="inspector-section">
        <h3>Transform</h3>
        <label>
          Scale
          <input type="range" min="0.1" max="5" step="0.01" value={clip.transform.scale} onChange={(e) => updateClip({ transform: { ...clip.transform, scale: Number(e.target.value) } })} />
        </label>
        <label>
          Rotation
          <input type="range" min="-360" max="360" step="1" value={clip.transform.rotate} onChange={(e) => updateClip({ transform: { ...clip.transform, rotate: Number(e.target.value) } })} />
        </label>
        <label>
          Position X
          <input type="range" min="-1920" max="1920" step="1" value={clip.transform.position.x} onChange={(e) => updateClip({ transform: { ...clip.transform, position: { ...clip.transform.position, x: Number(e.target.value) } } })} />
        </label>
        <label>
          Position Y
          <input type="range" min="-1080" max="1080" step="1" value={clip.transform.position.y} onChange={(e) => updateClip({ transform: { ...clip.transform, position: { ...clip.transform.position, y: Number(e.target.value) } } })} />
        </label>
      </div>

      <div className="inspector-section">
        <h3>Appearance</h3>
        <label>
          Opacity
          <input type="range" min="0" max="1" step="0.01" value={clip.opacity} onChange={(e) => updateClip({ opacity: Number(e.target.value) })} />
        </label>
        <label>
          Speed
          <input type="range" min="0.1" max="4" step="0.01" value={clip.speed} onChange={(e) => updateClip({ speed: Number(e.target.value) })} />
        </label>
        <label>
          Blur
          <input type="range" min="0" max="100" step="1" value={clip.blur} onChange={(e) => updateClip({ blur: Number(e.target.value) })} />
        </label>
      </div>

      <div className="inspector-section">
        <h3>Audio</h3>
        <label>
          Volume
          <input type="range" min="0" max="2" step="0.01" value={clip.volume} onChange={(e) => updateClip({ volume: Number(e.target.value) })} />
        </label>
        <label>
          Fade In
          <input type="range" min="0" max="5" step="0.01" value={clip.fadeIn} onChange={(e) => updateClip({ fadeIn: Number(e.target.value) })} />
        </label>
        <label>
          Fade Out
          <input type="range" min="0" max="5" step="0.01" value={clip.fadeOut} onChange={(e) => updateClip({ fadeOut: Number(e.target.value) })} />
        </label>
      </div>

      <div className="inspector-section">
        <h3>Canvas Zoom</h3>
        <label>
          Zoom
          <input type="range" min="0.25" max="4" step="0.01" value={canvasZoom} onChange={(e) => onCanvasZoomChange(Number(e.target.value))} />
        </label>
      </div>
    </aside>
  );
}
