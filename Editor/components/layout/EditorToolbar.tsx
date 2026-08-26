import React from 'react';
import { VideoSizeDropdown } from '../common/VideoSizeDropdown';
import { MuteControl } from '../preview/MuteControl';

interface EditorToolbarProps {
  aspectRatio: string;
  onAspectRatioChange: (id: string) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
}

export function EditorToolbar({ aspectRatio, onAspectRatioChange, isMuted, onMuteToggle }: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      <VideoSizeDropdown value={aspectRatio} onChange={onAspectRatioChange} />
      <div className="editor-toolbar__spacer" />
      <MuteControl isMuted={isMuted} onToggle={onMuteToggle} />
    </div>
  );
}
