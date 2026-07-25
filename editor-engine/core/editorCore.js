import { clamp, roundToFrame } from "../utils/math.js";
import { createId } from "../types/editorTypes.js";
import { evaluateClipAnimation, KEYFRAME_EASINGS, KEYFRAME_PROPERTIES, moveKeyframes, normalizeKeyframe, sampleAnimationTimeline, updateKeyframes, upsertKeyframe } from "../editing/keyframes.js";
import { TRANSITION_PRESETS, evaluateTransition, findAdjacentClip, findOverlappingTransitions, normalizeTransition } from "../effects/transitions.js";
import { addEffectParameterKeyframe, addEffectToStack, duplicateEffectInStack, evaluateEffect, effectCssVariables, normalizeEffect, removeEffectFromStack, reorderEffectStack, updateEffectInStack } from "../effects/effectsEngine.js";
import { COLOR_GRADE_PRESETS, colorGradePreviewVariables, evaluateColorGrade, normalizeColorGrade } from "../effects/colorGrading.js";
import { applyTextTemplate, evaluateTextLayer, isTextClipType, normalizeTextLayer, textPreviewVariables } from "../text/textEngine.js";
import { CAPTION_TEMPLATES, activeCaptionWords, captionExport, normalizeCaptionLayer, parseSRT, parseVTT } from "../text/captionEngine.js";
import { evaluateAudioMix, mixAudioLayers, normalizeAudioMix } from "../audio/audioEngine.js";
import { createAiToolState, runAiToolLocally } from "../ai/aiToolSystem.js";
import { createExportJob, estimateExportSize, normalizeExportSettings, updateExportJob, validateExportSettings } from "../export/exportSystem.js";
import { createProjectRecord } from "../project/projectManager.js";
import { cacheThumbnail, createAsset, createAssetManagerState, filterAssets } from "../media/assetManager.js";
import { createPluginState, disablePlugin, installMarketplacePlugin, loadPlugin, registerPlugin, updatePluginPermissions, updatePluginSettings } from "../plugins/pluginManager.js";
import { clearNotification, createErrorState, createRecoveryPoint, logEditorError, scanMissingMedia } from "../system/errorSystem.js";

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function fastHash(obj) {
  try {
    const s = JSON.stringify(obj);
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return h;
  } catch { return 0; }
}

function createClipFromElement(element) {
  const text = element.querySelector("strong")?.textContent ?? element.textContent.trim();
  const type = element.classList.contains("caption-block") ? "caption" : element.className.match(/clip-([a-z]+)/)?.[1] ?? "video";
  return {
    id: element.dataset.clipId || createId("clip"),
    name: text.trim(),
    type,
    start: Number(element.style.getPropertyValue("--start")) || 0,
    duration: Number(element.style.getPropertyValue("--length")) || 8,
    in: 0,
    out: Number(element.style.getPropertyValue("--length")) || 8,
    speed: 1,
    reversed: false,
    freezeFrames: [],
    transform: { x: 0, y: 0, scale: 1, rotate: 0, crop: null, flipX: false, flipY: false, anchorX: 0.5, anchorY: 0.5, motionBlur: 0, easingPreset: "smooth" },
    opacity: 1,
    blendMode: "normal",
    keyframes: [],
    transitions: [],
    effects: [],
    colorGrade: normalizeColorGrade(),
    colorGradeKeyframes: [],
    textLayer: isTextClipType(type) ? normalizeTextLayer({ text: text.trim() }, { name: text.trim(), type }) : null,
    captionLayer: type === "caption" ? normalizeCaptionLayer({ text: text.trim() }, { name: text.trim(), duration: Number(element.style.getPropertyValue("--length")) || 8 }) : null,
    layer: 0,
    audio: { volume: 1, fadeIn: 0, fadeOut: 0, muted: false, solo: false, waveform: [], syncOffset: 0 },
    groupId: null,
    trackId: element.closest("[data-track-lane]")?.dataset.trackId ?? null,
  };
}

const MOTION_EASING_PRESETS = Object.freeze(["linear", "smooth", "cinematic", "snappy", "gentle"]);
const DEFAULT_TRANSFORM = Object.freeze({ x: 0, y: 0, scale: 1, rotate: 0, crop: null, flipX: false, flipY: false, anchorX: 0.5, anchorY: 0.5, motionBlur: 0, easingPreset: "smooth" });
const DEFAULT_AUDIO = Object.freeze(normalizeAudioMix());

function normalizeClip(data = {}) {
  const originalDuration = Math.max(0.1, Number(data.originalDuration ?? data.sourceDuration ?? data.mediaDuration ?? data.duration ?? data.out ?? 5));
  const sourceStart = clamp(Number(data.sourceStart ?? data.in ?? 0), 0, originalDuration - 0.1);
  const requestedSourceEnd = Number(data.sourceEnd ?? data.out ?? sourceStart + (data.duration ?? originalDuration - sourceStart));
  const sourceEnd = clamp(requestedSourceEnd, sourceStart + 0.1, originalDuration);
  const duration = Math.max(0.1, Number(data.duration ?? sourceEnd - sourceStart));
  const timelineStart = Math.max(0, Number(data.timelineStart ?? data.start ?? 0));
  return {
    id: data.id || createId("clip"),
    name: data.name || "Untitled clip",
    type: data.type || "video",
    assetId: data.assetId ?? data.mediaId ?? null,
    mediaId: data.mediaId ?? data.assetId ?? null,
    sourcePath: data.sourcePath ?? null,
    sourceMissing: Boolean(data.sourceMissing),
    trackId: data.trackId || null,
    start: timelineStart,
    timelineStart,
    duration,
    sourceStart,
    sourceEnd,
    originalDuration,
    in: sourceStart,
    out: sourceEnd,
    layer: Number(data.layer ?? 0),
    speed: Number(data.speed ?? 1),
    reversed: Boolean(data.reversed),
    freezeFrames: [...(data.freezeFrames ?? [])],
    transform: { ...DEFAULT_TRANSFORM, ...(data.transform ?? {}) },
    opacity: clamp(Number(data.opacity ?? 1), 0, 1),
    blendMode: data.blendMode || "normal",
    keyframes: [...(data.keyframes ?? [])],
    transitions: [...(data.transitions ?? [])],
    effects: [...(data.effects ?? [])].map((effect, index) => normalizeEffect(effect, index)),
    colorGrade: normalizeColorGrade(data.colorGrade),
    colorGradeKeyframes: [...(data.colorGradeKeyframes ?? [])],
    textLayer: isTextClipType(data.type) ? normalizeTextLayer(data.textLayer, { name: data.name, type: data.type }) : data.textLayer ?? null,
    captionLayer: data.type === "caption" ? normalizeCaptionLayer(data.captionLayer, { ...data, textLayer: data.textLayer }) : data.captionLayer ?? null,
    audio: normalizeAudioMix(data.audio),
    groupId: data.groupId ?? null,
    solo: Boolean(data.solo),
    hidden: Boolean(data.hidden),
    locked: Boolean(data.locked),
    colorLabel: data.colorLabel || null,
    groupName: data.groupName || null,
    border: data.border ? { ...data.border } : null,
    colorTemperature: Number(data.colorTemperature ?? 6500),
  };
}

function syncClipAliases(clip) {
  clip.timelineStart = Math.max(0, Number(clip.timelineStart ?? clip.start ?? 0));
  clip.start = clip.timelineStart;
  clip.sourceStart = Math.max(0, Number(clip.sourceStart ?? clip.in ?? 0));
  clip.sourceEnd = Math.max(clip.sourceStart + 0.1, Number(clip.sourceEnd ?? clip.out ?? clip.sourceStart + clip.duration));
  clip.duration = Math.max(0.1, Number(clip.duration ?? clip.sourceEnd - clip.sourceStart));
  clip.in = clip.sourceStart;
  clip.out = clip.sourceEnd;
  clip.originalDuration = Math.max(clip.originalDuration ?? clip.sourceEnd, clip.sourceEnd);
  return clip;
}

function createWaveform(seed = 1, samples = 96) {
  return Array.from({ length: samples }, (_, index) => {
    const value = Math.sin((index + seed) * 0.42) * 0.35 + Math.sin((index + seed) * 0.13) * 0.25 + 0.48;
    return Number(clamp(value, 0.05, 1).toFixed(3));
  });
}

function defaultAssets() {
  return [
    createAsset({ name: "Launch hero shot", type: "Video", folder: "Project Media", tags: ["hero", "campaign"], duration: 18, usageCount: 3, updatedAt: "2026-07-21T10:00:00.000Z" }),
    createAsset({ name: "Product macro", type: "Video", folder: "Project Media", tags: ["product", "macro"], duration: 9, usageCount: 1, updatedAt: "2026-07-20T10:00:00.000Z" }),
    createAsset({ name: "City dawn plate", type: "Image", folder: "Stock Library", tags: ["city", "plate"], duration: 0, recent: false, updatedAt: "2026-07-18T10:00:00.000Z" }),
    createAsset({ name: "Soft UI texture", type: "Image", folder: "Stock Library", tags: ["texture", "glass"], duration: 0, usageCount: 2, recent: false, updatedAt: "2026-07-16T10:00:00.000Z" }),
    createAsset({ name: "Brand motion plate", type: "Video", folder: "AI Generated", tags: ["generated", "brand"], duration: 6, usageCount: 1, recent: false, source: "generated", updatedAt: "2026-07-19T10:00:00.000Z" }),
    createAsset({ name: "Narration clean", type: "Audio", folder: "Recent Uploads", tags: ["voice", "clean"], duration: 72, usageCount: 1, updatedAt: "2026-07-21T11:00:00.000Z" }),
    createAsset({ name: "Logo transparent", type: "Image", folder: "Recent Uploads", tags: ["logo", "brand"], duration: 0, updatedAt: "2026-07-21T12:00:00.000Z" }),
  ];
}

export class EditorCore {
  constructor({ fps = 30, duration = 190 } = {}) {
    this.state = {
      fps,
      duration,
      time: 0,
      playing: false,
      playbackRate: 1,
      canvasZoom: 1,
      lastTickAt: null,
      snap: true,
      magnetic: true,
      zoom: 1,
      tracks: [],
      clips: [],
      selectedClipIds: [],
      selectedKeyframeIds: [],
      clipboard: [],
      keyframeClipboard: [],
      history: [],
      future: [],
      colorGradeClipboard: null,
      aiTools: createAiToolState(),
      aiCommand: "",
      aiQueue: [],
      exportQueue: [],
      recentExports: [],
      renderHistory: [],
      project: createProjectRecord({ name: "Untitled Campaign" }),
      assetManager: createAssetManagerState(defaultAssets()),
      plugins: createPluginState(),
      errors: createErrorState(),
      autosave: { status: "saved", version: 0, updatedAt: new Date().toISOString() },
    };
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    clearTimeout(this.autosaveTimer);
    this.listeners.clear();
  }

  emit(event, payload) {
    this.listeners.forEach((listener) => listener({ event, payload, state: this.state }));
  }

  snapshot() {
    const { history, future, ...rest } = this.state;
    return clone(rest);
  }

  restore(snapshot, event = "restore") {
    const history = this.state.history ?? [];
    const future = this.state.future ?? [];
    this.state = { ...clone(snapshot), history, future };
    this.emit(event, this.state);
  }

  setSnap(value) {
    return this.commit("settings:snap", () => { this.state.snap = Boolean(value); });
  }

  setMagnetic(value) {
    return this.commit("settings:magnetic", () => { this.state.magnetic = Boolean(value); });
  }

  setSelectedTransitionId(id) {
    this.state.selectedTransitionId = id;
    this.emit("transition:select", id);
  }

  setSelectedEffectId(id) {
    this.state.selectedEffectId = id;
    this.emit("effect:select", id);
  }

