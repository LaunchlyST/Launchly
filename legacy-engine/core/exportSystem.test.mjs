import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";

const editor = new EditorCore({ fps: 30, duration: 190 });

let estimate = editor.estimateExport({ format: "MP4", resolution: 1080, fps: 30, codec: "H.264", bitrate: 18 });
assert.equal(estimate.settings.format, "MP4");
assert.ok(estimate.sizeEstimateMb > 0);
assert.equal(estimate.validation.valid, true);

const invalid = editor.queueExport({ format: "WEBM", resolution: 1080, fps: 30, codec: "H.264", bitrate: 18 }, "Invalid Codec");
assert.equal(invalid.status, "error");
assert.match(invalid.error, /not supported|require/);
assert.equal(editor.state.renderHistory[0].status, "error");

const job = editor.queueExport({ format: "MOV", resolution: 2160, fps: 60, codec: "ProRes", bitrate: 120 }, "Master Export");
assert.equal(job.status, "queued");
editor.updateExportProgress(job.id, 48, "rendering");
assert.equal(editor.state.exportQueue.find((item) => item.id === job.id).progress, 48);
assert.equal(editor.state.exportQueue.find((item) => item.id === job.id).status, "rendering");

editor.cancelExport(job.id);
assert.equal(editor.state.exportQueue.find((item) => item.id === job.id).status, "cancelled");
assert.equal(editor.state.renderHistory[0].status, "cancelled");

const failed = editor.queueExport({ format: "MP4", resolution: 1440, fps: 30, codec: "HEVC", bitrate: 222 }, "High Bitrate");
editor.failExport(failed.id, "Mock encoder budget exceeded");
assert.equal(editor.state.exportQueue.find((item) => item.id === failed.id).status, "error");
assert.equal(editor.state.renderHistory[0].error, "Mock encoder budget exceeded");

const done = editor.queueExport({ format: "WEBM", resolution: 720, fps: 24, codec: "VP9", bitrate: 8 }, "Social Cut");
editor.completeExport(done.id);
assert.equal(editor.state.exportQueue.find((item) => item.id === done.id).status, "completed");
assert.equal(editor.state.recentExports[0].id, done.id);
