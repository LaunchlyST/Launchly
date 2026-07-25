export function createRafScheduler(task) {
  let frame = 0;
  let lastArgs = [];
  return {
    request(...args) {
      lastArgs = args;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        task(...lastArgs);
      });
    },
    flush(...args) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      task(...(args.length ? args : lastArgs));
    },
  };
}

export function timelineViewportWindow({ scrollLeft = 0, clientWidth = 0, unit = 16, bufferSeconds = 12 }) {
  const safeUnit = Math.max(1, Number(unit) || 16);
  const start = Math.max(0, scrollLeft / safeUnit - bufferSeconds);
  const end = (scrollLeft + clientWidth) / safeUnit + bufferSeconds;
  return { start, end };
}

export function isClipInWindow(clip, window) {
  const start = Number(clip.timelineStart ?? clip.start ?? 0);
  const end = start + Number(clip.duration ?? 0);
  return end >= window.start && start <= window.end;
}

export function runWhenIdle(task, timeout = 700) {
  if ("requestIdleCallback" in window) return window.requestIdleCallback(task, { timeout });
  return window.setTimeout(task, Math.min(timeout, 160));
}

export function createFrameCache(limit = 90) {
  const frames = new Map();
  return {
    get(key) {
      const value = frames.get(key);
      if (!value) return null;
      frames.delete(key);
      frames.set(key, value);
      return value;
    },
    set(key, value) {
      frames.set(key, value);
      while (frames.size > limit) frames.delete(frames.keys().next().value);
      return value;
    },
    clear() {
      frames.clear();
    },
  };
}

