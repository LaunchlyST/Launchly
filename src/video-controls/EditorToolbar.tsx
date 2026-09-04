import React from 'react';
import { VideoSizeDropdown } from './VideoSizeDropdown';
import { MuteControl } from './MuteControl';

interface EditorToolbarProps {
  aspectRatio: string;
  onAspectRatioChange: (id: string) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
}

export function EditorToolbar({ aspectRatio, onAspectRatioChange, isMuted, onMuteToggle, onExportProject, onUpgrade, planLabel = 'Free' }: EditorToolbarProps & { onExportProject?: () => void; onUpgrade?: () => void; planLabel?: string }) {
  return (
    <div className="editor-toolbar">
      {/* Size and audio belong to the same decision, so they sit in one group. */}
      <div className="editor-toolbar__group">
        <VideoSizeDropdown value={aspectRatio} onChange={onAspectRatioChange} />
        <span className="editor-toolbar__divider" aria-hidden="true" />
        <MuteControl isMuted={isMuted} onToggle={onMuteToggle} />
      </div>
      <div className="editor-toolbar__spacer" />
      {onUpgrade && (
        <button className="go-pro-btn" onClick={onUpgrade} aria-label="Upgrade plan">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 19.9l1.1-6.5L2.6 8.8l6.5-.9z" /></svg>
          {planLabel === 'free' ? 'Free · Go Pro' : `${planLabel} plan`}
        </button>
      )}
      {onExportProject && (
        <button className="export-project-btn" onClick={onExportProject} aria-label="Export project">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Export Project
        </button>
      )}
    </div>
  );
}

