export const EDITOR_DOMAINS = Object.freeze({
  timeline: "timeline",
  media: "media",
  playback: "playback",
  editing: "editing",
  effects: "effects",
  text: "text",
  audio: "audio",
  export: "export",
  ai: "ai",
});

export const DEFAULT_PROJECT_SETTINGS = Object.freeze({
  fps: 30,
  width: 3840,
  height: 2160,
  sampleRate: 48000,
  timelineDuration: 190,
});

export const CLIP_TYPES = Object.freeze(["video", "audio", "image", "text", "caption", "effect", "generated"]);
