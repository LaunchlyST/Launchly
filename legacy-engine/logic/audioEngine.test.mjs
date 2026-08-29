import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";

const editor = new EditorCore({ fps: 30, duration: 30 });
const voice = editor.addTrack({ name: "Voice", type: "audio" });
const music = editor.addTrack({ name: "Music", type: "audio" });
const clip = editor.addClip({ trackId: voice.id, name: "Voiceover", type: "audio", timelineStart: 0, duration: 10, originalDuration: 10 });
const bed = editor.addClip({ trackId: music.id, name: "Music bed", type: "audio", timelineStart: 0, duration: 10, originalDuration: 10, audio: { volume: 0.4 } });

editor.selectClip(clip.id);
editor.setAudio({ volume: 1.2, pan: -0.25, fadeIn: 2, fadeOut: 2, noiseReduction: 40, voiceEnhance: 70 });
editor.setAudioEQ("low", -3);
editor.setAudioEQ("mid", 2);
editor.setAudioEQ("high", 5);
editor.setAudioCompressor({ enabled: true, ratio: 4 });
editor.setAudioLimiter({ enabled: true, ceiling: -2 });

let frame = editor.renderFrame(1);
const layer = frame.audio.find((item) => item.clipId === clip.id);
assert.equal(layer.pan, -0.25);
assert.equal(layer.noiseReduction, 40);
assert.equal(layer.voiceEnhance, 70);
assert.deepEqual(layer.eq, { low: -3, mid: 2, high: 5 });
assert.equal(layer.compressor.enabled, true);
assert.equal(layer.limiter.enabled, true);
assert.ok(layer.volume < 1.2, "fade-in should reduce evaluated volume at 1s");
assert.equal(frame.audioMix.audibleCount, 2);

editor.addAudioKeyframe("volume", 0.2, 0, "linear");
editor.addAudioKeyframe("volume", 1.0, 10, "linear");
assert.equal(editor.selectedClips[0].audio.keyframes.length, 2);
assert.ok(editor.renderFrame(5).audio.find((item) => item.clipId === clip.id).volume > 0.4);

editor.setSolo(true);
frame = editor.renderFrame(5);
assert.equal(frame.audio.find((item) => item.clipId === bed.id).volume, 0);

editor.undo();
assert.equal(editor.selectedClips[0].audio.solo, false);
