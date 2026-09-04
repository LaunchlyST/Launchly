import { EditorCore } from "./editorCore.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const editor = new EditorCore({ fps: 30, duration: 20 });
editor.addTrack({ id: "v1", name: "Video", type: "video", order: 0 });
editor.addClip({ id: "clip", name: "Clip", type: "video", trackId: "v1", timelineStart: 0, duration: 10, originalDuration: 10 });
editor.selectClip("clip");

editor.setColorGrade("exposure", 12);
editor.setColorGrade("contrast", 20);
editor.setColorGrade("gamma", 0.92);
let layer = editor.renderFrame(1).layers.find((item) => item.clipId === "clip");
assert(layer.colorGrade.exposure === 12, "exposure did not update");
assert(layer.colorPreview.contrast > 1, "contrast preview did not update");

editor.copyColorGrade();
editor.resetColorGrade();
assert(editor.selectedClips[0].colorGrade.exposure === 0, "reset did not restore exposure");
editor.pasteColorGrade();
assert(editor.selectedClips[0].colorGrade.contrast === 20, "paste did not restore copied contrast");

editor.applyColorPreset("cinematic");
assert(editor.selectedClips[0].colorGrade.curves !== 0, "preset did not apply");

editor.addColorGradeKeyframe("saturation", 0, 0, "linear");
editor.addColorGradeKeyframe("saturation", 40, 10, "linear");
layer = editor.renderFrame(5).layers.find((item) => item.clipId === "clip");
assert(layer.colorGrade.saturation > 0 && layer.colorGrade.saturation < 40, "color keyframe did not interpolate");
assert(editor.state.history.length > 0, "color grading actions were not recorded");
