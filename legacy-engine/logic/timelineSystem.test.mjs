import { EditorCore } from "./editorCore.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const editor = new EditorCore({ fps: 30, duration: 120 });
editor.addTrack({ id: "v1", name: "Video 1", type: "video", order: 0 });
editor.addTrack({ id: "v2", name: "Video 2", type: "video", order: 1 });
editor.addTrack({ id: "a1", name: "Audio 1", type: "audio", order: 2 });

const video = editor.addClip({
  id: "video-a",
  name: "Imported video",
  type: "video",
  trackId: "v1",
  timelineStart: 5,
  duration: 10,
  sourceStart: 0,
  sourceEnd: 10,
  originalDuration: 12,
});
const audio = editor.addClip({
  id: "audio-a",
  name: "Imported audio",
  type: "audio",
  trackId: "a1",
  timelineStart: 0,
  duration: 20,
  sourceStart: 0,
  sourceEnd: 20,
  originalDuration: 30,
});

assert(video?.timelineStart === 5 && video.sourceEnd === 10, "clip did not store required timing fields");
assert(audio?.trackId === "a1", "audio clip was not placed on audio track");
assert(!editor.addClip({ id: "bad-audio", type: "audio", trackId: "v1", duration: 4 }), "audio clip was allowed on video track");

editor.selectClip("video-a");
editor.moveClip("video-a", 16);
assert(editor.state.clips.find((clip) => clip.id === "video-a").timelineStart === 16, "clip did not move right");
editor.moveClip("video-a", 4);
assert(editor.state.clips.find((clip) => clip.id === "video-a").timelineStart === 4, "clip did not move left");
editor.moveClip("video-a", 4, { trackId: "v2" });
assert(editor.state.clips.find((clip) => clip.id === "video-a").trackId === "v2", "clip did not move between compatible tracks");

editor.trimClipStart("video-a", 2);
let clip = editor.state.clips.find((item) => item.id === "video-a");
assert(clip.timelineStart >= 4, "left trim extended beyond source start");
editor.trimClipEnd("video-a", 99);
clip = editor.state.clips.find((item) => item.id === "video-a");
assert(clip.sourceEnd <= clip.originalDuration && clip.duration > 0, "right trim exceeded original duration or created invalid duration");

editor.seek(clip.timelineStart + 2);
editor.splitSelected();
assert(editor.state.clips.filter((item) => item.name === "Imported video").length === 2, "split did not create second clip at playhead");

editor.copySelected();
editor.paste(40);
assert(editor.selectedClips.length > 0, "paste did not select pasted clips");
editor.duplicateSelected(8);
assert(editor.selectedClips.every((item) => item.timelineStart >= 48), "duplicate did not offset clips");

const beforeDelete = editor.state.clips.length;
editor.deleteSelected({ ripple: true });
assert(editor.state.clips.length < beforeDelete, "delete did not remove selected clips");

editor.setTrackState("a1", { muted: true, visible: false, locked: true });
const track = editor.state.tracks.find((item) => item.id === "a1");
assert(track.muted && !track.visible && track.locked, "track mute/hide/lock state failed");

editor.setZoom(1.5);
editor.undo();
editor.redo();
assert(editor.state.zoom === 1.5, "timeline zoom was not undoable/redoable");

editor.seek(5);
const frame = editor.renderFrame(5);
assert(frame.time === 5 && Array.isArray(frame.layers) && Array.isArray(frame.audio), "render frame did not synchronize to playhead");
assert(editor.state.history.length > 0, "timeline history was not recorded");

const historyBeforeInvalid = editor.state.history.length;
editor.addClip({ id: "invalid-overlap", name: "Overlap", type: "video", trackId: "v2", timelineStart: 4, duration: 5, sourceStart: 0, sourceEnd: 5, originalDuration: 5 });
assert(editor.state.history.length === historyBeforeInvalid, "invalid overlap created an undo history entry");

const rippleEditor = new EditorCore({ fps: 30, duration: 90 });
rippleEditor.addTrack({ id: "rv1", name: "Ripple Video", type: "video", order: 0 });
rippleEditor.addClip({ id: "r1", name: "A", type: "video", trackId: "rv1", timelineStart: 0, duration: 4, sourceStart: 0, sourceEnd: 4, originalDuration: 4 });
rippleEditor.addClip({ id: "r2", name: "B", type: "video", trackId: "rv1", timelineStart: 4, duration: 3, sourceStart: 0, sourceEnd: 3, originalDuration: 3 });
rippleEditor.addClip({ id: "r3", name: "C", type: "video", trackId: "rv1", timelineStart: 7, duration: 5, sourceStart: 0, sourceEnd: 5, originalDuration: 5 });
rippleEditor.selectClip("r1");
rippleEditor.selectClip("r2", { additive: true });
rippleEditor.deleteSelected({ ripple: true });
assert(rippleEditor.state.clips.find((item) => item.id === "r3").timelineStart === 0, "multi-clip ripple delete did not close the combined gap exactly once");