  setAutosaveStatus(status) {
    this.state.autosave = { ...(this.state.autosave ?? {}), ...status };
  }

  mergeErrors(patch) {
    this.state.errors = { ...(this.state.errors ?? {}), ...patch };
  }

  commit(label, action) {
    const before = this.snapshot();
    try {
      const result = action();
      const after = this.snapshot();
      if (fastHash(before) === fastHash(after)) {
        this.emit(`${label}:noop`, result);
        return result;
      }
      this.state.history.push({ label, before, after, at: Date.now() });
      if (this.state.history.length > 200) this.state.history.splice(0, this.state.history.length - 200);
      this.state.future = [];
      this.markDirty(label);
      this.emit(label, result);
      return result;
    } catch (error) {
      this.restore(before, "error:fallback");
      this.state.errors = createRecoveryPoint(this.state.errors ?? createErrorState(), before, `undo-recovery:${label}`);
      this.logError(error, { source: "runtime", severity: "error", userMessage: "The editor recovered from an interrupted action.", details: { label } });
      return undefined;
    }
  }

  markDirty(reason = "change") {
    this._snapPointsDirty = true;
    this.state.autosave = { status: "saving", version: this.state.autosave.version + 1, reason, updatedAt: new Date().toISOString() };
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.state.autosave.status = "saved";
      this.state.autosave.updatedAt = new Date().toISOString();
      this.emit("autosave", this.state.autosave);
    }, 350);
  }

  serialize() {
    return this.snapshot();
  }

  loadProject(snapshot) {
    if (!snapshot) return;
    const history = this.state.history ?? [];
    const future = this.state.future ?? [];
    this.state = { ...this.state, ...clone(snapshot), history, future };
    this.state.clips = (this.state.clips ?? []).map((clip) => syncClipAliases(normalizeClip(clip)));
    this.state.duration = Math.max(this.state.duration ?? 0, ...this.state.clips.map((clip) => (clip.timelineStart ?? clip.start) + clip.duration), 1);
    this.state.aiTools = createAiToolState(this.state.aiTools?.length ? this.state.aiTools : undefined);
    this.state.aiQueue = this.state.aiQueue ?? [];
    this.state.exportQueue = this.state.exportQueue ?? [];
    this.state.recentExports = this.state.recentExports ?? [];
    this.state.renderHistory = this.state.renderHistory ?? [];
    this.state.project = this.state.project ?? createProjectRecord({ name: "Untitled Campaign" });
    this.state.assetManager = {
      ...createAssetManagerState(this.state.assetManager?.assets?.length ? this.state.assetManager.assets : defaultAssets()),
      folders: this.state.assetManager?.folders?.length ? [...new Set(["Project Media", "Stock Library", "AI Generated", "Recent Uploads", ...this.state.assetManager.folders])] : createAssetManagerState().folders,
      selectedAssetIds: this.state.assetManager?.selectedAssetIds ?? [],
      thumbnailCache: this.state.assetManager?.thumbnailCache ?? {},
      mediaCache: this.state.assetManager?.mediaCache ?? {},
      uploadQueue: this.state.assetManager?.uploadQueue ?? [],
      proxyQueue: this.state.assetManager?.proxyQueue ?? [],
      filter: { ...createAssetManagerState().filter, ...(this.state.assetManager?.filter ?? {}) },
    };
    this.state.plugins = createPluginState(this.state.plugins);
    this.state.errors = createErrorState(this.state.errors);
    this.emit("project:load", this.state);
  }

  logError(error, context = {}) {
    this.state.errors = logEditorError(this.state.errors ?? createErrorState(), error, context);
    this.emit("error:log", this.state.errors.logs[0]);
    return this.state.errors.logs[0];
  }

  clearErrorNotification(id) {
    this.state.errors = clearNotification(this.state.errors ?? createErrorState(), id);
    this.emit("error:notification-clear", id);
  }

  createRecoveryPoint(reason = "manual") {
    this.state.errors = createRecoveryPoint(this.state.errors ?? createErrorState(), this.snapshot(), reason);
    this.emit("error:recovery-point", this.state.errors.recoveryPoints[0]);
    return this.state.errors.recoveryPoints[0];
  }

  scanMissingMedia() {
    const missing = scanMissingMedia(this.state.clips, this.state.assetManager?.assets ?? []);
    this.state.errors = { ...(this.state.errors ?? createErrorState()), missingMedia: missing };
    if (missing.length) this.logError(`${missing.length} media source${missing.length === 1 ? "" : "s"} missing`, { source: "media", severity: "warning", userMessage: "Missing media detected.", details: { missing } });
    else this.emit("media:scan", missing);
    return missing;
  }

  setProjectMetadata(patch = {}) {
    this.state.project = { ...(this.state.project ?? createProjectRecord()), ...patch, updatedAt: new Date().toISOString() };
    this.emit("project:metadata", this.state.project);
  }

  addAsset(asset = {}) {
    return this.commit("asset:add", () => {
      const next = createAsset(asset);
      this.state.assetManager.assets = [next, ...(this.state.assetManager.assets ?? [])];
      if (!this.state.assetManager.folders.includes(next.folder)) this.state.assetManager.folders.push(next.folder);
      this.state.assetManager.thumbnailCache = cacheThumbnail(this.state.assetManager, next.id, { tone: next.type.toLowerCase(), label: next.name.slice(0, 2).toUpperCase() });
      if (next.type === "Video" && !next.proxy) {
        next.proxy = { id: `proxy_${next.id}`, assetId: next.id, status: "ready", codec: "h264-preview", scale: next.resolution?.startsWith("3840") ? 0.5 : 0.75, duration: next.duration };
        this.state.assetManager.proxyQueue = [next.proxy, ...(this.state.assetManager.proxyQueue ?? [])];
      }
      this.state.assetManager.mediaCache = {
        ...(this.state.assetManager.mediaCache ?? {}),
        [next.id]: [{ kind: "metadata", value: next.metadata, createdAt: new Date().toISOString() }],
      };
      return next;
    });
  }

  updateAsset(assetId, patch = {}) {
    return this.commit("asset:update", () => {
      let updated;
      this.state.assetManager.assets = this.state.assetManager.assets.map((asset) => {
        if (asset.id !== assetId) return asset;
        updated = createAsset({ ...asset, ...patch, updatedAt: new Date().toISOString() });
        return updated;
      });
      return updated;
    });
  }

  deleteAssets(assetIds = this.state.assetManager.selectedAssetIds) {
    return this.commit("asset:delete", () => {
      const selected = new Set(assetIds);
      this.state.assetManager.assets = this.state.assetManager.assets.filter((asset) => !selected.has(asset.id));
      this.state.assetManager.selectedAssetIds = this.state.assetManager.selectedAssetIds.filter((id) => !selected.has(id));
      return [...selected];
    });
  }

  selectAsset(assetId, { additive = false, range = false } = {}) {
    const ids = this.state.assetManager.assets.map((asset) => asset.id);
    if (range && this.state.assetManager.selectedAssetIds.length) {
      const last = ids.indexOf(this.state.assetManager.selectedAssetIds.at(-1));
      const next = ids.indexOf(assetId);
      this.state.assetManager.selectedAssetIds = ids.slice(Math.min(last, next), Math.max(last, next) + 1);
    } else if (additive) {
      this.state.assetManager.selectedAssetIds = this.state.assetManager.selectedAssetIds.includes(assetId)
        ? this.state.assetManager.selectedAssetIds.filter((id) => id !== assetId)
        : [...this.state.assetManager.selectedAssetIds, assetId];
    } else {
      this.state.assetManager.selectedAssetIds = [assetId];
    }
    this.emit("asset:selection", this.state.assetManager.selectedAssetIds);
  }

  setAssetFilter(patch = {}) {
    this.state.assetManager.filter = { ...this.state.assetManager.filter, ...patch };
    this.emit("asset:filter", this.state.assetManager.filter);
  }

  filteredAssets() {
    return filterAssets(this.state.assetManager);
  }

  toggleAssetFavorite(assetIds = this.state.assetManager.selectedAssetIds) {
    return this.commit("asset:favorite", () => {
      const selected = new Set(assetIds);
      this.state.assetManager.assets = this.state.assetManager.assets.map((asset) => selected.has(asset.id) ? { ...asset, favorite: !asset.favorite, updatedAt: new Date().toISOString() } : asset);
      return [...selected];
    });
  }

  tagAssets(assetIds = this.state.assetManager.selectedAssetIds, tag = "") {
    const cleanTag = String(tag).trim();
    if (!cleanTag) return [];
    return this.commit("asset:tag", () => {
      const selected = new Set(assetIds);
      this.state.assetManager.assets = this.state.assetManager.assets.map((asset) => selected.has(asset.id) ? { ...asset, tags: [...new Set([...(asset.tags ?? []), cleanTag])], updatedAt: new Date().toISOString() } : asset);
      return [...selected];
    });
  }

  moveAssetsToFolder(assetIds = this.state.assetManager.selectedAssetIds, folder = "Project Media") {
    return this.commit("asset:folder", () => {
      if (!this.state.assetManager.folders.includes(folder)) this.state.assetManager.folders.push(folder);
      const selected = new Set(assetIds);
      this.state.assetManager.assets = this.state.assetManager.assets.map((asset) => selected.has(asset.id) ? { ...asset, folder, updatedAt: new Date().toISOString() } : asset);
      return [...selected];
    });
  }

  hydrateFromDom(root = document) {
    const lanes = [...root.querySelectorAll("[data-track-lane]")];
    this.state.tracks = lanes.map((lane, index) => {
      const head = lane.previousElementSibling;
      const id = lane.dataset.trackId || `track_${index}`;
      lane.dataset.trackId = id;
      return {
        id,
        name: head?.querySelector("strong")?.textContent ?? `Track ${index + 1}`,
        type: head?.querySelector("span")?.textContent?.startsWith("A") ? "audio" : "video",
        locked: false,
        visible: true,
        muted: false,
        solo: false,
        order: index,
      };
    });
    this.state.clips = [...root.querySelectorAll(".edit-clip, .caption-block")].map((element) => {
      const clip = normalizeClip(createClipFromElement(element));
      clip.layer = this.state.tracks.find((track) => track.id === clip.trackId)?.order ?? 0;
      if (clip.type === "audio" || this.state.tracks.find((track) => track.id === clip.trackId)?.type === "audio") {
        clip.audio.waveform = createWaveform(clip.start + clip.duration);
      }
      element.dataset.clipId = clip.id;
      return clip;
    });
    this.emit("hydrate", this.state);
  }

  get selectedClips() {
    const ids = new Set(this.state.selectedClipIds);
    return this.state.clips.filter((clip) => ids.has(clip.id));
  }

  isSelected(id) {
    return this.state.selectedClipIds.includes(id);
  }

  get _selectedClipIdSet() {
    return new Set(this.state.selectedClipIds);
  }

  selectClip(id, { additive = false, range = false } = {}) {
    if (range && this.state.selectedClipIds.length) {
      const ids = this.state.clips.map((clip) => clip.id);
      const last = ids.indexOf(this.state.selectedClipIds.at(-1));
      const next = ids.indexOf(id);
      const [from, to] = [Math.min(last, next), Math.max(last, next)];
      this.state.selectedClipIds = ids.slice(from, to + 1);
    } else if (additive) {
      this.state.selectedClipIds = this.state.selectedClipIds.includes(id)
        ? this.state.selectedClipIds.filter((item) => item !== id)
        : [...this.state.selectedClipIds, id];
    } else {
      this.state.selectedClipIds = [id];
    }
    this.emit("selection", this.state.selectedClipIds);
  }

  clearSelection() {
    this.state.selectedClipIds = [];
    this.emit("selection", []);
  }

  addTrack({ id = createId("track"), name = "Track", type = "video", order = this.state.tracks.length, locked = false, visible = true, muted = false, solo = false } = {}) {
    return this.commit("track:add", () => {
      const track = { id, name, type, order, locked, visible, muted, solo };
      this.state.tracks.push(track);
      this.state.tracks.sort((a, b) => a.order - b.order);
      return track;
    });
  }

  addClip(data = {}) {
    return this.commit("clip:add", () => {
      const track = data.trackId ? this.state.tracks.find((item) => item.id === data.trackId) : this.state.tracks[0];
      if (!track || track.locked) return undefined;
      const clip = normalizeClip({ ...data, trackId: track.id, layer: data.layer ?? track.order });
      if (!this.isClipCompatibleWithTrack(clip, track)) return undefined;
      clip.timelineStart = roundToFrame(this.snapTime(clip.timelineStart, clip.id), this.state.fps);
      clip.start = clip.timelineStart;
      if (this.state.magnetic && this.hasInvalidOverlap(clip.id, clip.trackId, clip.timelineStart, clip.duration)) return undefined;
      if (track.type === "audio" && !clip.audio.waveform.length) clip.audio.waveform = createWaveform(clip.start + clip.duration);
      this.state.clips.push(clip);
      return clip;
    });
  }

  reorderClip(id, nextLayer) {
    return this.commit("clip:reorder", () => {
      const clip = this.state.clips.find((item) => item.id === id);
      if (!clip || this.isTrackLocked(clip.trackId)) return clip;
      clip.layer = Math.max(0, Number(nextLayer));
      return clip;
    });
  }

  moveClipToTrack(id, trackId, nextStart = null) {
    return this.commit("clip:move-track", () => {
      const clip = this.state.clips.find((item) => item.id === id);
      const track = this.state.tracks.find((item) => item.id === trackId);
      if (!clip || !track || this.isTrackLocked(clip.trackId) || track.locked || !this.isClipCompatibleWithTrack(clip, track)) return clip;
      const nextTimelineStart = nextStart !== null ? roundToFrame(this.snapTime(nextStart, id), this.state.fps) : clip.timelineStart ?? clip.start;
      if (this.state.magnetic && this.hasInvalidOverlap(id, trackId, nextTimelineStart, clip.duration)) return clip;
      clip.trackId = trackId;
      clip.layer = track.order;
      if (nextStart !== null) {
        clip.timelineStart = nextTimelineStart;
        clip.start = nextTimelineStart;
      }
      return clip;
    });
  }

  rippleFrom(trackId, time, delta, excludeIds = []) {
    this.state.clips.forEach((clip) => {
      syncClipAliases(clip);
      if (clip.trackId !== trackId || excludeIds.includes(clip.id) || clip.timelineStart < time) return;
      clip.timelineStart = roundToFrame(Math.max(0, clip.timelineStart + delta), this.state.fps);
      clip.start = clip.timelineStart;
    });
  }

  snapTime(value, excludeId = null) {
    if (!this.state.snap && !this.state.magnetic) return Math.max(0, value);
    if (!this._snapPoints || this._snapPointsDirty) {
      this._snapPoints = [];
      this.state.clips.forEach((clip) => {
        this._snapPoints.push(clip.timelineStart ?? clip.start);
        this._snapPoints.push((clip.timelineStart ?? clip.start) + clip.duration);
      });
      this._snapPointsDirty = false;
    }
    const threshold = 0.35 / this.state.zoom;
    const v = Number(value);
    let closest = null;
    let closestDist = threshold + 1;
    const check = (point) => { const d = Math.abs(point - v); if (d < closestDist) { closestDist = d; closest = point; } };
    check(0);
    check(this.state.time);
    let excludedPoints = null;
    if (excludeId) {
      const ec = this.state.clips.find((c) => c.id === excludeId);
      if (ec) { const s = ec.timelineStart ?? ec.start; excludedPoints = new Set([s, s + ec.duration]); }
    }
    for (let i = 0; i < this._snapPoints.length; i++) {
      if (excludedPoints && excludedPoints.has(this._snapPoints[i])) continue;
      check(this._snapPoints[i]);
    }
    return Math.max(0, closestDist <= threshold ? closest : v);
  }

  isClipCompatibleWithTrack(clip, track) {
    if (!track) return false;
    if (track.type === "audio") return clip.type === "audio";
    if (track.type === "video") return ["video", "image", "text", "caption", "effect"].includes(clip.type);
    return track.type === clip.type;
  }

  hasInvalidOverlap(clipId, trackId, timelineStart, duration) {
    const start = roundToFrame(Math.max(0, timelineStart), this.state.fps);
    const end = start + Math.max(0.1, duration);
    return this.state.clips.some((clip) => {
      if (clip.trackId !== trackId) return false;
      if (clip.id === clipId) return false;
      const otherStart = clip.timelineStart ?? clip.start;
      const otherEnd = otherStart + clip.duration;
      return start < otherEnd && end > otherStart;
    });
  }

  nextAvailableStart(clip, preferredStart, step = 0.25) {
    let candidate = roundToFrame(Math.max(0, preferredStart), this.state.fps);
    const increment = Math.max(1 / this.state.fps, step);
    if (!this.state.magnetic) return candidate;
    const trackClips = this.state.clips
      .filter((c) => c.id !== clip.id && c.trackId === clip.trackId)
      .map((c) => ({ start: c.timelineStart ?? c.start, end: (c.timelineStart ?? c.start) + c.duration }))
      .sort((a, b) => a.start - b.start);
    const dur = Math.max(0.1, clip.duration);
    let guard = 0;
    while (guard < 500) {
      const end = candidate + dur;
      const overlaps = trackClips.some((other) => candidate < other.end && end > other.start);
      if (!overlaps) return candidate;
      const nextEdge = trackClips.find((other) => other.end > candidate);
      candidate = roundToFrame(nextEdge ? nextEdge.end : candidate + increment, this.state.fps);
      guard += 1;
    }
    return candidate;
  }

  moveClip(id, nextStart, { trackId = null, ripple = false } = {}) {
    return this.commit("clip:move", () => {
      const clip = this.state.clips.find((item) => item.id === id);
      if (!clip || this.isTrackLocked(clip.trackId)) return clip;
      const targetTrack = trackId ? this.state.tracks.find((track) => track.id === trackId) : null;
      if (targetTrack?.locked || (targetTrack && !this.isClipCompatibleWithTrack(clip, targetTrack))) return clip;
      const oldStart = clip.start;
      if (targetTrack) {
        clip.trackId = targetTrack.id;
        clip.layer = targetTrack.order;
      }
      const nextTimelineStart = roundToFrame(this.snapTime(nextStart, id), this.state.fps);
      if (this.state.magnetic && this.hasInvalidOverlap(id, clip.trackId, nextTimelineStart, clip.duration)) return clip;
      clip.timelineStart = nextTimelineStart;
      clip.start = nextTimelineStart;
      if (ripple) this.rippleFrom(clip.trackId, Math.min(oldStart, clip.start), clip.start - oldStart, [clip.id]);
      return clip;
    });
  }

  trimClipStart(id, nextStart, { ripple = false } = {}) {
    return this.commit("clip:trim-start", () => {
      const clip = this.state.clips.find((item) => item.id === id);
      if (!clip || this.isTrackLocked(clip.trackId)) return clip;
      syncClipAliases(clip);
      const oldEnd = clip.timelineStart + clip.duration;
      const oldStart = clip.timelineStart;
      const minTimelineStart = Math.max(0, oldStart - clip.sourceStart);
      const nextTimelineStart = roundToFrame(clamp(this.snapTime(nextStart, id), minTimelineStart, oldEnd - 0.1), this.state.fps);
      const delta = nextTimelineStart - oldStart;
      const nextSourceStart = clamp(clip.sourceStart + delta, 0, clip.sourceEnd - 0.1);
      const nextDuration = roundToFrame(oldEnd - nextTimelineStart, this.state.fps);
      if (this.state.magnetic && this.hasInvalidOverlap(id, clip.trackId, nextTimelineStart, nextDuration)) return clip;
      clip.timelineStart = nextTimelineStart;
      clip.start = nextTimelineStart;
      clip.sourceStart = roundToFrame(nextSourceStart, this.state.fps);
      clip.duration = Math.max(0.1, nextDuration);
      clip.in = clip.sourceStart;
      if (ripple) this.rippleFrom(clip.trackId, oldEnd, clip.start - oldStart, [clip.id]);
      return clip;
    });
  }

  trimClipEnd(id, nextDuration, { ripple = false } = {}) {
    return this.commit("clip:trim-end", () => {
      const clip = this.state.clips.find((item) => item.id === id);
      if (!clip || this.isTrackLocked(clip.trackId)) return clip;
      syncClipAliases(clip);
      const oldDuration = clip.duration;
      const maxDuration = clip.originalDuration - clip.sourceStart;
      const duration = roundToFrame(clamp(nextDuration, 0.1, maxDuration), this.state.fps);
      if (this.state.magnetic && this.hasInvalidOverlap(id, clip.trackId, clip.timelineStart, duration)) return clip;
      clip.duration = duration;
      clip.sourceEnd = roundToFrame(clip.sourceStart + duration, this.state.fps);
      clip.out = clip.sourceEnd;
      if (ripple) this.rippleFrom(clip.trackId, clip.start + oldDuration, clip.duration - oldDuration, [clip.id]);
      return clip;
    });
  }

  splitSelected(time = this.state.time) {
    return this.commit("clip:split", () => {
      const additions = [];
      this.selectedClips.forEach((clip) => {
        syncClipAliases(clip);
        const local = time - clip.timelineStart;
        if (local <= 0.1 || local >= clip.duration - 0.1) return;
        const right = syncClipAliases({ ...clone(clip), id: createId("clip"), timelineStart: time, start: time, duration: clip.duration - local, sourceStart: (clip.sourceStart ?? 0) + local, in: (clip.sourceStart ?? 0) + local });
        clip.duration = local;
        clip.sourceEnd = clip.sourceStart + local;
        clip.out = clip.sourceEnd;
        additions.push(right);
      });
      this.state.clips.push(...additions);
      return additions;
    });
  }

  duplicateSelected(offset = 1) {
    return this.commit("clip:duplicate", () => {
      const copies = this.selectedClips
        .map((clip) => {
          const copy = syncClipAliases({ ...clone(clip), id: createId("clip"), name: `${clip.name} copy`, timelineStart: (clip.timelineStart ?? clip.start) + offset, start: (clip.timelineStart ?? clip.start) + offset, groupId: null, groupName: null });
          copy.timelineStart = this.nextAvailableStart(copy, copy.timelineStart);
          copy.start = copy.timelineStart;
          return copy;
        })
        .filter((clip) => !this.state.magnetic || !this.hasInvalidOverlap(clip.id, clip.trackId, clip.timelineStart, clip.duration));
      this.state.clips.push(...copies);
      this.state.selectedClipIds = copies.map((clip) => clip.id);
      return copies;
    });
  }

  deleteSelected({ ripple = false } = {}) {
    return this.commit(ripple ? "clip:ripple-delete" : "clip:delete", () => {
      const deleted = this.selectedClips;
      if (!deleted.length) return [];
      this.state.clips = this.state.clips.filter((clip) => !this.state.selectedClipIds.includes(clip.id));
      if (ripple) {
        const gapsByTrack = new Map();
        deleted.forEach((removed) => {
          syncClipAliases(removed);
          const gaps = gapsByTrack.get(removed.trackId) ?? [];
          gaps.push({ start: removed.timelineStart, end: removed.timelineStart + removed.duration, duration: removed.duration });
          gapsByTrack.set(removed.trackId, gaps);
        });
        gapsByTrack.forEach((gaps, trackId) => {
          const ordered = gaps.sort((a, b) => a.start - b.start);
          this.state.clips.forEach((clip) => {
            syncClipAliases(clip);
            if (clip.trackId !== trackId) return;
            const shift = ordered
              .filter((gap) => clip.timelineStart >= gap.end)
              .reduce((total, gap) => total + gap.duration, 0);
            if (!shift) return;
            clip.timelineStart = roundToFrame(Math.max(0, clip.timelineStart - shift), this.state.fps);
            clip.start = clip.timelineStart;
          });
        });
      }
      this.state.selectedClipIds = [];
      return deleted;
    });
  }

  deleteClip(clipId) {
    return this.commit("clip:delete-single", () => {
      const clip = this.state.clips.find((c) => c.id === clipId);
      if (!clip) return null;
      this.state.clips = this.state.clips.filter((c) => c.id !== clipId);
      const track = this.state.tracks.find((t) => t.id === clip.trackId);
      if (track) track.clips = track.clips.filter((c) => c.id !== clipId);
      this.state.selectedClipIds = this.state.selectedClipIds.filter((id) => id !== clipId);
      this.selectedClips = this.selectedClips.filter((c) => c.id !== clipId);
      return clip;
    });
  }

  copySelected() {
    this.state.clipboard = clone(this.selectedClips);
    this.emit("clipboard:copy", this.state.clipboard);
  }

  paste(time = this.state.time) {
    return this.commit("clipboard:paste", () => {
      if (!this.state.clipboard.length) return [];
      const firstStart = Math.min(...this.state.clipboard.map((clip) => clip.timelineStart ?? clip.start));
      const pasted = this.state.clipboard
        .map((clip) => {
          const copy = syncClipAliases({ ...clone(clip), id: createId("clip"), timelineStart: time + (clip.timelineStart ?? clip.start) - firstStart, start: time + (clip.timelineStart ?? clip.start) - firstStart, groupId: null, groupName: null });
          copy.timelineStart = this.nextAvailableStart(copy, copy.timelineStart);
          copy.start = copy.timelineStart;
          return copy;
        })
        .filter((clip) => !this.state.magnetic || !this.hasInvalidOverlap(clip.id, clip.trackId, clip.timelineStart, clip.duration));
      this.state.clips.push(...pasted);
      this.state.selectedClipIds = pasted.map((clip) => clip.id);
      return pasted;
    });
  }

  groupSelected() {
    return this.commit("clip:group", () => {
      if (this.selectedClips.length < 2) return null;
      const groupId = createId("group");
      const groupName = `Group ${String(groupId).slice(-4)}`;
      this.selectedClips.forEach((clip) => { clip.groupId = groupId; clip.groupName = groupName; });
      return groupId;
    });
  }

  ungroupSelected() {
    return this.commit("clip:ungroup", () => {
      const groups = new Set(this.selectedClips.map((clip) => clip.groupId).filter(Boolean));
      if (!groups.size) return [];
      this.state.clips.forEach((clip) => {
        if (!groups.has(clip.groupId)) return;
        clip.groupId = null;
        clip.groupName = null;
      });
      return [...groups];
    });
  }

  replaceClipMedia(id, media = {}) {
    return this.commit("clip:replace-media", () => {
      const clip = this.state.clips.find((item) => item.id === id);
      if (!clip || this.isTrackLocked(clip.trackId)) return undefined;
      const nextType = media.type ?? media.clipType ?? clip.type;
      const candidate = normalizeClip({
        ...clip,
        assetId: media.assetId ?? media.mediaId ?? clip.assetId,
        mediaId: media.mediaId ?? media.assetId ?? clip.mediaId,
        name: media.name ?? clip.name,
        type: nextType,
        mediaType: media.mediaType ?? media.type ?? clip.mediaType,
        originalDuration: media.originalDuration ?? media.duration ?? clip.originalDuration,
        sourceStart: 0,
        sourceEnd: media.duration ?? media.originalDuration ?? clip.originalDuration,
        duration: Math.min(clip.duration, media.duration ?? media.originalDuration ?? clip.originalDuration),
      });
      const track = this.state.tracks.find((item) => item.id === clip.trackId);
      if (!this.isClipCompatibleWithTrack(candidate, track)) return clip;
      if (this.state.magnetic && this.hasInvalidOverlap(clip.id, clip.trackId, clip.timelineStart, candidate.duration)) return clip;
      Object.assign(clip, syncClipAliases(candidate));
      if (track?.type === "audio" && !clip.audio.waveform.length) clip.audio.waveform = createWaveform(clip.start + clip.duration);
      return clip;
    });
  }

  setTrackState(trackId, patch) {
    return this.commit("track:update", () => {
      const track = this.state.tracks.find((item) => item.id === trackId);
      if (track) Object.assign(track, patch);
      return track;
    });
  }

  isTrackLocked(trackId) {
    return this.state.tracks.find((track) => track.id === trackId)?.locked;
  }

  setTrackAudio(trackId, patch) {
    return this.setTrackState(trackId, patch);
  }

  closeGaps(trackId = null) {
    return this.commit("track:close-gaps", () => {
      const tracks = trackId ? this.state.tracks.filter((t) => t.id === trackId) : this.state.tracks;
      tracks.forEach((track) => {
        const trackClips = this.state.clips
          .filter((c) => c.trackId === track.id)
          .sort((a, b) => (a.timelineStart ?? a.start) - (b.timelineStart ?? b.start));
        let cursor = 0;
        trackClips.forEach((clip) => {
          const clipStart = clip.timelineStart ?? clip.start;
          if (clipStart > cursor + 0.01) {
            const delta = cursor - clipStart;
            clip.timelineStart = roundToFrame(Math.max(0, clip.timelineStart + delta), this.state.fps);
            clip.start = clip.timelineStart;
          }
          cursor = (clip.timelineStart ?? clip.start) + clip.duration;
        });
      });
    });
  }

  soloTrack(trackId) {
    return this.commit("track:solo", () => {
      const track = this.state.tracks.find((t) => t.id === trackId);
      if (!track) return null;
      const wasSolo = track.solo;
      this.state.tracks.forEach((t) => { t.solo = false; });
      if (!wasSolo) {
        track.solo = true;
        this.state.tracks.forEach((t) => {
          if (t.id === trackId) return;
          t.visible = false;
        });
      } else {
        this.state.tracks.forEach((t) => { t.visible = true; });
      }
      return track;
    });
  }

  seek(time) {
    this.state.time = roundToFrame(clamp(time, 0, this.state.duration), this.state.fps);
    this.emit("playhead:seek", this.state.time);
  }

  step(frames = 1) {
    this.seek(this.state.time + frames / this.state.fps);
  }

  setPlaying(playing) {
    this.state.playing = playing;
    this.state.lastTickAt = playing ? globalThis.performance?.now?.() ?? Date.now() : null;
    this.emit("playback", playing);
  }

  setPlaybackRate(rate) {
    this.state.playbackRate = clamp(Number(rate), 0.1, 4);
    this.emit("playback:rate", this.state.playbackRate);
  }

  setCanvasZoom(zoom) {
    this.state.canvasZoom = clamp(Number(zoom), 0.1, 4);
    this.emit("canvas:zoom", this.state.canvasZoom);
  }

  tick(now = globalThis.performance?.now?.() ?? Date.now()) {
    if (!this.state.playing) return this.state.time;
    const last = this.state.lastTickAt ?? now;
    this.state.lastTickAt = now;
    this.seek(this.state.time + ((now - last) / 1000) * this.state.playbackRate);
    if (this.state.time >= this.state.duration) this.setPlaying(false);
    return this.state.time;
  }

  setZoom(zoom) {
    return this.commit("timeline:zoom", () => {
      this.state.zoom = clamp(zoom, 0.25, 4);
      return this.state.zoom;
    });
  }

  zoomToFit() {
    if (!this.state.clips.length) return this.setZoom(1);
    let min = Infinity;
    let max = -Infinity;
    this.state.clips.forEach((clip) => {
      const s = clip.timelineStart ?? clip.start;
      if (s < min) min = s;
      if (s + clip.duration > max) max = s + clip.duration;
    });
    if (!isFinite(min) || !isFinite(max) || max - min < 0.5) return this.setZoom(1);
    const viewportSeconds = 60;
    const zoom = clamp(viewportSeconds / (max - min + 2), 0.25, 4);
    return this.setZoom(zoom);
  }

  zoomToSelection() {
    const selected = this.selectedClips;
    if (selected.length < 2) return this.zoomToFit();
    let min = Infinity;
    let max = -Infinity;
    selected.forEach((clip) => {
      const s = clip.timelineStart ?? clip.start;
      if (s < min) min = s;
      if (s + clip.duration > max) max = s + clip.duration;
    });
    if (!isFinite(min) || !isFinite(max) || max - min < 0.5) return this.setZoom(1);
    const zoom = clamp(50 / (max - min + 1), 0.25, 4);
    return this.setZoom(zoom);
  }

  slipEdit(id, delta) {
    return this.commit("clip:slip", () => {
      const clip = this.state.clips.find((c) => c.id === id);
      if (!clip) return null;
      syncClipAliases(clip);
      const maxSlip = clip.originalDuration - clip.duration;
      if (maxSlip <= 0) return null;
      const newSourceStart = roundToFrame(clamp((clip.sourceStart ?? 0) + delta, 0, maxSlip), this.state.fps);
      clip.sourceStart = newSourceStart;
      clip.sourceEnd = roundToFrame(newSourceStart + clip.duration, this.state.fps);
      clip.in = newSourceStart;
      clip.out = clip.sourceEnd;
      return clip;
    });
  }

  slideEdit(id, delta) {
    return this.commit("clip:slide", () => {
      const clip = this.state.clips.find((c) => c.id === id);
      if (!clip) return null;
      const newStart = roundToFrame(Math.max(0, (clip.timelineStart ?? clip.start) + delta), this.state.fps);
      clip.timelineStart = newStart;
      clip.start = newStart;
      return clip;
    });
  }

  toggleClipDisabled(id) {
    return this.commit("clip:disable", () => {
      const clip = this.state.clips.find((c) => c.id === id);
      if (!clip) return null;
      clip.hidden = !clip.hidden;
      return clip;
    });
  }

  renameTrack(trackId, name) {
    return this.commit("track:rename", () => {
      const track = this.state.tracks.find((t) => t.id === trackId);
      if (track) track.name = String(name).substring(0, 40) || track.name;
      return track;
    });
  }

  reorderTrack(trackId, newOrder) {
    return this.commit("track:reorder", () => {
      const track = this.state.tracks.find((t) => t.id === trackId);
      if (!track) return null;
      track.order = Math.max(0, Number(newOrder));
      this.state.tracks.sort((a, b) => a.order - b.order);
      return track;
    });
  }

  setClipProperties(id, patch) {
    return this.commit("clip:properties", () => {
      const clip = this.state.clips.find((item) => item.id === id);
      if (!clip) return undefined;
      Object.assign(clip, patch);
      if (patch.transform) clip.transform = this.normalizeTransform({ ...DEFAULT_TRANSFORM, ...(clip.transform ?? {}) });
      syncClipAliases(clip);
      clip.duration = Math.max(0.1, roundToFrame(Number(clip.duration), this.state.fps));
      clip.sourceStart = roundToFrame(clamp(Number(clip.sourceStart ?? clip.in ?? 0), 0, clip.originalDuration - 0.1), this.state.fps);
      clip.sourceEnd = roundToFrame(clamp(Number(clip.sourceEnd ?? clip.out ?? clip.sourceStart + clip.duration), clip.sourceStart + 0.1, clip.originalDuration), this.state.fps);
      clip.duration = roundToFrame(Math.min(clip.duration, clip.sourceEnd - clip.sourceStart), this.state.fps);
      return clip;
    });
  }

  transformSelected(patch) {
    return this.commit("clip:transform", () => {
      this.selectedClips.forEach((clip) => {
        clip.transform = this.normalizeTransform({ ...DEFAULT_TRANSFORM, ...(clip.transform ?? {}), ...patch });
      });
      return this.selectedClips;
    });
  }

  normalizeTransform(transform = {}) {
    const easingPreset = MOTION_EASING_PRESETS.includes(transform.easingPreset) ? transform.easingPreset : "smooth";
    return {
      ...DEFAULT_TRANSFORM,
      ...transform,
      x: clamp(Number(transform.x ?? 0), -10000, 10000),
      y: clamp(Number(transform.y ?? 0), -10000, 10000),
      scale: clamp(Number(transform.scale ?? 1), 0.01, 20),
      rotate: clamp(Number(transform.rotate ?? 0), -3600, 3600),
      anchorX: clamp(Number(transform.anchorX ?? 0.5), 0, 1),
      anchorY: clamp(Number(transform.anchorY ?? 0.5), 0, 1),
      motionBlur: clamp(Number(transform.motionBlur ?? 0), 0, 100),
      easingPreset,
    };
  }

  setMotionControls(patch = {}) {
    return this.transformSelected(patch);
  }

  setSpeed(speed) {
    return this.commit("clip:speed", () => {
      this.selectedClips.forEach((clip) => {
        const prev = clamp(Number(clip.speed ?? 1), 0.05, 10);
        const next = clamp(Number(speed), 0.05, 10);
        clip.speed = next;
        clip.duration = roundToFrame((clip.duration ?? 0) * (prev / next), this.state.fps);
        syncClipAliases(clip);
      });
      return this.selectedClips;
    });
  }

  reverseSelected() {
    return this.commit("clip:reverse", () => {
      this.selectedClips.forEach((clip) => { clip.reversed = !clip.reversed; });
      return this.selectedClips;
    });
  }

  freezeFrameSelected(time = this.state.time) {
    return this.commit("clip:freeze-frame", () => {
      this.selectedClips.forEach((clip) => { clip.freezeFrames = [...(clip.freezeFrames ?? []), roundToFrame(time, this.state.fps)]; });
      return this.selectedClips;
    });
  }

  setOpacity(opacity) {
    return this.commit("clip:opacity", () => {
      this.selectedClips.forEach((clip) => { clip.opacity = clamp(opacity, 0, 1); });
      return this.selectedClips;
    });
  }

  setBlendMode(blendMode) {
    return this.commit("clip:blend-mode", () => {
      this.selectedClips.forEach((clip) => { clip.blendMode = blendMode; });
      return this.selectedClips;
    });
  }

  valueForKeyframe(clip, property) {
    if (property === "position") return { x: clip.transform?.x ?? 0, y: clip.transform?.y ?? 0 };
    if (property === "scale") return clip.transform?.scale ?? 1;
    if (property === "rotation") return clip.transform?.rotate ?? 0;
    if (property === "opacity") return clip.opacity ?? 1;
    if (property === "crop") return clip.transform?.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    if (property === "blur") return clip.effects?.find((effect) => effect.type === "blur")?.parameters?.radius ?? 0;
    if (property === "volume") return clip.audio?.volume ?? 1;
    return undefined;
  }

  addKeyframe(property, value = undefined, time = this.state.time, easing = "ease-out") {
    return this.commit("clip:keyframe", () => {
      if (!KEYFRAME_PROPERTIES.includes(property)) return [];
      const selectedIds = [];
      this.selectedClips.forEach((clip) => {
        const localTime = this.localClipTime(clip, time);
        const keyframe = normalizeKeyframe({
          property,
          value: clone(value ?? this.valueForKeyframe(clip, property)),
          time: localTime,
          easing,
        }, { fps: this.state.fps, duration: clip.duration, fallbackValue: this.valueForKeyframe(clip, property) });
        clip.keyframes = upsertKeyframe(clip.keyframes ?? [], keyframe, { fps: this.state.fps, duration: clip.duration });
        const saved = clip.keyframes.find((item) => item.property === keyframe.property && item.time === keyframe.time);
        if (saved) selectedIds.push(saved.id);
      });
      this.state.selectedKeyframeIds = selectedIds;
      return this.selectedClips;
    });
  }

  selectKeyframe(id, { additive = false } = {}) {
    this.state.selectedKeyframeIds = additive
      ? this.state.selectedKeyframeIds.includes(id)
        ? this.state.selectedKeyframeIds.filter((item) => item !== id)
        : [...this.state.selectedKeyframeIds, id]
      : [id];
    this.emit("keyframe:selection", this.state.selectedKeyframeIds);
  }

  deleteSelectedKeyframes() {
    return this.commit("keyframe:delete", () => {
      const selected = new Set(this.state.selectedKeyframeIds);
      this.state.clips.forEach((clip) => { clip.keyframes = (clip.keyframes ?? []).filter((keyframe) => !selected.has(keyframe.id)); });
      this.state.selectedKeyframeIds = [];
      return [...selected];
    });
  }

  moveSelectedKeyframes(deltaSeconds) {
    return this.commit("keyframe:move", () => {
      const selected = new Set(this.state.selectedKeyframeIds);
      this.state.clips.forEach((clip) => {
        clip.keyframes = moveKeyframes(clip.keyframes ?? [], [...selected], deltaSeconds, { fps: this.state.fps, duration: clip.duration });
      });
      return this.state.selectedKeyframeIds;
    });
  }

  moveKeyframeToTime(keyframeId, time, { absoluteTimeline = false } = {}) {
    return this.commit("keyframe:move-to-time", () => {
      let moved;
      this.state.clips.forEach((clip) => {
        const keyframe = (clip.keyframes ?? []).find((item) => item.id === keyframeId);
        if (!keyframe) return;
        const localTime = absoluteTimeline ? this.localClipTime(clip, time) : time;
        clip.keyframes = updateKeyframes(clip.keyframes, [keyframeId], { time: localTime }, { fps: this.state.fps, duration: clip.duration });
        moved = clip.keyframes.find((item) => item.id === keyframeId);
      });
      this.state.selectedKeyframeIds = moved ? [keyframeId] : this.state.selectedKeyframeIds;
      return moved;
    });
  }

  updateSelectedKeyframes(patch = {}) {
    return this.commit("keyframe:update", () => {
      const sanitized = { ...patch };
      if (sanitized.property && !KEYFRAME_PROPERTIES.includes(sanitized.property)) delete sanitized.property;
      if (sanitized.easing && !KEYFRAME_EASINGS.includes(sanitized.easing)) delete sanitized.easing;
      this.state.clips.forEach((clip) => {
        clip.keyframes = updateKeyframes(clip.keyframes ?? [], this.state.selectedKeyframeIds, sanitized, { fps: this.state.fps, duration: clip.duration });
      });
      return this.state.selectedKeyframeIds;
    });
  }

  copySelectedKeyframes() {
    const selected = new Set(this.state.selectedKeyframeIds);
    this.state.keyframeClipboard = this.state.clips.flatMap((clip) => (clip.keyframes ?? []).filter((keyframe) => selected.has(keyframe.id)).map((keyframe) => clone(keyframe)));
    this.emit("keyframe:copy", this.state.keyframeClipboard);
  }

  pasteKeyframes(time = this.state.time) {
    return this.commit("keyframe:paste", () => {
      if (!this.state.keyframeClipboard.length || !this.selectedClips.length) return [];
      const first = Math.min(...this.state.keyframeClipboard.map((keyframe) => keyframe.time));
      const pastedIds = [];
      this.selectedClips.forEach((clip) => {
        const localTime = this.localClipTime(clip, time);
        const pasted = this.state.keyframeClipboard.map((keyframe) => {
          const item = { ...clone(keyframe), id: createId("keyframe"), time: roundToFrame(clamp(localTime + keyframe.time - first, 0, clip.duration), this.state.fps) };
          pastedIds.push(item.id);
          return item;
        });
        clip.keyframes = [...(clip.keyframes ?? []), ...pasted].sort((a, b) => a.time - b.time);
      });
      this.state.selectedKeyframeIds = pastedIds;
      return pastedIds;
    });
  }

  animationAt(clipId, time = this.state.time) {
    const clip = this.state.clips.find((item) => item.id === clipId);
    if (!clip) return null;
    return evaluateClipAnimation(clip, this.localClipTime(clip, time));
  }

  sampleClipAnimation(clipId, step = 0.25) {
    const clip = this.state.clips.find((item) => item.id === clipId);
    if (!clip) return [];
    return sampleAnimationTimeline(clip, { fps: this.state.fps, step });
  }

  addTransition(type = "video", duration = 0.5, name = "cross-dissolve", direction = "out", easing = "ease-in-out") {
    if (type !== "audio" && type !== "video") { name = type; type = "video"; }
    return this.commit("clip:transition", () => {
      this.selectedClips.forEach((clip) => {
        const adjacent = findAdjacentClip(this.state.clips, clip, direction);
        const transition = normalizeTransition({ id: createId("transition"), type, name, duration, direction, easing, fromClipId: direction === "in" ? adjacent?.id ?? null : clip.id, toClipId: direction === "in" ? clip.id : adjacent?.id ?? null });
        clip.transitions = [...(clip.transitions ?? []), transition];
      });
      return this.selectedClips;
    });
  }

  updateTransition(transitionId, patch) {
    return this.commit("transition:update", () => {
      let updated;
      this.state.clips.forEach((clip) => {
        clip.transitions = (clip.transitions ?? []).map((transition) => {
          if (transition.id !== transitionId) return transition;
          updated = normalizeTransition({ ...transition, ...patch, id: transition.id });
          return updated;
        });
      });
      return updated;
    });
  }

  removeTransition(transitionId) {
    return this.commit("transition:remove", () => {
      this.state.clips.forEach((clip) => {
        clip.transitions = (clip.transitions ?? []).filter((transition) => transition.id !== transitionId);
      });
      return transitionId;
    });
  }

  duplicateTransition(transitionId) {
    return this.commit("transition:duplicate", () => {
      let duplicate;
      this.state.clips.forEach((clip) => {
        const transition = (clip.transitions ?? []).find((item) => item.id === transitionId);
        if (!transition) return;
        duplicate = { ...clone(transition), id: createId("transition") };
        clip.transitions = [...clip.transitions, duplicate];
      });
      return duplicate;
    });
  }

  addTransitionPreset(presetId) {
    const preset = TRANSITION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return null;
    return this.commit("clip:transition-preset", () => {
      this.selectedClips.forEach((clip) => {
        const newTransitions = preset.transitions.map((t) =>
          normalizeTransition({
            id: createId("transition"),
            type: "video",
            name: t.name,
            duration: t.duration,
            direction: t.direction,
            easing: t.easing,
            fromClipId: clip.id,
            toClipId: findAdjacentClip(this.state.clips, clip, "out")?.id ?? null,
          })
        );
        clip.transitions = [...(clip.transitions ?? []), ...newTransitions];
      });
      return this.selectedClips;
    });
  }

  findOverlaps() {
    return findOverlappingTransitions(this.state.clips);
  }

  setAudio(patch) {
    return this.commit("clip:audio", () => {
      this.selectedClips.forEach((clip) => { clip.audio = normalizeAudioMix({ ...(clip.audio ?? {}), ...patch }); });
      return this.selectedClips;
    });
  }

  setMute(muted = true) { return this.setAudio({ muted }); }
  setSolo(solo = true) { return this.setAudio({ solo }); }

  setAudioEQ(band, value) {
    return this.commit("audio:eq", () => {
      this.selectedClips.forEach((clip) => {
        const audio = normalizeAudioMix(clip.audio);
        clip.audio = normalizeAudioMix({ ...audio, eq: { ...audio.eq, [band]: value } });
      });
      return this.selectedClips;
    });
  }

  setAudioCompressor(patch = {}) {
    return this.commit("audio:compressor", () => {
      this.selectedClips.forEach((clip) => {
        const audio = normalizeAudioMix(clip.audio);
        clip.audio = normalizeAudioMix({ ...audio, compressor: { ...audio.compressor, ...patch } });
      });
      return this.selectedClips;
    });
  }

  setAudioLimiter(patch = {}) {
    return this.commit("audio:limiter", () => {
      this.selectedClips.forEach((clip) => {
        const audio = normalizeAudioMix(clip.audio);
        clip.audio = normalizeAudioMix({ ...audio, limiter: { ...audio.limiter, ...patch } });
      });
      return this.selectedClips;
    });
  }

  addAudioKeyframe(parameter, value, time = this.state.time, easing = "ease-out") {
    return this.commit("audio:keyframe", () => {
      this.selectedClips.forEach((clip) => {
        const localTime = this.localClipTime(clip, time);
        const audio = normalizeAudioMix(clip.audio);
        clip.audio = normalizeAudioMix({
          ...audio,
          keyframes: [...audio.keyframes, { id: createId("keyframe"), property: parameter, time: roundToFrame(localTime, this.state.fps), value: clone(value), easing }].sort((a, b) => a.time - b.time),
        });
      });
      return this.selectedClips;
    });
  }

  setEffect(type, parameters = {}, enabled = true) {
    return this.commit("clip:effect", () => {
      this.selectedClips.forEach((clip) => {
        clip.effects = clip.effects ?? [];
        const existing = clip.effects.find((effect) => effect.type === type);
        if (existing) clip.effects = updateEffectInStack(clip.effects, existing.id, { enabled, parameters });
        else clip.effects = addEffectToStack(clip.effects, type, parameters).map((effect) => effect.type === type && effect.order === clip.effects.length ? { ...effect, enabled } : effect);
      });
      return this.selectedClips;
    });
  }

  addEffect(type, parameters = {}) {
    return this.commit("effect:add", () => {
      const added = [];
      this.selectedClips.forEach((clip) => {
        clip.effects = clip.effects ?? [];
        clip.effects = addEffectToStack(clip.effects, type, parameters);
        const effect = clip.effects.at(-1);
        added.push(effect);
      });
      return added;
    });
  }

  updateEffect(effectId, patch = {}) {
    return this.commit("effect:update", () => {
      let updated;
      this.state.clips.forEach((clip) => {
        clip.effects = updateEffectInStack(clip.effects ?? [], effectId, patch);
        updated = clip.effects.find((effect) => effect.id === effectId) ?? updated;
      });
      return updated;
    });
  }

  setEffectEnabled(effectId, enabled) {
    return this.updateEffect(effectId, { enabled });
  }

  removeEffect(effectId) {
    return this.commit("effect:remove", () => {
      this.state.clips.forEach((clip) => {
        clip.effects = removeEffectFromStack(clip.effects ?? [], effectId);
      });
      return effectId;
    });
  }

  duplicateEffect(effectId) {
    return this.commit("effect:duplicate", () => {
      let duplicate;
      this.state.clips.forEach((clip) => {
        const effect = (clip.effects ?? []).find((item) => item.id === effectId);
        if (!effect) return;
        clip.effects = duplicateEffectInStack(clip.effects, effectId);
        duplicate = clip.effects.at(-1);
      });
      return duplicate;
    });
  }

  reorderEffect(effectId, direction) {
    return this.commit("effect:reorder", () => {
      this.state.clips.forEach((clip) => {
        clip.effects = reorderEffectStack(clip.effects ?? [], effectId, direction);
      });
      return effectId;
    });
  }

  addEffectKeyframe(effectId, parameter, value, time = this.state.time, easing = "ease-out") {
    return this.commit("effect:keyframe", () => {
      this.state.clips.forEach((clip) => {
        const localTime = this.localClipTime(clip, time);
        clip.effects = (clip.effects ?? []).map((effect) => effect.id === effectId
          ? addEffectParameterKeyframe(effect, parameter, clone(value), localTime, easing, this.state.fps, clip.duration)
          : effect);
      });
      return effectId;
    });
  }

  setLayerOrder(id, layer) {
    return this.reorderClip(id, layer);
  }

  setColorGrade(parameter, value) {
    return this.commit("color-grade:update", () => {
      this.selectedClips.forEach((clip) => {
        clip.colorGrade = { ...normalizeColorGrade(clip.colorGrade), [parameter]: value };
      });
      return this.selectedClips;
    });
  }

  applyColorGrade(patch) {
    return this.commit("color-grade:apply", () => {
      this.selectedClips.forEach((clip) => {
        clip.colorGrade = { ...normalizeColorGrade(clip.colorGrade), ...patch };
      });
      return this.selectedClips;
    });
  }

  resetColorGrade() {
    return this.applyColorGrade(normalizeColorGrade());
  }

  applyColorPreset(name) {
    return this.applyColorGrade(COLOR_GRADE_PRESETS[name] ?? COLOR_GRADE_PRESETS.neutral);
  }

  copyColorGrade() {
    this.state.colorGradeClipboard = normalizeColorGrade(this.selectedClips[0]?.colorGrade);
    this.emit("color-grade:copy", this.state.colorGradeClipboard);
  }

  pasteColorGrade() {
    if (!this.state.colorGradeClipboard) return [];
    return this.applyColorGrade(this.state.colorGradeClipboard);
  }

  addColorGradeKeyframe(parameter, value, time = this.state.time, easing = "ease-out") {
    return this.commit("color-grade:keyframe", () => {
      this.selectedClips.forEach((clip) => {
        const localTime = this.localClipTime(clip, time);
        clip.colorGradeKeyframes = [...(clip.colorGradeKeyframes ?? []), { id: createId("keyframe"), property: parameter, time: roundToFrame(localTime, this.state.fps), value: clone(value), easing }].sort((a, b) => a.time - b.time);
      });
      return this.selectedClips;
    });
  }

  setTextLayer(patch = {}) {
    return this.commit("text:update", () => {
      this.selectedClips.filter((clip) => isTextClipType(clip.type)).forEach((clip) => {
        const current = normalizeTextLayer(clip.textLayer, clip);
        clip.textLayer = normalizeTextLayer({ ...current, ...patch, style: { ...current.style, ...(patch.style ?? {}) } }, clip);
        if (typeof patch.text === "string") clip.name = patch.text.trim() || clip.name;
      });
      return this.selectedClips;
    });
  }

  setTextKind(kind) {
    return this.setTextLayer({ kind });
  }

  setTextStyle(parameter, value) {
    return this.commit("text:style", () => {
      this.selectedClips.filter((clip) => isTextClipType(clip.type)).forEach((clip) => {
        const current = normalizeTextLayer(clip.textLayer, clip);
        clip.textLayer = normalizeTextLayer({ ...current, style: { ...current.style, [parameter]: value } }, clip);
      });
      return this.selectedClips;
    });
  }

  setTextAnimation(animation) {
    return this.setTextLayer({ animation });
  }

  applyTextTemplate(templateId) {
    return this.commit("text:template", () => {
      this.selectedClips.filter((clip) => isTextClipType(clip.type)).forEach((clip) => {
        clip.textLayer = applyTextTemplate(clip.textLayer, templateId);
      });
      return this.selectedClips;
    });
  }

  addTextKeyframe(parameter, value, time = this.state.time, easing = "ease-out") {
    return this.commit("text:keyframe", () => {
      this.selectedClips.filter((clip) => isTextClipType(clip.type)).forEach((clip) => {
        const localTime = this.localClipTime(clip, time);
        const layer = normalizeTextLayer(clip.textLayer, clip);
        layer.keyframes = [...(layer.keyframes ?? []), { id: createId("keyframe"), property: parameter, time: roundToFrame(localTime, this.state.fps), value: clone(value), easing }].sort((a, b) => a.time - b.time);
        clip.textLayer = layer;
      });
      return this.selectedClips;
    });
  }

  selectedCaptionClips() {
    return this.selectedClips.filter((clip) => clip.type === "caption");
  }

  setCaptionLayer(patch = {}) {
    return this.commit("caption:update", () => {
      this.selectedCaptionClips().forEach((clip) => {
        const current = normalizeCaptionLayer(clip.captionLayer, clip);
        clip.captionLayer = normalizeCaptionLayer({ ...current, ...patch }, clip);
        if (typeof patch.text === "string") {
          clip.name = patch.text.trim() || clip.name;
          clip.textLayer = normalizeTextLayer({ ...(clip.textLayer ?? {}), text: patch.text, kind: "caption" }, clip);
        }
      });
      return this.selectedCaptionClips();
    });
  }

  setCaptionTiming(start, duration) {
    return this.commit("caption:timing", () => {
      this.selectedCaptionClips().forEach((clip) => {
        syncClipAliases(clip);
        const nextStart = roundToFrame(clamp(Number(start), 0, this.state.duration), this.state.fps);
        const nextDuration = roundToFrame(clamp(Number(duration), 0.1, clip.originalDuration), this.state.fps);
        if (this.state.magnetic && this.hasInvalidOverlap(clip.id, clip.trackId, nextStart, nextDuration)) return;
        clip.timelineStart = nextStart;
        clip.start = nextStart;
        clip.duration = nextDuration;
        clip.sourceEnd = clamp(clip.sourceStart + nextDuration, clip.sourceStart + 0.1, clip.originalDuration);
        clip.out = clip.sourceEnd;
        clip.captionLayer = normalizeCaptionLayer(clip.captionLayer, clip);
      });
      return this.selectedCaptionClips();
    });
  }

  updateCaptionWord(wordId, patch = {}) {
    return this.commit("caption:word", () => {
      this.selectedCaptionClips().forEach((clip) => {
        const layer = normalizeCaptionLayer(clip.captionLayer, clip);
        layer.words = layer.words.map((word) => word.id === wordId ? { ...word, ...patch, end: Math.max(Number(patch.end ?? word.end), Number(patch.start ?? word.start) + 0.03) } : word);
        layer.text = layer.words.map((word) => word.text).join(" ");
        clip.captionLayer = normalizeCaptionLayer(layer, clip);
        clip.name = clip.captionLayer.text;
        clip.textLayer = normalizeTextLayer({ ...(clip.textLayer ?? {}), text: clip.captionLayer.text, kind: "caption" }, clip);
      });
      return this.selectedCaptionClips();
    });
  }

  applyCaptionTemplate(templateId) {
    const template = CAPTION_TEMPLATES[templateId] ?? CAPTION_TEMPLATES.glass;
    return this.commit("caption:template", () => {
      this.selectedCaptionClips().forEach((clip) => {
        const caption = normalizeCaptionLayer({ ...clip.captionLayer, animation: template.animation, templateId }, clip);
        clip.captionLayer = caption;
        clip.textLayer = normalizeTextLayer({ ...(clip.textLayer ?? {}), kind: "caption", style: { ...(clip.textLayer?.style ?? {}), ...template.style }, animation: template.animation, templateId }, clip);
      });
      return this.selectedCaptionClips();
    });
  }

  replaceCaptions(search, replacement) {
    const needle = String(search ?? "");
    if (!needle) return [];
    return this.commit("caption:replace", () => {
      const matcher = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      this.state.clips.filter((clip) => clip.type === "caption").forEach((clip) => {
        const layer = normalizeCaptionLayer(clip.captionLayer, clip);
        layer.text = layer.text.replace(matcher, replacement);
        layer.words = layer.words.map((word) => ({ ...word, text: word.text.replace(matcher, replacement) }));
        clip.captionLayer = normalizeCaptionLayer(layer, clip);
        clip.name = clip.captionLayer.text;
        clip.textLayer = normalizeTextLayer({ ...(clip.textLayer ?? {}), text: clip.captionLayer.text, kind: "caption" }, clip);
      });
      return this.state.clips.filter((clip) => clip.type === "caption");
    });
  }

  addCaptionTrack(name = "Captions") {
    return this.addTrack({ name, type: "video" });
  }

  exportCaptions(format = "srt") {
    return captionExport(this.state.clips, format);
  }

  addTextLayer(options = {}) {
    return this.commit("text:add", () => {
      const track = this.state.tracks.find((t) => t.type === "video") ?? this.state.tracks[0];
      if (!track) return null;
      const id = createId("clip");
      const start = roundToFrame(this.state.time, this.state.fps);
      const duration = roundToFrame(Math.max(0.5, Number(options.duration) || 3), this.state.fps);
      const text = String(options.text || "Text").substring(0, 200);
      const clip = {
        id,
        name: text,
        type: "text",
        trackId: track.id,
        source: null,
        sourceStart: 0,
        sourceEnd: duration,
        originalDuration: duration,
        timelineStart: start,
        start,
        duration,
        in: 0,
        out: duration,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        opacity: 1,
        volume: 0,
        muted: false,
        locked: false,
        transition: null,
        effects: [],
        textLayer: normalizeTextLayer({ text, kind: "title", animation: options.animation || "fade" }, {}),
        captionLayer: null,
      };
      track.clips.push(clip);
      this.state.clips.push(clip);
      this.selectedClips = [clip];
      this.emit("clip:added", clip);
      return clip;
    });
  }

  addCaptionLayer(text = "Caption", duration = 2) {
    return this.commit("caption:add", () => {
      let captionTrack = this.state.tracks.find((t) => t.name === "Captions");
      if (!captionTrack) captionTrack = this.addTrack({ name: "Captions", type: "video" });
      const id = createId("clip");
      const start = roundToFrame(this.state.time, this.state.fps);
      const dur = roundToFrame(Math.max(0.3, duration), this.state.fps);
      const captionText = String(text).substring(0, 500);
      const captionLayer = normalizeCaptionLayer({ text: captionText }, { duration: dur });
      const clip = {
        id,
        name: captionText,
        type: "caption",
        trackId: captionTrack.id,
        source: null,
        sourceStart: 0,
        sourceEnd: dur,
        originalDuration: dur,
        timelineStart: start,
        start,
        duration: dur,
        in: 0,
        out: dur,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        opacity: 1,
        volume: 0,
        muted: false,
        locked: false,
        transition: null,
        effects: [],
        textLayer: normalizeTextLayer({ text: captionText, kind: "caption", animation: "karaoke" }, {}),
        captionLayer,
      };
      captionTrack.clips.push(clip);
      this.state.clips.push(clip);
      this.selectedClips = [clip];
      this.emit("clip:added", clip);
      return clip;
    });
  }

  importCaptions(format = "srt", content = "") {
    if (!content || !content.trim()) return [];
    const segments = format === "vtt" ? parseVTT(content) : parseSRT(content);
    if (!segments.length) return [];
    return this.commit("caption:import", () => {
      let captionTrack = this.state.tracks.find((t) => t.name === "Captions");
      if (!captionTrack) captionTrack = this.addTrack({ name: "Captions", type: "video" });
      const imported = segments.map((seg) => {
        const id = createId("clip");
        const start = roundToFrame(seg.start, this.state.fps);
        const duration = roundToFrame(Math.max(0.1, seg.end - seg.start), this.state.fps);
        const captionLayer = normalizeCaptionLayer({ text: seg.text }, { duration });
        const clip = {
          id,
          name: seg.text.substring(0, 100),
          type: "caption",
          trackId: captionTrack.id,
          source: null,
          sourceStart: 0,
          sourceEnd: duration,
          originalDuration: duration,
          timelineStart: start,
          start,
          duration,
          in: 0,
          out: duration,
          trimStart: 0,
          trimEnd: 0,
          speed: 1,
          opacity: 1,
          volume: 0,
          muted: false,
          locked: false,
          transition: null,
          effects: [],
          textLayer: normalizeTextLayer({ text: seg.text, kind: "caption", animation: "karaoke" }, {}),
          captionLayer,
        };
        captionTrack.clips.push(clip);
        this.state.clips.push(clip);
        return clip;
      });
      return imported;
    });
  }

  splitCaption(clipId, time) {
    return this.commit("caption:split", () => {
      const clip = this.state.clips.find((c) => c.id === clipId && c.type === "caption");
      if (!clip) return null;
      const localTime = time - (clip.timelineStart ?? clip.start);
      if (localTime <= 0 || localTime >= clip.duration) return null;
      const layer = normalizeCaptionLayer(clip.captionLayer, clip);
      const wordsA = [];
      const wordsB = [];
      layer.words.forEach((word) => {
        const wordMid = (word.start + word.end) / 2;
        if (wordMid < localTime) wordsA.push(word);
        else wordsB.push(word);
      });
      const textA = wordsA.map((w) => w.text).join(" ") || layer.text.substring(0, Math.ceil(layer.text.length / 2));
      const textB = wordsB.map((w) => w.text).join(" ") || layer.text.substring(Math.floor(layer.text.length / 2));
      clip.duration = localTime;
      clip.sourceEnd = localTime;
      clip.out = localTime;
      clip.name = textA;
      clip.captionLayer = normalizeCaptionLayer({ ...layer, text: textA, words: wordsA }, clip);
      clip.textLayer = normalizeTextLayer({ ...(clip.textLayer ?? {}), text: textA }, clip);
      const remainingDuration = clip.originalDuration - localTime;
      const newClip = {
        ...clone(clip),
        id: createId("clip"),
        name: textB,
        timelineStart: (clip.timelineStart ?? clip.start) + localTime,
        start: (clip.start ?? clip.timelineStart) + localTime,
        originalDuration: remainingDuration,
        duration: remainingDuration,
        sourceStart: localTime,
        sourceEnd: clip.originalDuration,
        in: localTime,
        out: clip.originalDuration,
        trimStart: 0,
        trimEnd: 0,
        captionLayer: normalizeCaptionLayer({ ...layer, text: textB, words: wordsB }, { duration: remainingDuration }),
        textLayer: normalizeTextLayer({ ...(clip.textLayer ?? {}), text: textB }, {}),
      };
      const track = this.state.tracks.find((t) => t.id === clip.trackId);
      if (track) {
        const idx = track.clips.findIndex((c) => c.id === clipId);
        if (idx !== -1) track.clips.splice(idx + 1, 0, newClip);
      }
      this.state.clips.push(newClip);
      return { before: clip, after: newClip };
    });
  }

  mergeCaptions(clipIds = []) {
    if (clipIds.length < 2) return [];
    return this.commit("caption:merge", () => {
      const clips = clipIds
        .map((id) => this.state.clips.find((c) => c.id === id && c.type === "caption"))
        .filter(Boolean)
        .sort((a, b) => (a.timelineStart ?? a.start) - (b.timelineStart ?? b.start));
      if (clips.length < 2) return [];
      const first = clips[0];
      const last = clips[clips.length - 1];
      const mergedText = clips.map((c) => (c.captionLayer?.text ?? c.name)).join(" ");
      const mergedWords = clips.flatMap((c) => c.captionLayer?.words ?? []);
      const totalDuration = (last.timelineStart ?? last.start) + last.duration - (first.timelineStart ?? first.start);
      first.duration = totalDuration;
      first.sourceEnd = totalDuration;
      first.out = totalDuration;
      first.originalDuration = Math.max(first.originalDuration, totalDuration);
      first.name = mergedText.substring(0, 100);
      first.captionLayer = normalizeCaptionLayer({ text: mergedText, words: mergedWords }, first);
      first.textLayer = normalizeTextLayer({ ...(first.textLayer ?? {}), text: mergedText }, first);
      const firstTrack = this.state.tracks.find((t) => t.id === first.trackId);
      clips.slice(1).forEach((clip) => {
        if (firstTrack) firstTrack.clips = firstTrack.clips.filter((c) => c.id !== clip.id);
        this.state.clips = this.state.clips.filter((c) => c.id !== clip.id);
      });
      return [first];
    });
  }

  setCaptionGlobalStyle(style = {}) {
    return this.commit("caption:global-style", () => {
      this.state.clips.filter((c) => c.type === "caption").forEach((clip) => {
        clip.textLayer = normalizeTextLayer({ ...(clip.textLayer ?? {}), style: { ...(clip.textLayer?.style ?? {}), ...style } }, clip);
      });
      return this.state.clips.filter((c) => c.type === "caption");
    });
  }

  setAiCommand(command = "") {
    this.state.aiCommand = String(command);
    this.emit("ai:command", this.state.aiCommand);
  }

  updateAiTool(toolId, patch = {}) {
    return this.commit("ai:tool-update", () => {
      this.state.aiTools = createAiToolState(this.state.aiTools).map((tool) => tool.id === toolId ? { ...tool, ...patch, settings: { ...tool.settings, ...(patch.settings ?? {}) } } : tool);
      return this.state.aiTools.find((tool) => tool.id === toolId);
    });
  }

  runAiTool(toolId, instruction = this.state.aiCommand) {
    return this.commit("ai:tool-run", () => {
      let result;
      this.state.aiTools = createAiToolState(this.state.aiTools).map((tool) => {
        if (tool.id !== toolId) return tool;
        result = runAiToolLocally(tool, instruction);
        return result;
      });
      if (result) this.state.aiQueue = [{ toolId, name: result.name, status: "Done", at: result.lastRunAt, result: result.result }, ...(this.state.aiQueue ?? [])].slice(0, 12);
      return result;
    });
  }

  setAiToolProcessing(toolId, progress = 0) {
    this.state.aiTools = createAiToolState(this.state.aiTools).map((tool) => tool.id === toolId ? { ...tool, status: "Processing", progress } : tool);
    this.emit("ai:processing", this.state.aiTools.find((tool) => tool.id === toolId));
  }

  clearAiQueue() {
    return this.commit("ai:queue-clear", () => {
      this.state.aiQueue = [];
      return this.state.aiQueue;
    });
  }

  registerPlugin(manifest = {}) {
    return this.commit("plugin:register", () => {
      this.state.plugins = registerPlugin(this.state.plugins ?? createPluginState(), manifest);
      return this.state.plugins.registry.find((plugin) => plugin.id === manifest.id);
    });
  }

  installMarketplacePlugin(pluginId) {
    return this.commit("plugin:install", () => {
      this.state.plugins = installMarketplacePlugin(this.state.plugins ?? createPluginState(), pluginId);
      return this.state.plugins.registry.find((plugin) => plugin.id === pluginId);
    });
  }

  loadPlugin(pluginId) {
    return this.commit("plugin:load", () => {
      this.state.plugins = loadPlugin(this.state.plugins ?? createPluginState(), pluginId);
      return this.state.plugins.registry.find((plugin) => plugin.id === pluginId);
    });
  }

  disablePlugin(pluginId) {
    return this.commit("plugin:disable", () => {
      this.state.plugins = disablePlugin(this.state.plugins ?? createPluginState(), pluginId);
      return this.state.plugins.registry.find((plugin) => plugin.id === pluginId);
    });
  }

  updatePluginSettings(pluginId, patch = {}) {
    return this.commit("plugin:settings", () => {
      this.state.plugins = updatePluginSettings(this.state.plugins ?? createPluginState(), pluginId, patch);
      return this.state.plugins.registry.find((plugin) => plugin.id === pluginId);
    });
  }

  updatePluginPermissions(pluginId, permissions = []) {
    return this.commit("plugin:permissions", () => {
      this.state.plugins = updatePluginPermissions(this.state.plugins ?? createPluginState(), pluginId, permissions);
      return this.state.plugins.registry.find((plugin) => plugin.id === pluginId);
    });
  }

  estimateExport(settings = {}) {
    const normalized = normalizeExportSettings({ ...settings, duration: settings.duration ?? this.state.duration });
    return { settings: normalized, sizeEstimateMb: estimateExportSize(normalized), validation: validateExportSettings(normalized) };
  }

  queueExport(settings = {}, projectName = "Untitled Campaign") {
    return this.commit("export:queue", () => {
      const job = createExportJob({ ...settings, duration: settings.duration ?? this.state.duration }, projectName);
      this.state.exportQueue = [job, ...(this.state.exportQueue ?? [])];
      this.state.renderHistory = [{ jobId: job.id, name: job.name, status: job.status, at: job.createdAt, error: job.error }, ...(this.state.renderHistory ?? [])].slice(0, 30);
      return job;
    });
  }

  updateExportProgress(jobId, progress, status = "rendering") {
    this.state.exportQueue = (this.state.exportQueue ?? []).map((job) => job.id === jobId ? updateExportJob(job, { progress: Math.max(0, Math.min(100, Number(progress))), status }) : job);
    this.emit("export:progress", this.state.exportQueue.find((job) => job.id === jobId));
  }

  completeExport(jobId) {
    return this.commit("export:complete", () => {
      let completed;
      this.state.exportQueue = (this.state.exportQueue ?? []).map((job) => {
        if (job.id !== jobId) return job;
        completed = updateExportJob(job, { progress: 100, status: "completed", error: null });
        return completed;
      });
      if (completed) {
        this.state.recentExports = [completed, ...(this.state.recentExports ?? [])].slice(0, 10);
        this.state.renderHistory = [{ jobId, name: completed.name, status: "completed", at: completed.updatedAt, error: null }, ...(this.state.renderHistory ?? [])].slice(0, 30);
      }
      return completed;
    });
  }

  cancelExport(jobId) {
    return this.commit("export:cancel", () => {
      let cancelled;
      this.state.exportQueue = (this.state.exportQueue ?? []).map((job) => {
        if (job.id !== jobId) return job;
        cancelled = updateExportJob(job, { status: "cancelled", error: "Cancelled by user" });
        return cancelled;
      });
      if (cancelled) this.state.renderHistory = [{ jobId, name: cancelled.name, status: "cancelled", at: cancelled.updatedAt, error: cancelled.error }, ...(this.state.renderHistory ?? [])].slice(0, 30);
      return cancelled;
    });
  }

  failExport(jobId, error = "Render failed") {
    return this.commit("export:error", () => {
      let failed;
      this.state.exportQueue = (this.state.exportQueue ?? []).map((job) => {
        if (job.id !== jobId) return job;
        failed = updateExportJob(job, { status: "error", error });
        return failed;
      });
      if (failed) this.state.renderHistory = [{ jobId, name: failed.name, status: "error", at: failed.updatedAt, error }, ...(this.state.renderHistory ?? [])].slice(0, 30);
      if (failed) this.logError(error, { source: "render", severity: "error", userMessage: "Render failed. The export job was kept in history.", details: { jobId } });
      return failed;
    });
  }

  undo() {
    const item = this.state.history.pop();
    if (!item) {
      this.logError("No undo history available", { source: "undo", severity: "info", userMessage: "Nothing to undo." });
      return;
    }
    try {
      this.state.errors = createRecoveryPoint(this.state.errors ?? createErrorState(), this.snapshot(), "pre-undo");
      this.state.future.push({ ...item, after: this.snapshot() });
      if (this.state.future.length > 200) this.state.future.splice(0, this.state.future.length - 200);
      this.restore(item.before, "history:undo");
    } catch (error) {
      this.logError(error, { source: "undo", severity: "error", userMessage: "Undo failed, so the current state was preserved." });
    }
  }

  redo() {
    const item = this.state.future.pop();
    if (!item) {
      this.logError("No redo history available", { source: "undo", severity: "info", userMessage: "Nothing to redo." });
      return;
    }
    try {
      this.state.errors = createRecoveryPoint(this.state.errors ?? createErrorState(), this.snapshot(), "pre-redo");
      this.state.history.push(item);
      this.restore(item.after, "history:redo");
    } catch (error) {
      this.logError(error, { source: "undo", severity: "error", userMessage: "Redo failed, so the current state was preserved." });
    }
  }

  previewFrame() {
    const visibleTracks = new Set(this.state.tracks.filter((track) => track.visible).map((track) => track.id));
    const trackOrder = new Map(this.state.tracks.map((track) => [track.id, track.order ?? 0]));
    return this.state.clips
      .filter((clip) => visibleTracks.has(clip.trackId))
      .filter((clip) => this.state.time >= clip.start && this.state.time <= clip.start + clip.duration)
      .sort((a, b) => ((trackOrder.get(a.trackId) ?? 0) - (trackOrder.get(b.trackId) ?? 0)) || ((a.layer ?? 0) - (b.layer ?? 0)));
  }

  localClipTime(clip, time = this.state.time) {
    const raw = clamp(time - clip.start, 0, clip.duration);
    const sourceTime = clip.reversed ? clip.duration - raw : raw;
    const frozen = (clip.freezeFrames ?? []).find((item) => Math.abs(item - time) < 1 / this.state.fps);
    return roundToFrame((frozen ?? sourceTime) * (clip.speed || 1) + (clip.in ?? 0), this.state.fps);
  }

  renderFrame(time = this.state.time) {
    const frameTime = roundToFrame(clamp(time, 0, this.state.duration), this.state.fps);
    const tracksById = new Map(this.state.tracks.map((track) => [track.id, track]));
    const visibleTrackIds = new Set(this.state.tracks.filter((track) => track.visible !== false).map((track) => track.id));
    const hasSolo = this.state.clips.some((clip) => clip.solo && !clip.hidden);
    const activeClips = this.state.clips.filter((clip) => visibleTrackIds.has(clip.trackId) && !clip.hidden && (!hasSolo || clip.solo) && frameTime >= clip.start && frameTime <= clip.start + clip.duration);
    const soloAudioTracks = this.state.tracks.filter((track) => track.type === "audio" && track.solo).map((track) => track.id);
    const soloAudioClips = this.state.clips.filter((clip) => clip.audio?.solo).map((clip) => clip.id);
    const layers = [];
    const audio = [];

    activeClips.forEach((clip) => {
      const track = tracksById.get(clip.trackId);
      if (!track) return;
      const localTime = this.localClipTime(clip, frameTime);
      const animation = evaluateClipAnimation(clip, localTime);
      const colorGrade = evaluateColorGrade(clip, localTime);
      if (track.type === "audio" || clip.type === "audio") {
        const mutedBySolo = soloAudioTracks.length > 0 && !soloAudioTracks.includes(track.id);
        const mutedByClipSolo = soloAudioClips.length > 0 && !soloAudioClips.includes(clip.id);
        const clipAudio = normalizeAudioMix(clip.audio);
        const mix = evaluateAudioMix({ ...clipAudio, volume: animation.volume ?? clipAudio.volume }, localTime, clip.duration);
        audio.push({
          clipId: clip.id,
          trackId: clip.trackId,
          localTime: roundToFrame(localTime + (clipAudio.syncOffset ?? 0), this.state.fps),
          volume: track.muted || clipAudio.muted || mutedBySolo || mutedByClipSolo ? 0 : mix.volume,
          pan: mix.pan,
          noiseReduction: mix.noiseReduction,
          voiceEnhance: mix.voiceEnhance,
          eq: mix.eq,
          compressor: mix.compressor,
          limiter: mix.limiter,
          gainReduction: mix.gainReduction,
          peak: mix.peak,
          waveform: clipAudio.waveform?.length ? clipAudio.waveform : createWaveform(clip.start + clip.duration),
          muted: Boolean(track.muted || clipAudio.muted || mutedBySolo || mutedByClipSolo),
          fadeIn: clipAudio.fadeIn ?? 0,
          fadeOut: clipAudio.fadeOut ?? 0,
        });
        return;
      }
      const evaluatedEffects = (clip.effects ?? []).map((effect) => evaluateEffect(effect, localTime));
      const textLayer = isTextClipType(clip.type) ? evaluateTextLayer(clip, localTime) : null;
      const captionLayer = clip.type === "caption" ? normalizeCaptionLayer(clip.captionLayer, clip) : null;
      const hasBlurEffect = evaluatedEffects.some((effect) => effect.type === "blur");
      const renderEffects = [
        ...evaluatedEffects.map((effect) => effect.type === "blur"
          ? { ...effect, parameters: { ...effect.parameters, radius: Math.max(Number(effect.parameters.radius ?? 0), Number(animation.blur ?? 0)) } }
          : effect),
        ...(hasBlurEffect ? [] : [{ id: "evaluated_blur", type: "blur", enabled: true, order: 999, parameters: { radius: animation.blur ?? 0 }, keyframes: [] }]),
      ].sort((a, b) => a.order - b.order);
      layers.push({
        clipId: clip.id,
        trackId: clip.trackId,
        type: clip.type,
        start: clip.start,
        localTime,
        layer: clip.layer ?? track.order,
        transform: this.normalizeTransform({ ...DEFAULT_TRANSFORM, ...(clip.transform ?? {}), x: animation.position?.x ?? clip.transform?.x ?? 0, y: animation.position?.y ?? clip.transform?.y ?? 0, scale: animation.scale, rotate: animation.rotation, crop: animation.crop }),
        opacity: animation.opacity ?? clip.opacity ?? 1,
        blendMode: clip.blendMode ?? "normal",
        effects: renderEffects,
        effectPreview: effectCssVariables(renderEffects),
        colorGrade,
        colorPreview: colorGradePreviewVariables(colorGrade),
        textLayer,
        textPreview: textLayer ? textPreviewVariables(textLayer) : null,
        captionLayer,
        captionPreview: captionLayer ? { ...captionLayer, words: activeCaptionWords(captionLayer, localTime) } : null,
        transitions: clip.transitions ?? [],
        activeTransitions: (clip.transitions ?? []).map((transition) => evaluateTransition(clip, normalizeTransition(transition), frameTime)).filter(Boolean),
      });
    });

    return {
      time: frameTime,
      frame: Math.round(frameTime * this.state.fps),
      layers: layers.sort((a, b) => a.layer - b.layer),
      audio,
      audioMix: mixAudioLayers(audio),
      gpuHints: { transformOnly: true, preferCompositor: true, canvasZoom: this.state.canvasZoom, willChange: ["transform", "opacity", "filter"], motionBlur: layers.some((layer) => Number(layer.transform?.motionBlur ?? 0) > 0) },
    };
  }

  getStorageEngine() {
    return this.state.storage;
  }

  setStorageEngine(storageEngine) {
    this.state.storage = storageEngine;
  }

  async getStorageInfo() {
    return this.state.storage?.getStorageInfo() ?? { local: { bytes: 0, keys: 0, estimated: 0 }, quota: { usage: 0, quota: 0, percent: 0 }, limitMB: 12, percentUsed: 0, isOverLimit: false };
  }

  async cleanupStorage() {
    return this.state.storage?.cleanup() ?? { freedBytes: 0, tempRemoved: 0, cacheEvicted: false, isStillOverLimit: false };
  }

  async getStorageStats() {
    return this.state.storage?.getStats() ?? {};
  }

  listCloudProviders() {
    return this.state.storage?.listCloudProviders() ?? [];
  }

  setActiveCloudProvider(providerId) {
    this.state.storage?.setActiveCloudProvider(providerId);
  }

  connectCloudProvider(providerId, config) {
    return this.state.storage?.connectCloudProvider(providerId, config) ?? false;
  }

  disconnectCloudProvider(providerId) {
    return this.state.storage?.disconnectCloudProvider(providerId) ?? false;
  }
}
