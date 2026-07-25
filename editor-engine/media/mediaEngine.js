import { createEngineModule } from "../utils/createEngineModule.js";
import { createId } from "../types/editorTypes.js";
import { cacheThumbnail, createAsset, createAssetManagerState, filterAssets, inferMediaMetadata, mediaTypeFromMime, stripExtension } from "./assetManager.js";

function fileToInput(file = {}, options = {}) {
  const type = mediaTypeFromMime(file.type, file.name);
  const metadata = inferMediaMetadata({
    name: file.name,
    type,
    mimeType: file.type,
    size: file.size,
    duration: options.duration,
  });
  return {
    name: stripExtension(file.name),
    type,
    folder: options.folder ?? "Recent Uploads",
    tags: [...new Set(["upload", type.toLowerCase(), ...(options.tags ?? [])])],
    duration: metadata.duration,
    recent: true,
    source: "local",
    sourceUrl: options.sourceUrl ?? null,
    mimeType: file.type ?? null,
    fileSize: metadata.fileSize,
    resolution: metadata.resolution,
    codec: metadata.codec,
    fps: metadata.fps,
    aspectRatio: metadata.aspectRatio,
    sampleRate: metadata.sampleRate,
    channels: metadata.channels,
    metadata,
  };
}

function createThumbnail(asset) {
  const initials = asset.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || asset.type.slice(0, 2).toUpperCase();
  return {
    id: createId("thumb"),
    assetId: asset.id,
    key: asset.thumbnailKey,
    label: initials,
    tone: asset.type.toLowerCase(),
    status: "ready",
    posterTime: asset.type === "Video" ? Math.min(2, Math.max(0, asset.duration / 4)) : 0,
    generatedAt: new Date().toISOString(),
  };
}

function createProxy(asset, options = {}) {
  if (asset.type !== "Video") return null;
  const scale = Number(options.scale ?? (asset.resolution?.startsWith("3840") ? 0.5 : 0.75));
  return {
    id: createId("proxy"),
    assetId: asset.id,
    status: "ready",
    codec: options.codec ?? "h264-preview",
    scale,
    duration: asset.duration,
    resolution: asset.aspectRatio === "9:16" ? "540 x 960" : "960 x 540",
    createdAt: new Date().toISOString(),
  };
}

