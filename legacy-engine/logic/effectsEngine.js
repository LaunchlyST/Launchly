import { clamp } from "../utils/math.js";
import { createId } from "../types/editorTypes.js";
import { evaluateKeyframes, KEYFRAME_EASINGS } from "../editing/keyframes.js";
import { roundToFrame } from "../utils/math.js";

export const EFFECT_TYPES = Object.freeze(["blur", "sharpen", "glow", "shadow", "vignette", "noise", "film-grain", "bloom", "lut", "rgb-split", "chromatic-aberration"]);
export const LUT_PRESETS = Object.freeze(["None", "Cinematic Cool", "Morning Glass", "Soft Commercial", "Clean Product", "Warm Documentary"]);

export const EFFECT_DEFAULTS = Object.freeze({
  blur: { radius: 8 },
  sharpen: { amount: 35 },
  glow: { intensity: 45, radius: 18 },
  shadow: { opacity: 35, distance: 18, blur: 32 },
  vignette: { amount: 28, softness: 64 },
  noise: { amount: 12 },
  "film-grain": { amount: 18, size: 42 },
  bloom: { intensity: 30, threshold: 72 },
  lut: { intensity: 70, lut: "Cinematic Cool" },
  "rgb-split": { amount: 6 },
  "chromatic-aberration": { amount: 8 },
});

export const EFFECT_PARAMETER_DEFINITIONS = Object.freeze({
  blur: { radius: { min: 0, max: 80, step: 0.1 } },
  sharpen: { amount: { min: 0, max: 100, step: 1 } },
  glow: { intensity: { min: 0, max: 100, step: 1 }, radius: { min: 0, max: 80, step: 1 } },
  shadow: { opacity: { min: 0, max: 100, step: 1 }, distance: { min: 0, max: 120, step: 1 }, blur: { min: 0, max: 120, step: 1 } },
  vignette: { amount: { min: 0, max: 100, step: 1 }, softness: { min: 0, max: 100, step: 1 } },
  noise: { amount: { min: 0, max: 100, step: 1 } },
  "film-grain": { amount: { min: 0, max: 100, step: 1 }, size: { min: 1, max: 100, step: 1 } },
  bloom: { intensity: { min: 0, max: 100, step: 1 }, threshold: { min: 0, max: 100, step: 1 } },
  lut: { intensity: { min: 0, max: 100, step: 1 }, lut: { options: LUT_PRESETS } },
  "rgb-split": { amount: { min: 0, max: 50, step: 0.1 } },
  "chromatic-aberration": { amount: { min: 0, max: 50, step: 0.1 } },
});

export function primaryEffectParameter(effectOrType) {
  const type = typeof effectOrType === "string" ? effectOrType : effectOrType?.type;
  if (type === "blur") return "radius";
  if (type === "shadow") return "opacity";
  if (type === "glow" || type === "bloom" || type === "lut") return "intensity";
  return "amount";
}

export function normalizeEffectParameters(type, parameters = {}) {
  const definitions = EFFECT_PARAMETER_DEFINITIONS[type] ?? {};
  const defaults = EFFECT_DEFAULTS[type] ?? {};
  return Object.fromEntries(Object.entries({ ...defaults, ...parameters }).map(([key, value]) => {
    const definition = definitions[key];
    if (definition?.options) return [key, definition.options.includes(value) ? value : defaults[key] ?? definition.options[0]];
    if (!definition || typeof value !== "number") return [key, value];
    return [key, clamp(Number(value), definition.min, definition.max)];
  }));
}

export function normalizeEffect(data = {}, order = 0) {
  const type = EFFECT_TYPES.includes(data.type) ? data.type : "blur";
  return {
    id: data.id ?? createId("effect"),
    type,
    enabled: data.enabled !== false,
    order: Number(data.order ?? order),
    parameters: normalizeEffectParameters(type, data.parameters),
    keyframes: [...(data.keyframes ?? [])]
      .filter((keyframe) => keyframe?.property && Object.hasOwn(EFFECT_PARAMETER_DEFINITIONS[type] ?? {}, keyframe.property))
      .map((keyframe) => ({
        id: keyframe.id ?? createId("keyframe"),
        property: keyframe.property,
        value: keyframe.value ?? data.parameters?.[keyframe.property] ?? EFFECT_DEFAULTS[type]?.[keyframe.property] ?? 0,
        time: Math.max(0, Number(keyframe.time ?? 0)),
        easing: KEYFRAME_EASINGS.includes(keyframe.easing) ? keyframe.easing : "linear",
      }))
      .sort((a, b) => a.time - b.time),
  };
}

export function evaluateEffect(effect, localTime) {
  const normalized = normalizeEffect(effect, effect.order);
  const parameters = { ...normalized.parameters };
  Object.keys(parameters).forEach((parameter) => {
    parameters[parameter] = evaluateKeyframes(normalized.keyframes, parameter, localTime, parameters[parameter]);
  });
  return { ...normalized, parameters: normalizeEffectParameters(normalized.type, parameters) };
}

