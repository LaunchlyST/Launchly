import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";
import { createErrorState, logEditorError, scanMissingMedia } from "../system/errorSystem.js";

const editor = new EditorCore({ fps: 30, duration: 30 });
editor.addTrack({ id: "v1", name: "Video", type: "video" });

const state = logEditorError(createErrorState(), new Error("Render budget exceeded"), {
  source: "render",
  severity: "error",
  userMessage: "Render failed safely.",
});
assert.equal(state.logs.length, 1);
assert.equal(state.notifications[0].userMessage, "Render failed safely.");

const asset = editor.addAsset({ id: "asset-ok", name: "Available Source", type: "Video", duration: 6 });
editor.addClip({ id: "clip-ok", name: asset.name, assetId: asset.id, type: "video", trackId: "v1", duration: 6 });
editor.addClip({ id: "clip-missing", name: "Offline Camera A", assetId: "offline", type: "video", trackId: "v1", timelineStart: 7, duration: 6 });
const missing = editor.scanMissingMedia();
assert.equal(missing.length, 1);
assert.equal(missing[0].clipId, "clip-missing");
assert.equal(editor.state.errors.logs[0].source, "media");

const point = editor.createRecoveryPoint("manual-test");
assert.equal(point.reason, "manual-test");

const failed = editor.queueExport({ format: "MP4", resolution: 1080, fps: 30, codec: "H.264", bitrate: 20 }, "Test Render");
editor.failExport(failed.id, "Encoder unavailable");
assert.equal(editor.state.errors.logs[0].source, "render");
assert.equal(editor.state.renderHistory[0].status, "error");

const directMissing = scanMissingMedia([{ id: "a", name: "Missing", assetId: "x" }], []);
assert.equal(directMissing.length, 1);

console.log("errorSystem tests passed");
