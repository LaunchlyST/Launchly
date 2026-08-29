import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";

const editor = new EditorCore({ fps: 60, duration: 20 });
editor.addTrack({ id: "v1", type: "video", name: "Video", order: 0 });
editor.addClip({ id: "clip", type: "video", name: "Motion", trackId: "v1", timelineStart: 0, duration: 10, originalDuration: 10 });
editor.selectClip("clip");

editor.setMotionControls({
  x: 42,
  y: -18,
  scale: 1.35,
  rotate: 23,
  anchorX: 0.25,
  anchorY: 0.8,
  motionBlur: 46,
  easingPreset: "cinematic",
});

let layer = editor.renderFrame(1).layers.find((item) => item.clipId === "clip");
assert.equal(layer.transform.x, 42);
assert.equal(layer.transform.y, -18);
assert.equal(layer.transform.scale, 1.35);
assert.equal(layer.transform.rotate, 23);
assert.equal(layer.transform.anchorX, 0.25);
assert.equal(layer.transform.anchorY, 0.8);
assert.equal(layer.transform.motionBlur, 46);
assert.equal(layer.transform.easingPreset, "cinematic");
assert.equal(editor.renderFrame(1).gpuHints.motionBlur, true);
assert.equal(editor.renderFrame(1).gpuHints.preferCompositor, true);

editor.setMotionControls({ anchorX: -2, anchorY: 4, motionBlur: 400, easingPreset: "unknown", scale: -1 });
layer = editor.renderFrame(1).layers.find((item) => item.clipId === "clip");
assert.equal(layer.transform.anchorX, 0);
assert.equal(layer.transform.anchorY, 1);
assert.equal(layer.transform.motionBlur, 100);
assert.equal(layer.transform.easingPreset, "smooth");
assert.equal(layer.transform.scale, 0.01);

editor.addKeyframe("position", { x: 0, y: 0 }, 0, "linear");
editor.addKeyframe("position", { x: 100, y: 50 }, 10, "ease-in-out");
const animated = editor.renderFrame(5).layers.find((item) => item.clipId === "clip");
assert(animated.transform.x > 0 && animated.transform.x < 100);
assert(animated.transform.y > 0 && animated.transform.y < 50);

editor.setPlaying(true);
editor.tick(1000);
editor.tick(1016.67);
assert(editor.state.time > 0, "smooth playback tick did not advance");
editor.setPlaying(false);

console.log("motionControls tests passed");
