import { createId } from "../types/editorTypes.js";

export const ERROR_SEVERITY = Object.freeze(["info", "warning", "error", "critical"]);
export const ERROR_SOURCE = Object.freeze(["runtime", "autosave", "undo", "media", "render", "import", "plugin", "unknown"]);

export function createErrorState(input = {}) {
  return {
    logs: [...(input.logs ?? [])].slice(0, 120),
    notifications: [...(input.notifications ?? [])].slice(0, 20),
    recoveryPoints: [...(input.recoveryPoints ?? [])].slice(0, 20),
    missingMedia: [...(input.missingMedia ?? [])],
    safeMode: Boolean(input.safeMode),
  };
}

export function normalizeError(error, context = {}) {
  const message = typeof error === "string" ? error : error?.message ?? "Unknown editor error";
  return {
    id: context.id ?? createId("err"),
    message,
    stack: error?.stack ?? null,
    source: ERROR_SOURCE.includes(context.source) ? context.source : "unknown",
    severity: ERROR_SEVERITY.includes(context.severity) ? context.severity : "error",
    recoverable: context.recoverable !== false,
    userMessage: context.userMessage ?? message,
    details: context.details ?? {},
    at: context.at ?? new Date().toISOString(),
  };
}

export function logEditorError(state, error, context = {}) {
  const entry = normalizeError(error, context);
  return {
    ...state,
    safeMode: state.safeMode || entry.severity === "critical",
    logs: [entry, ...(state.logs ?? [])].slice(0, 120),
    notifications: entry.userMessage ? [entry, ...(state.notifications ?? [])].slice(0, 20) : state.notifications ?? [],
  };
}

export function createRecoveryPoint(state, snapshot, reason = "manual") {
  const point = {
    id: createId("recovery"),
    reason,
    state: snapshot,
    at: new Date().toISOString(),
  };
  return { ...state, recoveryPoints: [point, ...(state.recoveryPoints ?? [])].slice(0, 20) };
}

export function scanMissingMedia(clips = [], assets = []) {
  const names = new Set(assets.map((asset) => asset.name));
  const ids = new Set(assets.map((asset) => asset.id));
  return clips
    .filter((clip) => clip.assetId || clip.mediaId || clip.name)
    .filter((clip) => {
      if (clip.assetId && ids.has(clip.assetId)) return false;
      if (clip.mediaId && ids.has(clip.mediaId)) return false;
      return clip.sourceMissing || (clip.assetId || clip.mediaId) ? true : !names.has(clip.name) && Boolean(clip.sourcePath);
    })
    .map((clip) => ({
      clipId: clip.id,
      name: clip.name,
      trackId: clip.trackId,
      reason: clip.sourceMissing ? "Marked missing" : "Source asset unavailable",
    }));
}

export function clearNotification(state, id) {
  return { ...state, notifications: (state.notifications ?? []).filter((item) => item.id !== id) };
}

