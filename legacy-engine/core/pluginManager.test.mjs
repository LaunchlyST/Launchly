import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";
import { PLUGIN_PERMISSIONS, createPluginState, normalizePluginManifest } from "../plugins/pluginManager.js";

const editor = new EditorCore({ fps: 30, duration: 60 });

assert.ok(PLUGIN_PERMISSIONS.includes("timeline:read"));
assert.equal(editor.state.plugins.marketplace.length >= 3, true);

const manifest = normalizePluginManifest({
  id: "test-waveform-tools",
  name: "Waveform Tools",
  permissions: ["timeline:read", "storage:write", "unknown:permission"],
  settingsSchema: { density: { type: "number", default: 48 } },
});

assert.deepEqual(manifest.permissions, ["timeline:read", "storage:write"]);
assert.equal(manifest.defaultSettings.density, 48);

editor.registerPlugin(manifest);
assert.equal(editor.state.plugins.registry.find((plugin) => plugin.id === "test-waveform-tools").status, "registered");

editor.loadPlugin("test-waveform-tools");
let plugin = editor.state.plugins.registry.find((item) => item.id === "test-waveform-tools");
assert.equal(plugin.enabled, true);
assert.equal(plugin.status, "loaded");
assert.equal(plugin.runtime.loadCount, 1);

editor.updatePluginSettings("test-waveform-tools", { density: 72 });
plugin = editor.state.plugins.registry.find((item) => item.id === "test-waveform-tools");
assert.equal(plugin.settings.density, 72);

editor.updatePluginPermissions("test-waveform-tools", ["timeline:read"]);
plugin = editor.state.plugins.registry.find((item) => item.id === "test-waveform-tools");
assert.deepEqual(plugin.permissionsGranted, ["timeline:read"]);

editor.disablePlugin("test-waveform-tools");
plugin = editor.state.plugins.registry.find((item) => item.id === "test-waveform-tools");
assert.equal(plugin.enabled, false);
assert.equal(plugin.status, "disabled");

editor.installMarketplacePlugin("launchly-color-lab");
assert.ok(editor.state.plugins.registry.find((item) => item.id === "launchly-color-lab"));

const restored = createPluginState(editor.serialize().plugins);
assert.equal(restored.registry.length, editor.state.plugins.registry.length);

console.log("pluginManager tests passed");
