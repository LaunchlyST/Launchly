import { createId } from "../types/editorTypes.js";

export const ASSET_TYPES = Object.freeze(["Image", "Video", "Audio"]);
export const DEFAULT_MEDIA_FOLDERS = Object.freeze(["Project Media", "Stock Library", "AI Generated", "Recent Uploads"]);

export function mediaTypeFromMime(mimeType = "", fallbackName = "") {
  const type = String(mimeType).toLowerCase();
  const name = String(fallbackName).toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|svg)$/.test(name)) return "Image";
  if (type.startsWith("audio/") || /\.(mp3|wav|aac|m4a|flac|ogg)$/.test(name)) return "Audio";
  if (type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi|m4v)$/.test(name)) return "Video";
  return "Video";
}

export function extensionFromName(name = "") {
  return String(name).split(".").pop()?.toLowerCase() || "";
}

export function stripExtension(name = "Untitled asset") {
  return String(name || "Untitled asset").replace(/\.[^.]+$/, "") || "Untitled asset";
}

export function deterministicMediaNumber(seed, min, max) {
  const text = String(seed || "asset");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 33 + text.charCodeAt(index)) % 104729;
  return min + (hash % (max - min + 1));
}

export function inferMediaMetadata(input = {}) {
  const type = ASSET_TYPES.includes(input.type ?? input.mediaType) ? input.type ?? input.mediaType : mediaTypeFromMime(input.mimeType, input.name);
  const extension = input.extension ?? extensionFromName(input.name);
  const sizeMb = Number(input.fileSize ?? input.size ?? 0) / (input.size && !input.fileSize ? 1024 * 1024 : 1);
  if (type === "Audio") {
    const duration = Number(input.duration ?? Math.max(8, deterministicMediaNumber(input.name, 28, 180)));
    return {
      duration,
      resolution: "Audio only",
      codec: input.codec ?? (extension === "wav" ? "PCM" : extension === "flac" ? "FLAC" : "AAC"),
      fps: null,
      aspectRatio: "Waveform",
      fileSize: Number(input.fileSize ?? Math.max(0.4, Math.round(sizeMb * 10) / 10)),
      sampleRate: input.sampleRate ?? "48 kHz",
      channels: input.channels ?? "Stereo",
    };
  }
  if (type === "Image") {
    const square = /logo|avatar|icon|square/i.test(input.name ?? "");
    return {
      duration: Number(input.duration ?? 0),
      resolution: input.resolution ?? (square ? "3000 x 3000" : `${deterministicMediaNumber(input.name, 2400, 4600)} x ${deterministicMediaNumber(`${input.name}:h`, 1350, 2600)}`),
      codec: input.codec ?? (extension === "png" ? "PNG" : extension === "webp" ? "WEBP" : "JPEG"),
      fps: null,
      aspectRatio: input.aspectRatio ?? (square ? "1:1" : "16:9"),
      fileSize: Number(input.fileSize ?? Math.max(0.2, Math.round(sizeMb * 10) / 10)),
      sampleRate: null,
      channels: null,
    };
  }
  const vertical = /reel|story|short|tiktok|vertical/i.test(input.name ?? "") || input.tags?.includes("vertical");
  const duration = Number(input.duration ?? Math.max(4, deterministicMediaNumber(input.name, 8, 120)));
  return {
    duration,
    resolution: input.resolution ?? (vertical ? "1080 x 1920" : deterministicMediaNumber(input.name, 0, 1) ? "3840 x 2160" : "1920 x 1080"),
    codec: input.codec ?? (extension === "mov" ? "ProRes" : extension === "webm" ? "VP9" : "H.264"),
    fps: Number(input.fps ?? deterministicMediaNumber(input.name, 0, 1) ? 30 : 24),
    aspectRatio: input.aspectRatio ?? (vertical ? "9:16" : "16:9"),
    fileSize: Number(input.fileSize ?? Math.max(1, Math.round(sizeMb * 10) / 10 || Math.round(duration * 7.5))),
    sampleRate: null,
    channels: null,
  };
}

export function createAsset(input = {}) {
  const type = ASSET_TYPES.includes(input.type ?? input.mediaType) ? input.type ?? input.mediaType : mediaTypeFromMime(input.mimeType, input.name);
  const now = new Date().toISOString();
  const name = stripExtension(input.name ?? "Untitled asset");
  const metadata = inferMediaMetadata({ ...input, type, name });
  return {
    id: input.id ?? createId("asset"),
    name,
    type,
    folder: input.folder ?? "Project Media",
    tags: [...(input.tags ?? [])],
    favorite: Boolean(input.favorite ?? false),
    duration: Number(input.duration ?? metadata.duration),
    usageCount: Number(input.usageCount ?? 0),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    recent: Boolean(input.recent ?? true),
    source: input.source ?? "local",
    sourceUrl: input.sourceUrl ?? null,
    mimeType: input.mimeType ?? null,
    extension: input.extension ?? extensionFromName(input.name),
    thumbnailKey: input.thumbnailKey ?? `thumb:${name.toLowerCase().replace(/\W+/g, "-")}`,
    thumbnailStatus: input.thumbnailStatus ?? "lazy",
    thumbnail: input.thumbnail ?? null,
    resolution: input.resolution ?? metadata.resolution,
    codec: input.codec ?? metadata.codec,
    fps: input.fps ?? metadata.fps,
    aspectRatio: input.aspectRatio ?? metadata.aspectRatio,
    fileSize: Number(input.fileSize ?? metadata.fileSize ?? 0),
    sampleRate: input.sampleRate ?? metadata.sampleRate,
    channels: input.channels ?? metadata.channels,
    proxy: input.proxy ?? null,
    cacheKeys: [...(input.cacheKeys ?? [])],
    metadata: { ...metadata, ...(input.metadata ?? {}) },
  };
}

export function createAssetManagerState(assets = []) {
  return {
    assets: assets.map(createAsset),
    folders: [...DEFAULT_MEDIA_FOLDERS],
    selectedAssetIds: [],
    thumbnailCache: {},
    mediaCache: {},
    uploadQueue: [],
    proxyQueue: [],
    filter: { type: "All", folder: "All", tag: "All", favoritesOnly: false, query: "", sort: "name" },
  };
}

export function filterAssets(state, filter = state.filter) {
  const query = (filter.query ?? "").toLowerCase();
  return [...state.assets]
    .filter((asset) => filter.type === "All" || asset.type === filter.type)
    .filter((asset) => filter.folder === "All" || asset.folder === filter.folder)
    .filter((asset) => filter.tag === "All" || asset.tags.includes(filter.tag))
    .filter((asset) => !filter.favoritesOnly || asset.favorite)
    .filter((asset) => !query || [asset.name, asset.type, asset.folder, asset.tags.join(" "), asset.codec, asset.resolution, asset.aspectRatio].join(" ").toLowerCase().includes(query))
    .sort((a, b) => {
      if (filter.sort === "date") return new Date(b.updatedAt) - new Date(a.updatedAt);
      if (filter.sort === "duration") return b.duration - a.duration;
      if (filter.sort === "size") return b.fileSize - a.fileSize;
      if (filter.sort === "type") return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
}

export function cacheThumbnail(state, assetId, thumbnail) {
  return { ...state.thumbnailCache, [assetId]: { ...thumbnail, cachedAt: new Date().toISOString() } };
}
