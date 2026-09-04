import { clamp } from "../utils/math.js";
import { easingProgress } from "../editing/keyframes.js";

export const TRANSITION_TYPES = Object.freeze(["fade", "cross-dissolve", "dip-black", "dip-white", "slide", "push", "zoom", "wipe", "blur", "spin"]);

export const TRANSITION_DIRECTIONS = Object.freeze({
  "fade": ["left", "right", "up", "down"],
  "cross-dissolve": ["left", "right", "up", "down"],
  "dip-black": ["left", "right", "up", "down"],
  "dip-white": ["left", "right", "up", "down"],
  "slide": ["left", "right", "up", "down"],
  "push": ["left", "right", "up", "down"],
  "zoom": ["in", "out"],
  "wipe": ["left", "right", "up", "down"],
  "blur": ["left", "right", "up", "down"],
  "spin": ["clockwise", "counter-clockwise"],
});

export const TRANSITION_PRESETS = Object.freeze([
  { id: "cinematic", name: "Cinematic", description: "Smooth fades and dissolves for film-style cuts.", transitions: [
    { name: "cross-dissolve", duration: 0.8, easing: "ease-in-out", direction: "left" },
    { name: "fade", duration: 0.6, easing: "ease-in-out", direction: "left" },
    { name: "dip-black", duration: 0.5, easing: "ease-in", direction: "left" },
  ]},
  { id: "social", name: "Social", description: "Fast slide and push transitions for short-form content.", transitions: [
    { name: "slide", duration: 0.3, easing: "ease-out", direction: "left" },
    { name: "push", duration: 0.35, easing: "ease-out", direction: "right" },
    { name: "wipe", duration: 0.25, easing: "ease-in-out", direction: "left" },
  ]},
  { id: "clean", name: "Clean", description: "Minimal dissolves and soft blurs for professional presentation.", transitions: [
    { name: "cross-dissolve", duration: 0.6, easing: "ease-in-out", direction: "left" },
    { name: "blur", duration: 0.4, easing: "ease-in-out", direction: "left" },
    { name: "zoom", duration: 0.5, easing: "ease-out", direction: "in" },
  ]},
  { id: "vintage", name: "Vintage", description: "Dip-to-black and wipe transitions for retro aesthetic.", transitions: [
    { name: "dip-black", duration: 0.7, easing: "ease-in-out", direction: "left" },
    { name: "wipe", duration: 0.6, easing: "ease-in-out", direction: "right" },
    { name: "spin", duration: 0.5, easing: "ease-in-out", direction: "clockwise" },
  ]},
  { id: "energetic", name: "Energetic", description: "Fast zooms, slides, and pushes for high-energy edits.", transitions: [
    { name: "zoom", duration: 0.25, easing: "ease-in", direction: "out" },
    { name: "slide", duration: 0.2, easing: "ease-out", direction: "right" },
    { name: "push", duration: 0.3, easing: "ease-out", direction: "left" },
  ]},
]);

export function normalizeTransition(data = {}) {
  return {
    id: data.id,
    type: data.type ?? "video",
    name: TRANSITION_TYPES.includes(data.name) ? data.name : "cross-dissolve",
    duration: Math.max(0.05, Number(data.duration ?? 0.6)),
    direction: data.direction ?? "out",
    easing: data.easing ?? "ease-in-out",
    fromClipId: data.fromClipId ?? null,
    toClipId: data.toClipId ?? null,
  };
}

export function transitionPhase(clip, transition, timelineTime) {
  const start = clip.timelineStart ?? clip.start;
  const end = start + clip.duration;
  if (transition.direction === "in") {
    const progress = (timelineTime - start) / transition.duration;
    return progress >= 0 && progress <= 1 ? clamp(progress, 0, 1) : null;
  }
  const progress = (timelineTime - (end - transition.duration)) / transition.duration;
  return progress >= 0 && progress <= 1 ? clamp(progress, 0, 1) : null;
}

function wipeClipPath(progress, direction) {
  const p = clamp(progress, 0, 1);
  if (direction === "right") return `inset(0 ${(1 - p) * 100}% 0 0)`;
  if (direction === "left") return `inset(0 0 0 ${(1 - p) * 100}%)`;
  if (direction === "down") return `inset(0 0 ${(1 - p) * 100}% 0)`;
  if (direction === "up") return `inset(${(1 - p) * 100}% 0 0 0)`;
  return `inset(0 ${(1 - p) * 100}% 0 0)`;
}

