import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";

const editor = new EditorCore({ fps: 30, duration: 30 });
const track = editor.addTrack({ name: "Text", type: "video" });
const clip = editor.addClip({
  trackId: track.id,
  name: "Original title",
  type: "text",
  timelineStart: 0,
  duration: 6,
  originalDuration: 6,
});

editor.selectClip(clip.id);
editor.setTextLayer({ text: "Launch headline" });
editor.setTextKind("lower-third");
editor.setTextStyle("fontSize", 44);
editor.setTextStyle("letterSpacing", 0.4);
editor.setTextStyle("backgroundEnabled", true);
editor.setTextStyle("backgroundOpacity", 38);
editor.setTextAnimation("slide-up");

let frame = editor.renderFrame(0);
assert.equal(frame.layers[0].textLayer.text, "Launch headline");
assert.equal(frame.layers[0].textLayer.kind, "lower-third");
assert.equal(frame.layers[0].textPreview.fontSize, "44px");
assert.equal(frame.layers[0].textPreview.backgroundOpacity, 0.38);
assert.equal(frame.layers[0].textPreview.animation, "slide-up");

editor.applyTextTemplate("captionGlass");
frame = editor.renderFrame(0);
assert.equal(frame.layers[0].textLayer.kind, "caption");
assert.equal(frame.layers[0].textLayer.style.backgroundEnabled, true);

editor.seek(3);
editor.setTextStyle("fontSize", 30);
editor.addTextKeyframe("fontSize", 30, 0, "linear");
editor.addTextKeyframe("fontSize", 60, 6, "linear");
assert.equal(editor.selectedClips[0].textLayer.keyframes.length, 2);
assert.equal(editor.renderFrame(3).layers[0].textLayer.style.fontSize, 45);

editor.undo();
assert.equal(editor.selectedClips[0].textLayer.keyframes.length, 1);
editor.redo();
assert.equal(editor.selectedClips[0].textLayer.keyframes.length, 2);
