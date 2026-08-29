import { clamp } from "../utils/math.js";
import { evaluateKeyframes } from "../editing/keyframes.js";

export const TEXT_LAYER_KINDS = Object.freeze(["title", "subtitle", "caption", "lower-third"]);
export const TEXT_ALIGNMENTS = Object.freeze(["left", "center", "right"]);
export const TEXT_ANIMATIONS = Object.freeze(["none", "fade", "slide-up", "scale-in", "soft-reveal", "karaoke", "typewriter", "bounce-in", "blur-reveal", "wipe-right"]);

export const TEXT_ANIMATION_PRESETS = Object.freeze({
  enter: Object.freeze([
    { id: "fade", name: "Fade In", description: "Smooth opacity fade from 0 to 1" },
    { id: "slide-up", name: "Slide Up", description: "Rise from below with opacity" },
    { id: "scale-in", name: "Scale In", description: "Grow from center point" },
    { id: "soft-reveal", name: "Soft Reveal", description: "Character-by-character reveal" },
    { id: "typewriter", name: "Typewriter", description: "Character-by-character with cursor" },
    { id: "bounce-in", name: "Bounce In", description: "Spring overshoot entrance" },
    { id: "blur-reveal", name: "Blur Reveal", description: "Fade from blurred to sharp" },
    { id: "wipe-right", name: "Wipe Right", description: "Left-to-right reveal" },
  ]),
  leave: Object.freeze([
    { id: "none", name: "None", description: "No exit animation" },
    { id: "fade", name: "Fade Out", description: "Smooth opacity fade to 0" },
    { id: "slide-up", name: "Slide Up Out", description: "Rise and fade out" },
    { id: "scale-in", name: "Scale Out", description: "Shrink and fade out" },
  ]),
  loop: Object.freeze([
    { id: "none", name: "None", description: "No loop animation" },
    { id: "karaoke", name: "Karaoke", description: "Word-by-word highlight" },
    { id: "fade", name: "Pulse", description: "Gentle opacity pulse" },
  ]),
});

