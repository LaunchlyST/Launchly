import { EditorCore } from "../index.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const editor = new EditorCore({ fps: 30, duration: 60 });
editor.addTrack({ id: "v1", name: "Video", type: "video", order: 0 });
editor.addTrack({ id: "a1", name: "Audio", type: "audio", order: 1 });

editor.addClip({ id: "clip-a", name: "A", type: "video", trackId: "v1", timelineStart: 0, duration: 4, sourceStart: 0, sourceEnd: 4, originalDuration: 10 });
editor.addClip({ id: "clip-b", name: "B", type: "video", trackId: "v1", timelineStart: 4, duration: 4, sourceStart: 0, sourceEnd: 4, originalDuration: 10 });

editor.moveClip("clip-a", 2.5);
const movedStart = editor.state.clips.find((c) => c.id === "clip-a").timelineStart;
assert(typeof movedStart === "number" && movedStart >= 0, "moveClip did not update timeline position");

editor.selectClip("clip-a");
editor.trimClipStart("clip-a", 1);
assert(editor.state.clips.find((c) => c.id === "clip-a").sourceStart > 0, "trim start failed");

editor.selectClip("clip-b");
editor.trimClipEnd("clip-b", 6);
assert(editor.state.clips.find((c) => c.id === "clip-b").duration <= 6, "trim end failed");

editor.seek(5);
editor.splitSelected();
assert(editor.state.clips.filter((c) => c.trackId === "v1").length >= 3, "split did not create additional clip");

console.log("timelineModules tests passed");
