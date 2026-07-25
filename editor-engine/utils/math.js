export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function roundToFrame(seconds, fps) {
  return Math.round(seconds * fps) / fps;
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