export function createMediaEngine(initialState = {}) {
  const module = createEngineModule({
    name: "mediaEngine",
    domain: "media",
    responsibilities: [
      "local media uploads",
      "asset indexing",
      "folder management",
      "search and sorting",
      "thumbnail generation",
      "proxy media tracking",
      "metadata normalization",
      "media cache management",
      "drag payload creation",
    ],
    state: {
      ...createAssetManagerState(initialState.assets ?? []),
      ...initialState,
      assets: (initialState.assets ?? []).map(createAsset),
      folders: [...new Set([...(createAssetManagerState().folders), ...(initialState.folders ?? [])])],
      selectedAssetIds: [...(initialState.selectedAssetIds ?? [])],
      thumbnailCache: { ...(initialState.thumbnailCache ?? {}) },
      mediaCache: { ...(initialState.mediaCache ?? {}) },
      uploadQueue: [...(initialState.uploadQueue ?? [])],
      proxyQueue: [...(initialState.proxyQueue ?? [])],
      filter: { ...createAssetManagerState().filter, ...(initialState.filter ?? {}) },
    },
  });

  return {
    ...module,
    importFiles(files = [], options = {}) {
      const list = [...files];
      const batchId = createId("upload_batch");
      const queueItems = list.map((file) => ({
        id: createId("upload"),
        batchId,
        name: file.name,
        type: mediaTypeFromMime(file.type, file.name),
        bytesTotal: Number(file.size ?? 0),
        bytesLoaded: 0,
        progress: 0,
        status: "queued",
        createdAt: new Date().toISOString(),
      }));
      this.state.uploadQueue = [...queueItems, ...this.state.uploadQueue];
      this.emit("media:upload-queued", queueItems);
      const assets = queueItems.map((item, index) => {
        item.status = "processing";
        item.bytesLoaded = item.bytesTotal;
        item.progress = 100;
        const asset = this.addAsset(fileToInput(list[index], options), { generateProxy: options.generateProxy !== false });
        item.assetId = asset.id;
        item.status = "complete";
        return asset;
      });
      this.emit("media:upload-complete", { batchId, assets, queueItems });
      return assets;
    },
    addAsset(input = {}, options = {}) {
      const asset = createAsset(input);
      this.state.assets = [asset, ...this.state.assets.filter((item) => item.id !== asset.id)];
      if (!this.state.folders.includes(asset.folder)) this.state.folders.push(asset.folder);
      const thumbnail = this.generateThumbnail(asset.id);
      asset.thumbnail = thumbnail;
      asset.thumbnailStatus = thumbnail.status;
      if (options.generateProxy !== false && asset.type === "Video") asset.proxy = this.generateProxy(asset.id);
      this.cacheAsset(asset.id, { kind: "metadata", value: asset.metadata });
      this.emit("media:asset-add", asset);
      return asset;
    },
    updateAsset(assetId, patch = {}) {
      let updated = null;
      this.state.assets = this.state.assets.map((asset) => {
        if (asset.id !== assetId) return asset;
        updated = createAsset({ ...asset, ...patch, updatedAt: new Date().toISOString() });
        return updated;
      });
      if (updated) this.emit("media:asset-update", updated);
      return updated;
    },
    deleteAssets(assetIds = this.state.selectedAssetIds) {
      const selected = new Set(assetIds);
      this.state.assets = this.state.assets.filter((asset) => !selected.has(asset.id));
      this.state.selectedAssetIds = this.state.selectedAssetIds.filter((id) => !selected.has(id));
      selected.forEach((id) => {
        delete this.state.thumbnailCache[id];
        delete this.state.mediaCache[id];
      });
      this.emit("media:asset-delete", [...selected]);
      return [...selected];
    },
    createFolder(name) {
      const clean = String(name ?? "").trim();
      if (!clean) return null;
      if (!this.state.folders.includes(clean)) this.state.folders.push(clean);
      this.emit("media:folder-create", clean);
      return clean;
    },
    moveAssetsToFolder(assetIds = this.state.selectedAssetIds, folder = "Project Media") {
      this.createFolder(folder);
      const selected = new Set(assetIds);
      this.state.assets = this.state.assets.map((asset) => selected.has(asset.id) ? { ...asset, folder, updatedAt: new Date().toISOString() } : asset);
      this.emit("media:folder-move", { assetIds: [...selected], folder });
      return [...selected];
    },
    selectAsset(assetId, { additive = false, range = false } = {}) {
      const ids = this.state.assets.map((asset) => asset.id);
      if (range && this.state.selectedAssetIds.length) {
        const last = ids.indexOf(this.state.selectedAssetIds.at(-1));
        const next = ids.indexOf(assetId);
        this.state.selectedAssetIds = ids.slice(Math.min(last, next), Math.max(last, next) + 1);
      } else if (additive) {
        this.state.selectedAssetIds = this.state.selectedAssetIds.includes(assetId)
          ? this.state.selectedAssetIds.filter((id) => id !== assetId)
          : [...this.state.selectedAssetIds, assetId];
      } else {
        this.state.selectedAssetIds = [assetId];
      }
      this.emit("media:selection", this.state.selectedAssetIds);
      return this.state.selectedAssetIds;
    },
    setFilter(patch = {}) {
      this.state.filter = { ...this.state.filter, ...patch };
      this.emit("media:filter", this.state.filter);
      return this.state.filter;
    },
    search(query = "", patch = {}) {
      return filterAssets(this.state, { ...this.state.filter, ...patch, query });
    },
    sortedAssets(patch = {}) {
      return filterAssets(this.state, { ...this.state.filter, ...patch });
    },
    generateThumbnail(assetId) {
      const asset = this.state.assets.find((item) => item.id === assetId) ?? assetId;
      if (!asset?.id) return null;
      const thumbnail = createThumbnail(asset);
      this.state.thumbnailCache = cacheThumbnail(this.state, asset.id, thumbnail);
      this.emit("media:thumbnail", thumbnail);
      return thumbnail;
    },
    generateProxy(assetId, options = {}) {
      const asset = this.state.assets.find((item) => item.id === assetId);
      const proxy = createProxy(asset, options);
      if (!proxy) return null;
      this.state.proxyQueue = [proxy, ...this.state.proxyQueue.filter((item) => item.assetId !== assetId)];
      this.emit("media:proxy", proxy);
      return proxy;
    },
    cacheAsset(assetId, entry) {
      const cacheEntry = {
        id: createId("cache"),
        assetId,
        kind: entry.kind ?? "metadata",
        value: entry.value ?? entry,
        bytes: Number(entry.bytes ?? 0),
        createdAt: new Date().toISOString(),
      };
      this.state.mediaCache[assetId] = [...(this.state.mediaCache[assetId] ?? []), cacheEntry];
      this.emit("media:cache", cacheEntry);
      return cacheEntry;
    },
    clearCache(assetId = null) {
      if (assetId) delete this.state.mediaCache[assetId];
      else this.state.mediaCache = {};
      this.emit("media:cache-clear", assetId);
    },
    dragPayload(assetIds = this.state.selectedAssetIds) {
      return assetIds.map((id) => this.state.assets.find((asset) => asset.id === id)).filter(Boolean).map((asset) => ({
        assetId: asset.id,
        mediaId: asset.id,
        name: asset.name,
        mediaType: asset.type,
        type: asset.type === "Audio" ? "audio" : asset.type === "Image" ? "image" : "video",
        duration: asset.duration || (asset.type === "Image" ? 5 : 8),
        originalDuration: asset.duration || (asset.type === "Image" ? 5 : 8),
        sourceStart: 0,
        sourceEnd: asset.duration || (asset.type === "Image" ? 5 : 8),
        metadata: asset.metadata,
        proxy: asset.proxy,
      }));
    },
  };
}
