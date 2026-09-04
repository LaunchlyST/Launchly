import { EditorCore } from "./editorCore.js";
import { evaluateKeyframes, KEYFRAME_PROPERTIES, normalizeKeyframe, sampleAnimationTimeline, upsertKeyframe } from "../index.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const editor = new EditorCore({ fps: 30, duration: 20 });
editor.addTrack({ id: "v1", type: "video", name: "Video", order: 0 });
editor.addTrack({ id: "a1", type: "audio", name: "Audio", order: 1 });
editor.addClip({ id: "clip", type: "video", name: "Animated", trackId: "v1", timelineStart: 0, duration: 10, originalDuration: 10 });
editor.addClip({ id: "voice", type: "audio", name: "Voice", trackId: "a1", timelineStart: 0, duration: 10, originalDuration: 10 });

editor.selectClip("clip");
editor.transformSelected({ x: 0, y: 0, scale: 1, rotate: 0, crop: { x: 0, y: 0, width: 1, height: 1 } });
editor.setOpacity(1);
editor.setEffect("blur", { radius: 0 });
editor.addKeyframe("position", { x: 0, y: 0 }, 0, "linear");
const first = editor.state.selectedKeyframeIds[0];
editor.addKeyframe("position", { x: 100, y: 50 }, 10, "linear");
editor.addKeyframe("scale", 2, 10, "ease-in");
editor.addKeyframe("rotation", 90, 10, "ease-out");
editor.addKeyframe("opacity", 0.25, 10, "ease-in-out");
editor.addKeyframe("crop", { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, 10, "linear");
editor.addKeyframe("blur", 12, 10, "linear");

KEYFRAME_PROPERTIES.forEach((property) => {
  assert(["position", "scale", "rotation", "opacity", "crop", "blur", "volume"].includes(property), `unsupported keyframe property ${property}`);
});

editor.selectKeyframe(first);
editor.updateSelectedKeyframes({ easing: "ease-in-out" });
assert(editor.selectedClips[0].keyframes.find((keyframe) => keyframe.id === first).easing === "ease-in-out", "keyframe easing did not update");
editor.moveKeyframeToTime(first, 2);
assert(editor.selectedClips[0].keyframes.find((keyframe) => keyframe.id === first).time === 2, "keyframe move-to-time failed");
editor.copySelectedKeyframes();
editor.moveSelectedKeyframes(1);
assert(editor.selectedClips[0].keyframes.some((keyframe) => keyframe.id === first && keyframe.time === 3), "keyframe did not move");
editor.pasteKeyframes(2);
assert(editor.state.selectedKeyframeIds.length === 1, "pasted keyframe was not selected");
editor.deleteSelectedKeyframes();
assert(!editor.selectedClips[0].keyframes.some((keyframe) => editor.state.selectedKeyframeIds.includes(keyframe.id)), "selected keyframe was not deleted");

const frame = editor.renderFrame(5);
const layer = frame.layers.find((item) => item.clipId === "clip");
assert(layer.transform.x > 0 && layer.transform.x < 100, "position did not interpolate");
assert(layer.opacity < 1, "opacity did not interpolate");
assert(layer.effects.find((effect) => effect.type === "blur").parameters.radius > 0, "blur did not interpolate");
assert(editor.animationAt("clip", 5).scale > 1, "animationAt did not evaluate live animation");
assert(editor.sampleClipAnimation("clip", 2.5).length >= 5, "clip animation sampling failed");

editor.selectClip("voice");
editor.setAudio({ volume: 1 });
editor.addKeyframe("volume", 1, 0, "linear");
editor.addKeyframe("volume", 0.2, 10, "ease-out");
const audio = editor.renderFrame(5).audio.find((item) => item.clipId === "voice");
assert(audio.volume < 1 && audio.volume > 0.2, "volume did not interpolate");

let frames = [];
frames = upsertKeyframe(frames, normalizeKeyframe({ property: "opacity", value: 0, time: 0, easing: "linear" }));
frames = upsertKeyframe(frames, normalizeKeyframe({ property: "opacity", value: 1, time: 10, easing: "ease-in" }));
assert(evaluateKeyframes(frames, "opacity", 5, 0) > 0 && evaluateKeyframes(frames, "opacity", 5, 0) < 1, "standalone keyframe interpolation failed");
assert(sampleAnimationTimeline(editor.state.clips.find((clip) => clip.id === "clip"), { fps: 30, step: 5 }).length >= 3, "standalone animation sampling failed");

console.log("keyframeSystem tests passed");
