import React, { useState } from 'react';
import { useEditorStore } from '../../editor-core/logic/editorStore';
import { importMediaFiles } from '../../media/logic/mediaImport';
import { MediaPanel } from '../../media/components/MediaPanel';

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