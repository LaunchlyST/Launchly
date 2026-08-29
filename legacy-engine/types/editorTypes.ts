export type TimeSeconds = number;
export type FrameNumber = number;
export type TrackType = "video" | "audio" | "text" | "caption" | "effects";
export type ClipType = "video" | "audio" | "image" | "text" | "caption" | "effect";
export type BlendMode = "normal" | "screen" | "multiply" | "overlay" | "soft-light";
export type EditableProperty =
  | "position"
  | "scale"
  | "rotation"
  | "crop"
  | "opacity"
  | "speed"
  | "volume"
  | "blur"
  | "sharpen"
  | "glow"
  | "shadow"
  | "color";
export type KeyframeEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";
export type TransitionName = "fade" | "cross-dissolve" | "dip-black" | "dip-white" | "slide" | "push" | "zoom" | "wipe" | "blur" | "spin";
export type EffectType = "blur" | "sharpen" | "glow" | "shadow" | "vignette" | "noise" | "film-grain" | "bloom" | "lut" | "rgb-split" | "chromatic-aberration";

export interface ProjectSettings {
  fps: number;
  duration: TimeSeconds;
  width: number;
  height: number;
  sampleRate: number;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  order: number;
  locked: boolean;
  visible: boolean;
  muted?: boolean;
  solo?: boolean;
  height?: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  crop: CropRect | null;
  flipX: boolean;
  flipY: boolean;
  anchorX: number;
  anchorY: number;
  motionBlur: number;
  easingPreset: "linear" | "smooth" | "cinematic" | "snappy" | "gentle";
}

export interface AudioEnvelope {
  volume: number;
  pan: number;
  fadeIn: TimeSeconds;
  fadeOut: TimeSeconds;
  muted?: boolean;
  solo?: boolean;
  noiseReduction?: number;
  voiceEnhance?: number;
  eq?: { low: number; mid: number; high: number };
  compressor?: { threshold: number; ratio: number; attack: number; release: number; makeupGain: number; enabled: boolean };
  limiter?: { ceiling: number; release: number; enabled: boolean };
  waveform?: number[];
  syncOffset?: TimeSeconds;
  keyframes?: Keyframe[];
}

