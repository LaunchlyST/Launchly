import { evaluateKeyframes } from "../editing/keyframes.js";

export const COLOR_GRADE_PARAMETERS = Object.freeze([
  "exposure",
  "contrast",
  "brightness",
  "saturation",
  "highlights",
  "shadows",
  "whites",
  "blacks",
  "temperature",
  "tint",
  "gamma",
  "vibrance",
  "curves",
  "colorWheels",
]);

export const DEFAULT_COLOR_GRADE = Object.freeze({
  exposure: 0,
  contrast: 0,
  brightness: 0,
  saturation: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  gamma: 1,
  vibrance: 0,
  curves: 0,
  colorWheels: 0,
});

export const COLOR_GRADE_PRESETS = Object.freeze({
  neutral: { ...DEFAULT_COLOR_GRADE },
  cinematic: { exposure: 6, contrast: 18, brightness: -2, saturation: 10, highlights: -18, shadows: 12, whites: 8, blacks: -14, temperature: -6, tint: 2, gamma: 0.96, vibrance: 16, curves: 18, colorWheels: 10 },
  daylight: { exposure: 8, contrast: 8, brightness: 4, saturation: 6, highlights: -8, shadows: 8, whites: 10, blacks: -5, temperature: 8, tint: 0, gamma: 1.02, vibrance: 10, curves: 8, colorWheels: 4 },
  moody: { exposure: -6, contrast: 22, brightness: -8, saturation: -4, highlights: -22, shadows: -10, whites: 2, blacks: -24, temperature: -10, tint: 6, gamma: 0.9, vibrance: 8, curves: 24, colorWheels: 18 },
});

export function normalizeColorGrade(grade = {}) {
  return { ...DEFAULT_COLOR_GRADE, ...grade };
}

export function evaluateColorGrade(clip, localTime) {
  const grade = normalizeColorGrade(clip.colorGrade);
  const keyframes = clip.colorGradeKeyframes ?? [];
  return Object.fromEntries(Object.entries(grade).map(([parameter, fallback]) => [
    parameter,
    evaluateKeyframes(keyframes, parameter, localTime, fallback),
  ]));
}

export function colorGradePreviewVariables(grade = {}) {
  const value = normalizeColorGrade(grade);
  return {
    exposure: value.exposure,
    contrast: 1 + value.contrast / 100 + value.curves / 180,
    brightness: 1 + (value.brightness + value.exposure + value.whites / 2 + value.blacks / 3) / 100,
    saturation: 1 + (value.saturation + value.vibrance) / 100,
    temperature: value.temperature,
    tint: value.tint,
    gamma: value.gamma,
    highlights: value.highlights,
    shadows: value.shadows,
    colorWheels: value.colorWheels,
    hue: value.tint * 0.7 + value.colorWheels * 0.5,
  };
}