export function evaluateTransition(clip, transition, timelineTime) {
  const phase = transitionPhase(clip, transition, timelineTime);
  if (phase === null) return null;
  const progress = easingProgress(phase, transition.easing);
  const inverse = 1 - progress;
  const name = transition.name;
  const dir = transition.direction || "left";
  const dipColor = name === "dip-white" ? "#fff" : "#000";

  let opacity = 1;
  let overlay = null;
  let transform = { x: 0, y: 0, scale: 1, rotate: 0 };
  let wipe = null;
  let blur = 0;
  let clipPath = null;

  if (name === "fade" || name === "cross-dissolve") {
    opacity = inverse;
  }

  if (name === "dip-black" || name === "dip-white") {
    overlay = { color: dipColor, opacity: progress <= 0.5 ? progress * 2 : (1 - progress) * 2 };
  }

  if (name === "slide") {
    if (dir === "left") transform.x = progress * -120;
    else if (dir === "right") transform.x = progress * 120;
    else if (dir === "up") transform.y = progress * -80;
    else if (dir === "down") transform.y = progress * 80;
  }

  if (name === "push") {
    if (dir === "left") { transform.x = progress * -120; transform.scale = 1 + progress * 0.05; }
    else if (dir === "right") { transform.x = progress * 120; transform.scale = 1 + progress * 0.05; }
    else if (dir === "up") { transform.y = progress * -80; transform.scale = 1 + progress * 0.05; }
    else if (dir === "down") { transform.y = progress * 80; transform.scale = 1 + progress * 0.05; }
  }

  if (name === "zoom") {
    if (dir === "out") transform.scale = 1 + progress * 0.25;
    else transform.scale = 1 + (1 - progress) * 0.25;
  }

  if (name === "wipe") {
    wipe = progress;
    clipPath = wipeClipPath(progress, dir);
  }

  if (name === "blur") {
    blur = progress * 22;
  }

  if (name === "spin") {
    if (dir === "clockwise") transform.rotate = progress * 180;
    else transform.rotate = progress * -180;
  }

  return {
    id: transition.id,
    name,
    direction: dir,
    progress,
    opacity,
    overlay,
    transform,
    wipe,
    blur,
    clipPath,
  };
}

export function findAdjacentClip(clips, clip, direction = "out") {
  const start = clip.timelineStart ?? clip.start;
  const end = start + clip.duration;
  const sameTrack = clips.filter((item) => item.id !== clip.id && item.trackId === clip.trackId);
  if (direction === "in") {
    return sameTrack.filter((item) => (item.timelineStart ?? item.start) + item.duration <= start).sort((a, b) => ((b.timelineStart ?? b.start) + b.duration) - ((a.timelineStart ?? a.start) + a.duration))[0] ?? null;
  }
  return sameTrack.filter((item) => (item.timelineStart ?? item.start) >= end).sort((a, b) => (a.timelineStart ?? a.start) - (b.timelineStart ?? b.start))[0] ?? null;
}

export function findOverlappingTransitions(clips) {
  const overlaps = [];
  const trackClips = new Map();
  clips.forEach((clip) => {
    if (!trackClips.has(clip.trackId)) trackClips.set(clip.trackId, []);
    trackClips.get(clip.trackId).push(clip);
  });
  trackClips.forEach((trackClipList) => {
    const sorted = [...trackClipList].sort((a, b) => (a.timelineStart ?? a.start) - (b.timelineStart ?? b.start));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const aEnd = (a.timelineStart ?? a.start) + a.duration;
      const bStart = b.timelineStart ?? b.start;
      const gap = bStart - aEnd;
      if (Math.abs(gap) < 0.01) {
        const aTransitions = (a.transitions ?? []).filter((t) => t.direction === "out");
        const bTransitions = (b.transitions ?? []).filter((t) => t.direction === "in");
        if (aTransitions.length || bTransitions.length) {
          overlaps.push({
            clipA: a.id,
            clipB: b.id,
            trackId: a.trackId,
            time: aEnd,
            duration: Math.max(
              ...aTransitions.map((t) => t.duration),
              ...bTransitions.map((t) => t.duration),
              0.3
            ),
          });
        }
      }
    }
  });
  return overlaps;
}