export interface Keyframe<T = unknown> {
  id: string;
  property: EditableProperty | string;
  time: TimeSeconds;
  value: T;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export interface ClipEffect {
  id: string;
  type: EffectType;
  enabled: boolean;
  order: number;
  parameters: Record<string, number | string | boolean>;
  keyframes: Keyframe[];
}

export interface ColorGrade {
  exposure: number;
  contrast: number;
  brightness: number;
  saturation: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  gamma: number;
  vibrance: number;
  curves: number;
  colorWheels: number;
}

export type TextLayerKind = "title" | "subtitle" | "caption" | "lower-third";
export type TextAlign = "left" | "center" | "right";
export type TextAnimationName = "none" | "fade" | "slide-up" | "scale-in" | "soft-reveal";

export interface TextStyle {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing: number;
  strokeWidth: number;
  strokeColor: string;
  shadow: number;
  glow: number;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  align: TextAlign;
  color: string;
}

export interface TextLayer {
  kind: TextLayerKind;
  text: string;
  style: TextStyle;
  animation: TextAnimationName;
  templateId: string | null;
  keyframes: Keyframe[];
}

export type CaptionMode = "word" | "sentence";
export type CaptionAnimation = "none" | "fade" | "rise" | "karaoke" | "pop";

export interface CaptionWord {
  id: string;
  text: string;
  start: TimeSeconds;
  end: TimeSeconds;
}

export interface CaptionLayer {
  mode: CaptionMode;
  text: string;
  words: CaptionWord[];
  speaker: string;
  speakerColor: string;
  trackName: string;
  safeZone: boolean;
  animation: CaptionAnimation;
  templateId: string;
  exportFormat: "srt" | "json";
}

export interface AiToolState {
  id: string;
  name: string;
  category: string;
  status: "Ready" | "Processing" | "Done" | "New" | string;
  description: string;
  settings: Record<string, string>;
  progress: number;
  lastRunAt: string | null;
  result: null | { id: string; summary: string; instruction: string; completedAt: string };
}

export type ExportFormat = "MP4" | "MOV" | "WEBM";
export type ExportCodec = "H.264" | "HEVC" | "ProRes" | "AV1" | "VP9";
export type ExportStatus = "queued" | "rendering" | "completed" | "cancelled" | "error";

export interface ExportSettings {
  format: ExportFormat;
  resolution: 720 | 1080 | 1440 | 2160;
  fps: 24 | 25 | 30 | 50 | 60;
  codec: ExportCodec;
  bitrate: number;
  duration: TimeSeconds;
}

export interface ExportJob {
  id: string;
  name: string;
  settings: ExportSettings;
  sizeEstimateMb: number;
  status: ExportStatus;
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  schemaVersion: number;
  name: string;
  thumbnail: { hue: number; label: string };
  settings: ProjectSettings & { colorSpace?: string; autosave?: boolean };
  state: unknown;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  autosavedAt: string | null;
  manualSavedAt: string | null;
  deletedAt: string | null;
}

export type AssetType = "Image" | "Video" | "Audio";

export interface MediaAsset {
  id: string;
  name: string;
  type: AssetType;
  folder: string;
  tags: string[];
  favorite: boolean;
  duration: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  recent: boolean;
  source: string;
  thumbnailKey: string;
  thumbnailStatus?: "lazy" | "ready" | "error" | string;
  resolution?: string | null;
  codec?: string | null;
  fps?: number | string | null;
  aspectRatio?: string | null;
  fileSize?: number;
  sampleRate?: string | null;
  channels?: string | null;
  proxy?: null | Record<string, unknown>;
}

export interface AssetManagerState {
  assets: MediaAsset[];
  folders: string[];
  selectedAssetIds: string[];
  thumbnailCache: Record<string, unknown>;
  filter: { type: AssetType | "All"; folder: string; tag: string; favoritesOnly: boolean; query: string; sort: string };
}

export interface ClipTransition {
  id: string;
  type: "video" | "audio";
  name: TransitionName;
  duration: TimeSeconds;
  direction: "in" | "out" | "cross";
  easing: KeyframeEasing;
  fromClipId?: string | null;
  toClipId?: string | null;
}

export interface TimelineClip {
  id: string;
  name: string;
  type: ClipType;
  trackId: string;
  start: TimeSeconds;
  timelineStart: TimeSeconds;
  duration: TimeSeconds;
  in: TimeSeconds;
  out: TimeSeconds;
  sourceStart: TimeSeconds;
  sourceEnd: TimeSeconds;
  originalDuration: TimeSeconds;
  layer: number;
  speed: number;
  reversed: boolean;
  freezeFrames: TimeSeconds[];
  transform: ClipTransform;
  opacity: number;
  blendMode: BlendMode;
  keyframes: Keyframe[];
  transitions: ClipTransition[];
  effects: ClipEffect[];
  colorGrade: ColorGrade;
  colorGradeKeyframes: Keyframe[];
  textLayer: TextLayer | null;
  captionLayer: CaptionLayer | null;
  audio: AudioEnvelope;
  groupId: string | null;
}

export interface PlaybackState {
  time: TimeSeconds;
  playing: boolean;
  fps: number;
  playbackRate: number;
  canvasZoom: number;
  lastTickAt: number | null;
}

export interface EditorState {
  settings: ProjectSettings;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  selectedClipIds: string[];
  selectedKeyframeIds: string[];
  clipboard: TimelineClip[];
  keyframeClipboard: Keyframe[];
  aiTools?: AiToolState[];
  aiCommand?: string;
  aiQueue?: Array<Record<string, unknown>>;
  exportQueue?: ExportJob[];
  recentExports?: ExportJob[];
  renderHistory?: Array<Record<string, unknown>>;
  project?: ProjectRecord;
  assetManager?: AssetManagerState;
  history: HistoryEntry[];
  future: HistoryEntry[];
  snap: boolean;
  magnetic: boolean;
  zoom: number;
  playback: PlaybackState;
}

export interface HistoryEntry {
  label: string;
  before: Omit<EditorState, "history" | "future">;
  after: Omit<EditorState, "history" | "future">;
  at: number;
}

export interface RenderLayer {
  clipId: string;
  trackId: string;
  type: ClipType;
  start: TimeSeconds;
  localTime: TimeSeconds;
  layer: number;
  transform: ClipTransform;
  opacity: number;
  blendMode: BlendMode;
  effects: ClipEffect[];
  textLayer?: TextLayer | null;
  textPreview?: Record<string, unknown> | null;
  captionLayer?: CaptionLayer | null;
  captionPreview?: Record<string, unknown> | null;
}

export interface AudioRenderLayer {
  clipId: string;
  trackId: string;
  localTime: TimeSeconds;
  volume: number;
  pan?: number;
  noiseReduction?: number;
  voiceEnhance?: number;
  eq?: { low: number; mid: number; high: number };
  compressor?: AudioEnvelope["compressor"];
  limiter?: AudioEnvelope["limiter"];
  gainReduction?: number;
  peak?: number;
  waveform: number[];
  muted: boolean;
}

export interface RenderFrame {
  time: TimeSeconds;
  frame: FrameNumber;
  layers: RenderLayer[];
  audio: AudioRenderLayer[];
  audioMix?: { audibleCount: number; masterGain: number; peak: number; clipping: boolean };
}
