import { createEngineModule } from "../utils/createEngineModule.js";
import { clamp, roundToFrame } from "../utils/math.js";

const defaultNow = () => globalThis.performance?.now?.() ?? Date.now();
const defaultRequestFrame = (callback) => globalThis.requestAnimationFrame?.(callback) ?? setTimeout(() => callback(defaultNow()), 16);
const defaultCancelFrame = (id) => globalThis.cancelAnimationFrame?.(id) ?? clearTimeout(id);

function safeRate(rate) {
  return clamp(Number(rate) || 1, 0.1, 4);
}

function renderOrFallback(renderFrame, state) {
  return renderFrame?.(state.time) ?? {
    time: state.time,
    frame: Math.round(state.time * state.fps),
    layers: [],
    audio: [],
    audioMix: { audibleCount: 0, peak: 0 },
    gpuHints: { transformOnly: true, preferCompositor: true, canvasZoom: state.canvasZoom },
  };
}

const _fallbackFrame = { time: 0, frame: 0, layers: [], audio: [], audioMix: { audibleCount: 0, peak: 0 }, gpuHints: { transformOnly: true, preferCompositor: true, canvasZoom: 1 } };
function renderOrFallbackCached(renderFrame, state) {
  if (renderFrame) return renderFrame(state.time);
  _fallbackFrame.time = state.time;
  _fallbackFrame.frame = Math.round(state.time * state.fps);
  _fallbackFrame.gpuHints.canvasZoom = state.canvasZoom;
  return _fallbackFrame;
}

export function createPlayer({
  fps = 30,
  duration = 0,
  renderFrame = null,
  onFrame = null,
  requestFrame = defaultRequestFrame,
  cancelFrame = defaultCancelFrame,
  now = defaultNow,
} = {}) {
  const module = createEngineModule({
    name: "player",
    domain: "playback",
    responsibilities: [
      "play and pause preview",
      "accurate frame-based seeking",
      "frame stepping",
      "timeline synchronization",
      "canvas zoom state",
      "playback speed state",
      "GPU-friendly frame delivery",
    ],
    state: {
      playing: false,
      time: 0,
      frame: 0,
      fps,
      duration,
      rate: 1,
      canvasZoom: 1,
      volume: 0.82,
      fullscreen: false,
      lastTickAt: null,
      renderedFrame: null,
      gpuHints: { transformOnly: true, preferCompositor: true, canvasZoom: 1 },
    },
  });
  let rafId = null;

  function cancelLoop() {
    if (rafId !== null) cancelFrame(rafId);
    rafId = null;
  }

  function commitFrame(player, reason) {
    player.state.frame = Math.round(player.state.time * player.state.fps);
    player.state.renderedFrame = renderOrFallbackCached(renderFrame, player.state);
    player.state.gpuHints = {
      transformOnly: true,
      preferCompositor: true,
      canvasZoom: player.state.canvasZoom,
      ...(player.state.renderedFrame?.gpuHints ?? {}),
    };
    const snapshot = { ...player.state };
    onFrame?.(snapshot, player.state.renderedFrame, reason);
    player.emit("player:frame", { state: snapshot, frame: player.state.renderedFrame, reason });
    return player.state.renderedFrame;
  }

  function schedule(player) {
    cancelLoop();
    if (!player.state.playing) return;
    rafId = requestFrame((timestamp) => player.tick(timestamp));
  }

  return {
    ...module,
    configure(nextState = {}) {
      if (Number.isFinite(nextState.fps)) this.state.fps = Math.max(1, Number(nextState.fps));
      if (Number.isFinite(nextState.duration)) this.state.duration = Math.max(0, Number(nextState.duration));
      if (Number.isFinite(nextState.time)) this.seek(nextState.time, { emit: false });
      if (Number.isFinite(nextState.rate)) this.state.rate = safeRate(nextState.rate);
      if (Number.isFinite(nextState.canvasZoom)) this.state.canvasZoom = clamp(Number(nextState.canvasZoom), 0.1, 4);
      this.emit("player:configure", { ...this.state });
      return this.state;
    },
    play() {
      if (this.state.playing) return this.state;
      if (this.state.time >= this.state.duration && this.state.duration > 0) this.seek(0, { emit: false });
      this.state.playing = true;
      this.state.lastTickAt = now();
      commitFrame(this, "play");
      this.emit("player:play", { ...this.state });
      schedule(this);
      return this.state;
    },
    pause() {
      if (!this.state.playing) return this.state;
      this.state.playing = false;
      this.state.lastTickAt = null;
      cancelLoop();
      commitFrame(this, "pause");
      this.emit("player:pause", { ...this.state });
      return this.state;
    },
    toggle() {
      return this.state.playing ? this.pause() : this.play();
    },
    seek(time, { emit = true } = {}) {
      this.state.time = roundToFrame(clamp(Number(time) || 0, 0, this.state.duration), this.state.fps);
      this.state.frame = Math.round(this.state.time * this.state.fps);
      if (emit) {
        const frame = commitFrame(this, "seek");
        this.emit("player:seek", { time: this.state.time, frame: this.state.frame, renderedFrame: frame });
      }
      return this.state.time;
    },
    step(frames = 1) {
      const wasPlaying = this.state.playing;
      if (wasPlaying) this.pause();
      const next = this.seek(this.state.time + Number(frames) / this.state.fps);
      this.emit("player:step", { frames: Number(frames), time: next, frame: this.state.frame });
      return next;
    },
    setRate(rate) {
      this.state.rate = safeRate(rate);
      this.emit("player:rate", this.state.rate);
      commitFrame(this, "rate");
      return this.state.rate;
    },
    setCanvasZoom(zoom) {
      this.state.canvasZoom = clamp(Number(zoom) || 1, 0.1, 4);
      this.state.gpuHints = { ...this.state.gpuHints, canvasZoom: this.state.canvasZoom };
      this.emit("player:canvas-zoom", this.state.canvasZoom);
      commitFrame(this, "canvas-zoom");
      return this.state.canvasZoom;
    },
    setVolume(volume) {
      this.state.volume = clamp(Number(volume) || 0, 0, 1);
      this.emit("player:volume", this.state.volume);
      return this.state.volume;
    },
    setFullscreen(fullscreen) {
      this.state.fullscreen = Boolean(fullscreen);
      this.emit("player:fullscreen", this.state.fullscreen);
      return this.state.fullscreen;
    },
    tick(timestamp = now()) {
      if (!this.state.playing) return this.state.time;
      const last = this.state.lastTickAt ?? timestamp;
      const delta = Math.max(0, (timestamp - last) / 1000) * this.state.rate;
      this.state.lastTickAt = timestamp;
      this.state.time = roundToFrame(clamp(this.state.time + delta, 0, this.state.duration), this.state.fps);
      const ended = this.state.time >= this.state.duration;
      if (ended) {
        this.state.playing = false;
        this.state.lastTickAt = null;
        cancelLoop();
        commitFrame(this, "ended");
        this.emit("player:ended", { ...this.state });
        return this.state.time;
      }
      schedule(this);
      commitFrame(this, "tick");
      return this.state.time;
    },
    renderCurrentFrame(reason = "render") {
      return commitFrame(this, reason);
    },
    dispose() {
      cancelLoop();
      this.state.playing = false;
      this.state.lastTickAt = null;
      this.emit("player:dispose", { ...this.state });
    },
  };
}
