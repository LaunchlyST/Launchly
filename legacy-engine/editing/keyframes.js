import { clamp, roundToFrame } from "../utils/math.js";
import { createId } from "../types/editorTypes.js";

export const KEYFRAME_PROPERTIES = Object.freeze(["position", "scale", "rotation", "opacity", "crop", "blur", "volume"]);
export const KEYFRAME_EASINGS = Object.freeze(["linear", "ease-in", "ease-out", "ease-in-out"]);

export function easingProgress(progress, easing = "linear") {
  const t = clamp(progress, 0, 1);
  if (easing === "ease-in") return t * t;
  if (easing === "ease-out") return 1 - (1 - t) * (1 - t);
  if (easing === "ease-in-out") return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  return t;
}

export function interpolateValue(from, to, progress) {
  if (typeof from === "number" && typeof to === "number") return from + (to - from) * progress;
  if (from && to && typeof from === "object" && typeof to === "object") {
    return Object.fromEntries(Object.keys({ ...from, ...to }).map((key) => {
      const a = from[key];
      const b = to[key];
      return [key, typeof a === "number" && typeof b === "number" ? interpolateValue(a, b, progress) : progress < 1 ? a : b];
    }));
  }
  return progress < 1 ? from : to;
}

export function keyframesForProperty(keyframes = [], property) {
  return keyframes.filter((keyframe) => keyframe.property === property).sort((a, b) => a.time - b.time);
}

export function normalizeKeyframe(input = {}, { fps = 30, duration = Infinity, fallbackValue = 0 } = {}) {
  const property = KEYFRAME_PROPERTIES.includes(input.property) ? input.property : "opacity";
  const easing = KEYFRAME_EASINGS.includes(input.easing) ? input.easing : "linear";
  return {
    id: input.id ?? createId("keyframe"),
    property,
    value: input.value ?? fallbackValue,
    time: roundToFrame(clamp(Number(input.time ?? 0), 0, Number.isFinite(duration) ? duration : Number.MAX_SAFE_INTEGER), fps),
    easing,
  };
}

export function upsertKeyframe(keyframes = [], keyframe, { fps = 30, duration = Infinity, mergeThreshold = 1 / fps } = {}) {
  const next = normalizeKeyframe(keyframe, { fps, duration, fallbackValue: keyframe.value });
  const existing = keyframes.find((item) => item.id === next.id || (item.property === next.property && Math.abs(item.time - next.time) <= mergeThreshold));
  if (!existing) return [...keyframes, next].sort((a, b) => a.time - b.time || a.property.localeCompare(b.property));
  return keyframes.map((item) => item === existing ? { ...item, ...next, id: existing.id } : item).sort((a, b) => a.time - b.time || a.property.localeCompare(b.property));
}

export function moveKeyframes(keyframes = [], keyframeIds = [], deltaSeconds = 0, { fps = 30, duration = Infinity } = {}) {
  const selected = new Set(keyframeIds);
  return keyframes.map((keyframe) => selected.has(keyframe.id)
    ? { ...keyframe, time: roundToFrame(clamp(keyframe.time + deltaSeconds, 0, duration), fps) }
    : keyframe).sort((a, b) => a.time - b.time || a.property.localeCompare(b.property));
}

export function updateKeyframes(keyframes = [], keyframeIds = [], patch = {}, { fps = 30, duration = Infinity } = {}) {
  const selected = new Set(keyframeIds);
  return keyframes.map((keyframe) => selected.has(keyframe.id)
    ? normalizeKeyframe({ ...keyframe, ...patch, id: keyframe.id }, { fps, duration, fallbackValue: keyframe.value })
    : keyframe).sort((a, b) => a.time - b.time || a.property.localeCompare(b.property));
}

export function evaluateKeyframes(keyframes = [], property, time, fallback) {
  const frames = keyframesForProperty(keyframes, property);
  if (!frames.length) return fallback;
  if (time <= frames[0].time) return frames[0].value;
  if (time >= frames.at(-1).time) return frames.at(-1).value;
  const next = frames.find((frame) => frame.time >= time);
  const previous = frames[frames.indexOf(next) - 1];
  const span = Math.max(0.0001, next.time - previous.time);
  const eased = easingProgress((time - previous.time) / span, next.easing);
  return interpolateValue(previous.value, next.value, eased);
}

export function evaluateClipAnimation(clip, localTime) {
  const keyframes = clip.keyframes ?? [];
  const position = evaluateKeyframes(keyframes, "position", localTime, { x: clip.transform?.x ?? 0, y: clip.transform?.y ?? 0 });
  const scale = evaluateKeyframes(keyframes, "scale", localTime, clip.transform?.scale ?? 1);
  const rotation = evaluateKeyframes(keyframes, "rotation", localTime, clip.transform?.rotate ?? 0);
  const crop = evaluateKeyframes(keyframes, "crop", localTime, clip.transform?.crop ?? null);
  const opacity = evaluateKeyframes(keyframes, "opacity", localTime, clip.opacity ?? 1);
  const blur = evaluateKeyframes(keyframes, "blur", localTime, clip.effects?.find((effect) => effect.type === "blur")?.parameters?.radius ?? 0);
  const volume = evaluateKeyframes(keyframes, "volume", localTime, clip.audio?.volume ?? 1);
  return { position, scale, rotation, crop, opacity, blur, volume };
}

export function sampleAnimationTimeline(clip, { fps = 30, step = 0.25 } = {}) {
  const duration = Math.max(0, Number(clip.duration ?? 0));
  const samples = [];
  for (let time = 0; time <= duration; time = roundToFrame(time + step, fps)) {
    samples.push({ time, animation: evaluateClipAnimation(clip, time) });
    if (time === duration) break;
  }
  if (!samples.some((sample) => sample.time === duration)) samples.push({ time: duration, animation: evaluateClipAnimation(clip, duration) });
  return samples;
}
