import { EditorCore } from "./editorCore.js";
import { addEffectParameterKeyframe, addEffectToStack, duplicateEffectInStack, effectCssVariables, EFFECT_PARAMETER_DEFINITIONS, EFFECT_TYPES, LUT_PRESETS, normalizeEffect, removeEffectFromStack, reorderEffectStack, updateEffectInStack } from "../effects/effectsEngine.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const editor = new EditorCore({ fps: 30, duration: 20 });
editor.addTrack({ id: "v1", name: "Video", type: "video", order: 0 });
editor.addClip({ id: "clip", name: "Clip", type: "video", trackId: "v1", timelineStart: 0, duration: 10, originalDuration: 10 });
editor.selectClip("clip");

for (const type of EFFECT_TYPES) {
  editor.addEffect(type);
}

let clip = editor.selectedClips[0];
assert(clip.effects.length === EFFECT_TYPES.length, "not every effect was added");
assert(clip.effects.every((effect, index) => effect.order === index), "effect order was not assigned");

const blur = clip.effects.find((effect) => effect.type === "blur");
editor.updateEffect(blur.id, { parameters: { radius: 4 } });
editor.addEffectKeyframe(blur.id, "radius", 4, 0, "linear");
editor.addEffectKeyframe(blur.id, "radius", 16, 10, "linear");
editor.setEffectEnabled(blur.id, false);
editor.setEffectEnabled(blur.id, true);
editor.reorderEffect(blur.id, 1);
editor.duplicateEffect(blur.id);
clip = editor.selectedClips[0];
assert(clip.effects.filter((effect) => effect.type === "blur").length === 2, "effect did not duplicate");
const duplicate = clip.effects.find((effect) => effect.type === "blur" && effect.id !== blur.id);
editor.removeEffect(duplicate.id);
clip = editor.selectedClips[0];
assert(clip.effects.filter((effect) => effect.type === "blur").length === 1, "effect did not remove");

const layer = editor.renderFrame(5).layers.find((item) => item.clipId === "clip");
const evaluatedBlur = layer.effects.find((effect) => effect.id === blur.id);
assert(evaluatedBlur.parameters.radius > 4 && evaluatedBlur.parameters.radius < 16, "effect parameter keyframe did not interpolate");
assert(layer.effectPreview.blur > 0, "effect preview variables were not generated");
assert(layer.effectPreview.lutName, "LUT support was not represented in preview state");
assert(editor.state.history.length > 0, "effect actions were not recorded in history");

assert(EFFECT_PARAMETER_DEFINITIONS.blur.radius.max === 80, "effect parameter schema missing blur radius");
assert(LUT_PRESETS.includes("Cinematic Cool"), "LUT presets were not registered");

let stack = [];
stack = addEffectToStack(stack, "glow", { intensity: 90 });
stack = addEffectToStack(stack, "glow", { intensity: 90 });
stack = addEffectToStack(stack, "chromatic-aberration", { amount: 99 });
assert(stack.length === 3 && stack.every((effect, index) => effect.order === index), "effect stack ordering failed");
assert(effectCssVariables(stack).glow === 160, "stacked glow did not compose with clamp");
assert(effectCssVariables(stack).chromaticAberration === 50, "chromatic aberration did not clamp through schema");

const firstGlow = stack[0];
stack = updateEffectInStack(stack, firstGlow.id, { parameters: { intensity: 35 } });
assert(stack.find((effect) => effect.id === firstGlow.id).parameters.intensity === 35, "effect stack update failed");
stack = reorderEffectStack(stack, firstGlow.id, 1);
assert(stack[1].id === firstGlow.id, "effect stack reorder failed");
stack = duplicateEffectInStack(stack, firstGlow.id);
assert(stack.filter((effect) => effect.type === "glow").length === 3, "effect stack duplicate failed");
stack = removeEffectFromStack(stack, firstGlow.id);
assert(!stack.some((effect) => effect.id === firstGlow.id), "effect stack remove failed");

const lut = normalizeEffect({ type: "lut", parameters: { lut: "Morning Glass", intensity: 120 } });
assert(lut.parameters.lut === "Morning Glass" && lut.parameters.intensity === 100, "LUT normalization failed");
const keyed = addEffectParameterKeyframe(normalizeEffect({ type: "bloom", parameters: { intensity: 10 } }), "intensity", 70, 5, "ease-in", 30, 10);
assert(keyed.keyframes.length === 1 && keyed.keyframes[0].property === "intensity", "effect keyframe helper failed");

console.log("effectsSystem tests passed");
