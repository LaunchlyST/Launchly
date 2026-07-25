import assert from "node:assert/strict";
import { EditorCore } from "../index.js";

const editor = new EditorCore({ fps: 30, duration: 90 });
editor.addTrack({ id: "v1", name: "Video 1", type: "video", order: 0 });
editor.addTrack({ id: "v2", name: "Video 2", type: "video", order: 1 });
editor.addTrack({ id: "a1", name: "Audio 1", type: "audio", order: 2 });

editor.addClip({ id: "clip-a", name: "Hero", type: "video", trackId: "v1", timelineStart: 12, duration: 8, sourceStart: 0, sourceEnd: 8, originalDuration: 20, assetId: "asset-a" });
editor.addClip({ id: "clip-b", name: "Cutaway", type: "video", trackId: "v1", timelineStart: 24, duration: 4, sourceStart: 0, sourceEnd: 4, originalDuration: 12, assetId: "asset-b" });

editor.selectClip("clip-a");
editor.copySelected();
editor.paste(2);
assert.equal(editor.selectedClips[0].timelineStart, 2, "paste did not align first copied clip to playhead");

const pastedId = editor.selectedClips[0].id;
editor.moveClip(pastedId, 30, { trackId: "v2" });
assert.equal(editor.selectedClips[0].trackId, "v2", "move between compatible tracks failed");

editor.trimClipStart(pastedId, 31);
assert.equal(editor.selectedClips[0].sourceStart, 1, "trim start did not advance source start");
editor.trimClipEnd(pastedId, 3);
assert.equal(editor.selectedClips[0].duration, 3, "trim end did not clamp duration");

editor.seek(32);
editor.splitSelected();
assert.equal(editor.state.clips.filter((clip) => clip.trackId === "v2").length, 2, "split did not create a second clip");

editor.selectClip("clip-a");
editor.selectClip("clip-b", { additive: true });
const groupId = editor.groupSelected();
assert.ok(groupId, "group was not created");
assert.equal(editor.selectedClips.every((clip) => clip.groupId === groupId), true, "selected clips were not grouped");
editor.ungroupSelected();
assert.equal(editor.state.clips.filter((clip) => ["clip-a", "clip-b"].includes(clip.id)).every((clip) => !clip.groupId), true, "ungroup did not clear group metadata");

editor.selectClip("clip-a");
const replaced = editor.replaceClipMedia("clip-a", { assetId: "asset-c", mediaId: "asset-c", name: "Replacement", type: "video", mediaType: "Video", duration: 5, originalDuration: 5 });
assert.equal(replaced.assetId, "asset-c", "replace media did not update asset id");
assert.equal(replaced.name, "Replacement", "replace media did not update clip name");
assert.equal(replaced.duration, 5, "replace media did not clamp to replacement source duration");

const invalidReplace = editor.replaceClipMedia("clip-a", { assetId: "audio-c", name: "Audio Replacement", type: "audio", mediaType: "Audio", duration: 10 });
assert.notEqual(invalidReplace.type, "audio", "replace media allowed audio on video track");

editor.duplicateSelected(0.5);
assert.equal(editor.selectedClips.length, 1, "duplicate did not select duplicate");
assert.notEqual(editor.selectedClips[0].id, "clip-a", "duplicate reused original id");

const countBeforeDelete = editor.state.clips.length;
editor.deleteSelected();
assert.equal(editor.state.clips.length, countBeforeDelete - 1, "delete selected failed");

console.log("clipEditing tests passed");
