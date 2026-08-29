import React from 'react';
import { VideoSizeDropdown } from '../../shared/components/VideoSizeDropdown';
import { MuteControl } from '../../preview/components/MuteControl';

interface EditorToolbarProps {
  aspectRatio: string;
  onAspectRatioChange: (id: string) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
}

export function EditorToolbar({ aspectRatio, onAspectRatioChange, isMuted, onMuteToggle }: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      {/* Size and audio belong to the same decision, so they sit in one group. */}
      <div className="editor-toolbar__group">
        <VideoSizeDropdown value={aspectRatio} onChange={onAspectRatioChange} />
        <span className="editor-toolbar__divider" aria-hidden="true" />
        <MuteControl isMuted={isMuted} onToggle={onMuteToggle} />
      </div>
      <div className="editor-toolbar__spacer" />
    </div>
  );
}