export const TEXT_FONT_FAMILIES = Object.freeze([
  { value: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", label: "Inter" },
  { value: "'Segoe UI', ui-sans-serif, system-ui, sans-serif", label: "Segoe UI" },
  { value: "'Aptos Display', Aptos, ui-sans-serif, system-ui, sans-serif", label: "Aptos Display" },
  { value: "Georgia, 'Times New Roman', serif", label: "Editorial Serif" },
  { value: "'Courier New', Courier, monospace", label: "Mono" },
  { value: "'Arial Black', Arial, sans-serif", label: "Arial Black" },
  { value: "Impact, 'Arial Black', sans-serif", label: "Impact" },
]);

export const TEXT_TEMPLATES = Object.freeze({
  editorial: {
    name: "Editorial Title",
    kind: "title",
    style: { fontWeight: 800, fontSize: 54, letterSpacing: -0.2, lineHeight: 1.1, paragraphSpacing: 0, shadow: 42, glow: 8, backgroundEnabled: false, align: "left", posX: 50, posY: 50, scale: 100, rotation: 0 },
    animation: "soft-reveal",
  },
  subtitleClean: {
    name: "Clean Subtitle",
    kind: "subtitle",
    style: { fontWeight: 600, fontSize: 28, letterSpacing: 0, lineHeight: 1.4, paragraphSpacing: 4, strokeWidth: 1, shadow: 34, backgroundEnabled: false, align: "center", posX: 50, posY: 85, scale: 100, rotation: 0 },
    animation: "fade",
  },
  captionGlass: {
    name: "Glass Caption",
    kind: "caption",
    style: { fontWeight: 700, fontSize: 24, letterSpacing: 0.1, lineHeight: 1.3, paragraphSpacing: 2, strokeWidth: 0, shadow: 26, backgroundEnabled: true, backgroundOpacity: 42, align: "center", posX: 50, posY: 88, scale: 100, rotation: 0 },
    animation: "slide-up",
  },
  lowerThird: {
    name: "Lower Third",
    kind: "lower-third",
    style: { fontWeight: 750, fontSize: 32, letterSpacing: 0.2, lineHeight: 1.2, paragraphSpacing: 0, shadow: 32, glow: 5, backgroundEnabled: true, backgroundOpacity: 28, align: "left", posX: 15, posY: 75, scale: 100, rotation: 0 },
    animation: "scale-in",
  },
});

export const DEFAULT_TEXT_STYLE = Object.freeze({
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  fontWeight: 800,
  fontSize: 54,
  letterSpacing: 0,
  lineHeight: 1.1,
  paragraphSpacing: 0,
  strokeWidth: 0,
  strokeColor: "rgba(7, 12, 17, 0.78)",
  shadow: 36,
  glow: 6,
  backgroundEnabled: false,
  backgroundColor: "rgba(8, 13, 19, 0.72)",
  backgroundOpacity: 0,
  align: "left",
  color: "#f7f2ea",
  posX: 50,
  posY: 50,
  scale: 100,
  rotation: 0,
});

export function isTextClipType(type) {
  return type === "text" || type === "caption";
}

export function normalizeTextStyle(style = {}) {
  return {
    ...DEFAULT_TEXT_STYLE,
    ...style,
    fontWeight: clamp(Number(style.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight), 100, 950),
    fontSize: clamp(Number(style.fontSize ?? DEFAULT_TEXT_STYLE.fontSize), 12, 120),
    letterSpacing: clamp(Number(style.letterSpacing ?? DEFAULT_TEXT_STYLE.letterSpacing), -2, 12),
    lineHeight: clamp(Number(style.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight), 0.5, 3),
    paragraphSpacing: clamp(Number(style.paragraphSpacing ?? DEFAULT_TEXT_STYLE.paragraphSpacing), 0, 40),
    strokeWidth: clamp(Number(style.strokeWidth ?? DEFAULT_TEXT_STYLE.strokeWidth), 0, 8),
    shadow: clamp(Number(style.shadow ?? DEFAULT_TEXT_STYLE.shadow), 0, 100),
    glow: clamp(Number(style.glow ?? DEFAULT_TEXT_STYLE.glow), 0, 100),
    backgroundOpacity: clamp(Number(style.backgroundOpacity ?? DEFAULT_TEXT_STYLE.backgroundOpacity), 0, 100),
    backgroundEnabled: Boolean(style.backgroundEnabled ?? DEFAULT_TEXT_STYLE.backgroundEnabled),
    align: TEXT_ALIGNMENTS.includes(style.align) ? style.align : DEFAULT_TEXT_STYLE.align,
    posX: clamp(Number(style.posX ?? DEFAULT_TEXT_STYLE.posX), 0, 100),
    posY: clamp(Number(style.posY ?? DEFAULT_TEXT_STYLE.posY), 0, 100),
    scale: clamp(Number(style.scale ?? DEFAULT_TEXT_STYLE.scale), 10, 300),
    rotation: clamp(Number(style.rotation ?? DEFAULT_TEXT_STYLE.rotation), -180, 180),
  };
}

export function normalizeTextLayer(layer = {}, clip = {}) {
  const kind = TEXT_LAYER_KINDS.includes(layer.kind) ? layer.kind : clip.type === "caption" ? "caption" : "title";
  return {
    kind,
    text: String(layer.text ?? clip.name ?? "Text layer"),
    style: normalizeTextStyle(layer.style),
    animation: TEXT_ANIMATIONS.includes(layer.animation) ? layer.animation : "none",
    templateId: layer.templateId ?? null,
    keyframes: [...(layer.keyframes ?? [])],
  };
}

export function evaluateTextLayer(clip, localTime) {
  const layer = normalizeTextLayer(clip.textLayer, clip);
  const keyframes = layer.keyframes ?? [];
  const style = { ...layer.style };
  Object.keys(style).forEach((property) => {
    style[property] = evaluateKeyframes(keyframes, property, localTime, style[property]);
  });
  const text = evaluateKeyframes(keyframes, "text", localTime, layer.text);
  return { ...layer, text, style };
}

export function textPreviewVariables(textLayer) {
  const style = normalizeTextStyle(textLayer?.style);
  const backgroundOpacity = style.backgroundEnabled ? style.backgroundOpacity / 100 : 0;
  return {
    text: textLayer?.text ?? "",
    kind: textLayer?.kind ?? "title",
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: `${style.fontSize}px`,
    letterSpacing: `${style.letterSpacing}px`,
    lineHeight: style.lineHeight,
    paragraphSpacing: `${style.paragraphSpacing}px`,
    strokeWidth: `${style.strokeWidth}px`,
    strokeColor: style.strokeColor,
    shadow: style.shadow / 100,
    glow: style.glow / 100,
    backgroundColor: style.backgroundColor,
    backgroundOpacity,
    align: style.align,
    color: style.color,
    animation: textLayer?.animation ?? "none",
    posX: style.posX,
    posY: style.posY,
    scale: style.scale,
    rotation: style.rotation,
  };
}

export function applyTextTemplate(layer, templateId) {
  const template = TEXT_TEMPLATES[templateId] ?? TEXT_TEMPLATES.editorial;
  const current = normalizeTextLayer(layer);
  return normalizeTextLayer({
    ...current,
    kind: template.kind,
    style: { ...current.style, ...template.style },
    animation: template.animation,
    templateId,
  });
}
