import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";

const editor = new EditorCore({ fps: 30, duration: 60 });

const image = editor.addAsset({ name: "Hero Still", type: "Image", folder: "Project Media", tags: ["hero"], duration: 0 });
const audio = editor.addAsset({ name: "Dialogue Stem Unique", type: "Audio", folder: "Audio", tags: ["voice"], duration: 44 });

assert.ok(editor.state.assetManager.assets.find((asset) => asset.id === image.id));
assert.ok(editor.state.assetManager.thumbnailCache[image.id]);

editor.selectAsset(image.id);
editor.selectAsset(audio.id, { additive: true });
assert.deepEqual(editor.state.assetManager.selectedAssetIds, [image.id, audio.id]);

editor.toggleAssetFavorite([image.id]);
assert.equal(editor.state.assetManager.assets.find((asset) => asset.id === image.id).favorite, true);

editor.tagAssets([audio.id], "dialogue");
assert.ok(editor.state.assetManager.assets.find((asset) => asset.id === audio.id).tags.includes("dialogue"));

editor.moveAssetsToFolder([image.id], "Favorites");
assert.equal(editor.state.assetManager.assets.find((asset) => asset.id === image.id).folder, "Favorites");
assert.ok(editor.state.assetManager.folders.includes("Favorites"));

editor.setAssetFilter({ type: "Audio", query: "unique", sort: "duration" });
assert.equal(editor.filteredAssets()[0].id, audio.id);

editor.deleteAssets([audio.id]);
assert.equal(editor.state.assetManager.assets.some((asset) => asset.id === audio.id), false);
