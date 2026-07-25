import assert from "node:assert/strict";
import { createMediaEngine, filterAssets, inferMediaMetadata, mediaTypeFromMime } from "../index.js";

const engine = createMediaEngine();
const files = [
  { name: "Launch Reel.mp4", type: "video/mp4", size: 24 * 1024 * 1024 },
  { name: "Voice Clean.wav", type: "audio/wav", size: 8 * 1024 * 1024 },
  { name: "Hero Still.png", type: "image/png", size: 3 * 1024 * 1024 },
];

assert.equal(mediaTypeFromMime("video/mp4", "clip.mp4"), "Video");
assert.equal(mediaTypeFromMime("", "cover.webp"), "Image");
assert.equal(inferMediaMetadata({ name: "Voice Clean.wav", type: "Audio", size: 1024 }).codec, "PCM");

const assets = engine.importFiles(files, { folder: "Recent Uploads", tags: ["campaign"] });
assert.equal(assets.length, 3);
assert.equal(engine.state.uploadQueue.every((item) => item.status === "complete"), true);
assert.equal(engine.state.assets.length, 3);

const video = assets.find((asset) => asset.type === "Video");
const audio = assets.find((asset) => asset.type === "Audio");
const image = assets.find((asset) => asset.type === "Image");

assert.ok(video.proxy);
assert.equal(video.proxy.status, "ready");
assert.ok(engine.state.proxyQueue.find((proxy) => proxy.assetId === video.id));
assert.equal(audio.sampleRate, "48 kHz");
assert.equal(image.codec, "PNG");
assert.ok(engine.state.thumbnailCache[video.id]);
assert.ok(engine.state.mediaCache[video.id].some((entry) => entry.kind === "metadata"));

engine.createFolder("Campaign Selects");
engine.selectAsset(video.id);
engine.selectAsset(audio.id, { additive: true });
engine.moveAssetsToFolder(engine.state.selectedAssetIds, "Campaign Selects");
assert.equal(engine.state.assets.find((asset) => asset.id === video.id).folder, "Campaign Selects");
assert.ok(engine.state.folders.includes("Campaign Selects"));

engine.setFilter({ type: "Video", folder: "Campaign Selects", query: "launch", sort: "duration" });
assert.deepEqual(engine.sortedAssets().map((asset) => asset.id), [video.id]);

engine.setFilter({ type: "All", folder: "All", query: "", sort: "size" });
const sortedBySize = filterAssets(engine.state, engine.state.filter);
assert.equal(sortedBySize[0].fileSize >= sortedBySize.at(-1).fileSize, true);

const payload = engine.dragPayload([video.id, image.id]);
assert.equal(payload[0].type, "video");
assert.equal(payload[1].type, "image");
assert.equal(payload[0].sourceStart, 0);
assert.equal(payload[0].sourceEnd, video.duration);

engine.cacheAsset(video.id, { kind: "thumbnail-bitmap", value: { ready: true }, bytes: 2048 });
assert.ok(engine.state.mediaCache[video.id].some((entry) => entry.kind === "thumbnail-bitmap"));
engine.clearCache(video.id);
assert.equal(engine.state.mediaCache[video.id], undefined);

engine.deleteAssets([audio.id]);
assert.equal(engine.state.assets.some((asset) => asset.id === audio.id), false);

console.log("mediaEngine tests passed");
