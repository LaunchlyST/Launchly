import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";

const editor = new EditorCore({ fps: 30, duration: 60 });
const track = editor.addTrack({ name: "Captions", type: "video" });
const clip = editor.addClip({
  trackId: track.id,
  name: "Meet Launchly today",
  type: "caption",
  timelineStart: 2,
  duration: 6,
  originalDuration: 12,
});

editor.selectClip(clip.id);
editor.setCaptionLayer({ mode: "word", speaker: "Host", speakerColor: "#9de7c6", animation: "karaoke" });
let frame = editor.renderFrame(2.2);
assert.equal(frame.layers[0].captionPreview.mode, "word");
assert.equal(frame.layers[0].captionPreview.speaker, "Host");
assert.equal(frame.layers[0].captionPreview.words.length, 3);

const firstWord = editor.selectedClips[0].captionLayer.words[0];
editor.updateCaptionWord(firstWord.id, { text: "Build", start: 0, end: 1.5 });
assert.equal(editor.selectedClips[0].captionLayer.text, "Build Launchly today");

editor.setCaptionTiming(3, 5);
assert.equal(editor.selectedClips[0].timelineStart, 3);
assert.equal(editor.selectedClips[0].duration, 5);

editor.applyCaptionTemplate("speaker");
assert.equal(editor.selectedClips[0].captionLayer.templateId, "speaker");
assert.equal(editor.selectedClips[0].textLayer.style.backgroundEnabled, true);

editor.replaceCaptions("Launchly", "Campaigns");
assert.match(editor.selectedClips[0].captionLayer.text, /Campaigns/);

assert.match(editor.exportCaptions("srt"), /00:00:03,000 --> 00:00:08,000/);
assert.match(editor.exportCaptions("json"), /Campaigns/);

editor.undo();
assert.match(editor.selectedClips[0].captionLayer.text, /Launchly/);
editor.redo();
assert.match(editor.selectedClips[0].captionLayer.text, /Campaigns/);