export function addEffectToStack(effects = [], type, parameters = {}) {
  const effect = normalizeEffect({ type, parameters }, effects.length);
  return [...effects, effect].map((item, order) => ({ ...normalizeEffect(item, order), order }));
}

export function updateEffectInStack(effects = [], effectId, patch = {}) {
  return effects.map((effect, index) => effect.id === effectId
    ? normalizeEffect({ ...effect, ...patch, parameters: { ...effect.parameters, ...(patch.parameters ?? {}) }, id: effect.id }, index)
    : normalizeEffect(effect, index));
}

export function removeEffectFromStack(effects = [], effectId) {
  return effects.filter((effect) => effect.id !== effectId).map((effect, order) => ({ ...normalizeEffect(effect, order), order }));
}

export function duplicateEffectInStack(effects = [], effectId) {
  const source = effects.find((effect) => effect.id === effectId);
  if (!source) return effects.map((effect, order) => ({ ...normalizeEffect(effect, order), order }));
  const duplicate = normalizeEffect({ ...source, id: createId("effect") }, effects.length);
  return [...effects, duplicate].map((effect, order) => ({ ...normalizeEffect(effect, order), order }));
}

export function reorderEffectStack(effects = [], effectId, direction) {
  const ordered = [...effects].map((effect, order) => ({ ...normalizeEffect(effect, order), order })).sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((effect) => effect.id === effectId);
  if (index < 0) return ordered;
  const nextIndex = clamp(index + direction, 0, ordered.length - 1);
  const [effect] = ordered.splice(index, 1);
  ordered.splice(nextIndex, 0, effect);
  return ordered.map((item, order) => ({ ...item, order }));
}

export function addEffectParameterKeyframe(effect, parameter, value, time, easing = "ease-out", fps = 30, duration = Infinity) {
  if (!effect) return effect;
  const definitions = EFFECT_PARAMETER_DEFINITIONS[effect.type] ?? {};
  if (!definitions[parameter] || definitions[parameter].options || !KEYFRAME_EASINGS.includes(easing)) return normalizeEffect(effect, effect.order);
  const normalized = normalizeEffect(effect, effect.order);
  const keyframe = {
    id: createId("keyframe"),
    property: parameter,
    value,
    time: roundToFrame(clamp(Number(time ?? 0), 0, Number.isFinite(duration) ? duration : Number.MAX_SAFE_INTEGER), fps),
    easing,
  };
  const existing = normalized.keyframes.find((item) => item.property === keyframe.property && Math.abs(item.time - keyframe.time) <= 1 / fps);
  const keyframes = existing
    ? normalized.keyframes.map((item) => item === existing ? { ...item, value, easing } : item)
    : [...normalized.keyframes, keyframe];
  return { ...normalized, keyframes: keyframes.sort((a, b) => a.time - b.time) };
}

export function effectCssVariables(effects = []) {
  const enabled = effects.filter((effect) => effect.enabled).sort((a, b) => a.order - b.order);
  const all = (type) => enabled.filter((effect) => effect.type === type).map((effect) => effect.parameters ?? {});
  const find = (type) => all(type).at(-1) ?? {};
  const sum = (type, key) => all(type).reduce((total, parameters) => total + Number(parameters[key] ?? 0), 0);
  const blur = find("blur");
  const sharpen = find("sharpen");
  const glow = find("glow");
  const shadow = find("shadow");
  const vignette = find("vignette");
  const noise = find("noise");
  const grain = find("film-grain");
  const bloom = find("bloom");
  const rgb = find("rgb-split");
  const chroma = find("chromatic-aberration");
  const lut = find("lut");
  return {
    blur: Number(blur.radius ?? 0),
    sharpen: Number(sharpen.amount ?? 0),
    glow: clamp(sum("glow", "intensity"), 0, 160),
    shadowOpacity: Number(shadow.opacity ?? 0),
    shadowDistance: Number(shadow.distance ?? 0),
    shadowBlur: Number(shadow.blur ?? 0),
    vignette: Number(vignette.amount ?? 0),
    noise: clamp(sum("noise", "amount"), 0, 100),
    grain: clamp(sum("film-grain", "amount"), 0, 100),
    bloom: clamp(sum("bloom", "intensity"), 0, 160),
    rgbSplit: clamp(sum("rgb-split", "amount"), 0, 80),
    chromaticAberration: clamp(sum("chromatic-aberration", "amount"), 0, 80),
    lutIntensity: Number(lut.intensity ?? 0),
    lutName: lut.lut ?? "None",
    contrastBoost: clamp((Number(sharpen.amount ?? 0) + Number(bloom.intensity ?? 0)) / 250, 0, 0.8),
  };
}
