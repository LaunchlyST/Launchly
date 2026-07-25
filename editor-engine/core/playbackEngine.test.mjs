import assert from "node:assert/strict";
import { createPlayer } from "../index.js";

let rafCallback = null;
let cancelled = false;
const frames = [];
const player = createPlayer({
  fps: 30,
  duration: 10,
  requestFrame: (callback) => {
    rafCallback = callback;
    return 1;
  },
  cancelFrame: () => {
    cancelled = true;
  },
  now: () => 1000,
  renderFrame: (time) => ({
    time,
    frame: Math.round(time * 30),
    layers: [{ id: "layer", layer: 1 }],
    audio: [],
    gpuHints: { preferCompositor: true, transformOnly: true },
  }),
  onFrame: (state, frame, reason) => frames.push({ state, frame, reason }),
});

assert.equal(player.seek(1.017), 1.0333333333333334);
assert.equal(player.state.frame, 31);
assert.equal(frames.at(-1).reason, "seek");

player.play();
assert.equal(player.state.playing, true);
assert.equal(typeof rafCallback, "function");
rafCallback(1500);
assert.equal(player.state.time, 1.5333333333333334);
assert.equal(player.state.renderedFrame.frame, 46);

player.setRate(2);
assert.equal(player.state.rate, 2);
rafCallback(2000);
assert.equal(player.state.time, 2.533333333333333);

player.step(1);
assert.equal(player.state.playing, false);
assert.equal(cancelled, true);
assert.equal(player.state.time, 2.566666666666667);

player.seek(99);
assert.equal(player.state.time, 10);
player.seek(-5);
assert.equal(player.state.time, 0);

player.setCanvasZoom(1.75);
assert.equal(player.state.canvasZoom, 1.75);
assert.equal(player.state.gpuHints.canvasZoom, 1.75);
assert.equal(player.setVolume(0.4), 0.4);
assert.equal(player.setFullscreen(true), true);

player.dispose();
assert.equal(player.state.playing, false);

console.log("playbackEngine tests passed");
