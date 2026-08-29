import React from 'react';
import { VideoSizeDropdown } from './VideoSizeDropdown';

interface AspectRatioControlsProps {
  value: string;
  onChange: (id: string) => void;
}

// Now a single dropdown — keeps old import path working
export function AspectRatioControls({ value, onChange }: AspectRatioControlsProps) {
  return <VideoSizeDropdown value={value} onChange={onChange} />;
}
