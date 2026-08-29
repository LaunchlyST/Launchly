import assert from "node:assert/strict";
import { createFrameCache, isClipInWindow, timelineViewportWindow } from "../utils/performanceManager.js";

const window = timelineViewportWindow({ scrollLeft: 160, clientWidth: 320, unit: 16, bufferSeconds: 2 });
assert.deepEqual(window, { start: 8, end: 32 });
assert.equal(isClipInWindow({ timelineStart: 6, duration: 2 }, window), true);
assert.equal(isClipInWindow({ timelineStart: 33, duration: 4 }, window), false);

const cache = createFrameCache(2);
cache.set("a", 1);
cache.set("b", 2);
assert.equal(cache.get("a"), 1);
cache.set("c", 3);
assert.equal(cache.get("b"), null);
assert.equal(cache.get("c"), 3);

console.log("performanceManager tests passed");
