export interface Tool {
  id: string;
  label: string;
  ai?: boolean;
}

export interface Clip {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'text' | 'caption';
  src?: string;
  trackId: string;
  timelineStart: number;
  start: number;
  duration: number;
  layer: number;
  hidden: boolean;
  locked: boolean;
  solo: boolean;
  opacity: number;
  transform: { scale: number; rotate: number; position: { x: number; y: number } };
  speed: number;
  blendMode: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  crop: number;
  blur: number;
  shadow: number;
  border: number;
  thumbnail?: string;
  thumbnails?: string[];
  waveform?: number[];
  width?: number;
  height?: number;
  fps?: number;
  sourceStart?: number;
  sourceDuration?: number;
  hasEmbeddedAudio?: boolean;
  audioDetached?: boolean;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'caption';
  order: number;
  visible: boolean;
  locked: boolean;
  muted: boolean;
  solo: boolean;
  height: number;
  color: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  title?: string;
  action?: { label: string; onClick: () => void };
}

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: string;
  description: string;
}

export interface ExportSettings {
  title: string;
  format: 'mp4' | 'webm' | 'mov' | 'gif';
  codec: 'h264' | 'h265' | 'vp9' | 'av1';
  resolution: string;
  fps: number;
  bitrate: number;
  quality: 'low' | 'medium' | 'high' | 'lossless';
  audioCodec: 'aac' | 'opus' | 'mp3';
  audioBitrate: number;
  includeAudio: boolean;
  includeCaptions: boolean;
  captionFormat: 'srt' | 'vtt' | 'ass';
  colorSpace: 'rec709' | 'p3' | 'rec2020';
  hdr: boolean;
}

export interface ProjectSettings {
  name: string;
  width: number;
  height: number;
  fps: number;
  colorSpace: string;
  duration: number;
}

export interface AICommand {
  command: string;
  intent: string;
  tool: string;
  result: string;
}