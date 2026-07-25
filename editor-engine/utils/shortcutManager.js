export const DEFAULT_SHORTCUTS = Object.freeze({
  copy: "Ctrl+C",
  cut: "Ctrl+X",
  paste: "Ctrl+V",
  duplicate: "Ctrl+D",
  group: "Ctrl+G",
  ungroup: "Ctrl+Shift+G",
  undo: "Ctrl+Z",
  redo: "Ctrl+Shift+Z",
  delete: "Delete",
  rippleDelete: "Shift+Delete",
  playPause: "Space",
  split: "S",
  mute: "M",
  lock: "L",
  solo: "Alt+S",
  reverse: "R",
  freezeFrame: "Shift+F",
  selectAll: "Ctrl+A",
  deselectAll: "Escape",
  stepLeft: "ArrowLeft",
  stepRight: "ArrowRight",
  moveLeft: "Shift+ArrowLeft",
  moveRight: "Shift+ArrowRight",
  zoomIn: "Ctrl+=",
  zoomOut: "Ctrl+-",
  zoomToFit: "Ctrl+Shift+0",
  zoomToSelection: "Ctrl+Shift+F",
  disableClip: "Ctrl+Shift+D",
  fullscreen: "F",
  export: "Ctrl+E",
});

export function normalizeShortcut(eventOrString) {
  if (typeof eventOrString === "string") {
    return eventOrString.split("+").map((part) => part.trim()).filter(Boolean).join("+");
  }
  const event = eventOrString;
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  let key = event.key === " " ? "Space" : event.key;
  if (key === "Control" || key === "Meta" || key === "Alt" || key === "Shift") return "";
  if (key.length === 1) key = key.toUpperCase();
  if (key === "Del") key = "Delete";
  if (key === "=" || key === "+") key = "=";
  parts.push(key);
  return parts.join("+");
}

export function createShortcutState(custom = {}) {
  return { ...DEFAULT_SHORTCUTS, ...custom };
}

export function actionForShortcut(shortcuts, shortcut) {
  return Object.entries(shortcuts).find(([, value]) => value === shortcut)?.[0] ?? null;
}
