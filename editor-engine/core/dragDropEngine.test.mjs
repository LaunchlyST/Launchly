import assert from "node:assert/strict";
import { canDropPayloadOnTrack, createDragSession, normalizeDragPayload } from "../system/dragDropEngine.js";

const media = normalizeDragPayload({ type: "media", items: [{ type: "video", name: "Shot" }] });
assert.equal(media.clipType, "video");
assert.equal(media.effectAllowed, "copyMove");

const clip = createDragSession({ type: "clip", clipIds: ["a", "b"] }, 123);
assert.equal(clip.effectAllowed, "move");
assert.equal(clip.startedAt, 123);

assert.equal(canDropPayloadOnTrack(media, { type: "video", locked: false }), true);
assert.equal(canDropPayloadOnTrack(media, { type: "audio", locked: false }), false);
assert.equal(canDropPayloadOnTrack(normalizeDragPayload({ type: "audio" }), { type: "audio", locked: false }), true);
assert.equal(canDropPayloadOnTrack(normalizeDragPayload({ type: "effect" }), { type: "audio", locked: false }), false);
assert.equal(canDropPayloadOnTrack(media, { type: "video", locked: true }), false);

console.log("dragDropEngine tests passed");
