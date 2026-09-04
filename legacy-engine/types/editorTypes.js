export const EditorTypeNames = Object.freeze({
  Project: "Project",
  Timeline: "Timeline",
  Track: "Track",
  Clip: "Clip",
  MediaAsset: "MediaAsset",
  Keyframe: "Keyframe",
  RenderJob: "RenderJob",
});

export function createId(prefix = "item") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
