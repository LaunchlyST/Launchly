import React from 'react';
import { SpeakerOnIcon, SpeakerOffIcon } from '../icons/Icon';

interface MuteControlProps {
  isMuted: boolean;
  onToggle: () => void;
}

export function MuteControl({ isMuted, onToggle }: MuteControlProps) {
  return (
    <button
      className={`mute-control ${isMuted ? 'muted' : ''}`}
      onClick={onToggle}
      aria-label={isMuted ? 'Unmute' : 'Mute'}
      aria-pressed={isMuted}
      title={isMuted ? 'Unmute audio' : 'Mute audio'}
    >
      {isMuted ? <SpeakerOffIcon size={18} /> : <SpeakerOnIcon size={18} />}
    </button>
  );
}
