import { createId } from "../types/editorTypes.js";

export const PLUGIN_PERMISSIONS = Object.freeze([
  "timeline:read",
  "timeline:write",
  "media:read",
  "media:write",
  "preview:read",
  "preview:write",
  "export:read",
  "export:write",
  "ai:read",
  "ai:write",
  "storage:read",
  "storage:write",
  "settings:read",
  "settings:write",
]);

export const DEFAULT_PLUGIN_MARKETPLACE = Object.freeze([
  {
    id: "launchly-color-lab",
    name: "Color Lab",
    version: "1.0.0",
    author: "Launchly",
    category: "Color",
    description: "Adds cinematic color presets and scopes to the grading workflow.",
    permissions: ["timeline:read", "preview:write", "settings:read"],
    settingsSchema: { intensity: { type: "number", default: 65 }, preset: { type: "string", default: "Cinematic Clean" } },
    marketplace: { featured: true, verified: true, pricing: "Included" },
  },
  {
    id: "launchly-audio-focus",
    name: "Audio Focus",
    version: "1.0.0",
    author: "Launchly",
    category: "Audio",
    description: "Provides voice-focused monitoring controls and mix review helpers.",
    permissions: ["timeline:read", "preview:read", "settings:write"],
    settingsSchema: { monitorMode: { type: "string", default: "Voice" }, gainAssist: { type: "boolean", default: true } },
    marketplace: { featured: false, verified: true, pricing: "Included" },
  },
  {
    id: "launchly-social-export",
    name: "Social Export Presets",
    version: "1.0.0",
    author: "Launchly",
    category: "Export",
    description: "Adds platform-oriented export preset definitions for future render flows.",
    permissions: ["export:read", "export:write", "settings:read"],
    settingsSchema: { platform: { type: "string", default: "Universal" }, includeSafeMargins: { type: "boolean", default: true } },
    marketplace: { featured: true, verified: true, pricing: "Included" },
  },
]);

export function normalizePluginManifest(input = {}) {
  const id = String(input.id ?? createId("plugin")).trim();
  const permissions = [...new Set(input.permissions ?? [])].filter((permission) => PLUGIN_PERMISSIONS.includes(permission));
  const settingsSchema = input.settingsSchema ?? {};
  const defaultSettings = Object.fromEntries(Object.entries(settingsSchema).map(([key, value]) => [key, value?.default]));
  return {
    id,
    name: String(input.name ?? "Untitled Plugin"),
    version: String(input.version ?? "0.1.0"),
    author: String(input.author ?? "Unknown"),
    category: String(input.category ?? "Workflow"),
    description: String(input.description ?? "No description provided."),
    permissions,
    settingsSchema,
    defaultSettings: { ...defaultSettings, ...(input.defaultSettings ?? {}) },
    entry: input.entry ?? null,
    capabilities: [...(input.capabilities ?? [])],
    marketplace: {
      featured: Boolean(input.marketplace?.featured),
      verified: Boolean(input.marketplace?.verified),
      pricing: input.marketplace?.pricing ?? "Custom",
      installed: Boolean(input.marketplace?.installed),
    },
  };
}

export function createPluginState({ marketplace = DEFAULT_PLUGIN_MARKETPLACE, installed = null, registry = null, events = [] } = {}) {
  const marketplaceItems = marketplace.map(normalizePluginManifest);
  const installedItems = (installed ?? registry ?? []).map((plugin) => normalizeInstalledPlugin(plugin, marketplaceItems.find((item) => item.id === plugin.id)));
  return {
    registry: installedItems,
    marketplace: marketplaceItems,
    events: [...events],
    permissionCatalog: [...PLUGIN_PERMISSIONS],
  };
}

export function normalizeInstalledPlugin(plugin = {}, manifest = plugin.manifest ?? plugin) {
  const normalizedManifest = normalizePluginManifest(manifest);
  return {
    id: plugin.id ?? normalizedManifest.id,
    manifest: normalizedManifest,
    status: plugin.status ?? "registered",
    enabled: Boolean(plugin.enabled ?? false),
    installedAt: plugin.installedAt ?? new Date().toISOString(),
    loadedAt: plugin.loadedAt ?? null,
    disabledAt: plugin.disabledAt ?? null,
    permissionsGranted: [...new Set(plugin.permissionsGranted ?? normalizedManifest.permissions)].filter((permission) => PLUGIN_PERMISSIONS.includes(permission)),
    settings: { ...normalizedManifest.defaultSettings, ...(plugin.settings ?? {}) },
    runtime: {
      loadCount: Number(plugin.runtime?.loadCount ?? 0),
      lastError: plugin.runtime?.lastError ?? null,
    },
  };
}

export function registerPlugin(state, manifest) {
  const normalized = normalizePluginManifest(manifest);
  const existing = state.registry.find((plugin) => plugin.id === normalized.id);
  const next = normalizeInstalledPlugin(existing ?? { id: normalized.id }, normalized);
  const registry = existing ? state.registry.map((plugin) => plugin.id === normalized.id ? { ...next, status: plugin.status, enabled: plugin.enabled } : plugin) : [next, ...state.registry];
  return recordPluginEvent({ ...state, registry }, "plugin:register", normalized.id);
}

export function loadPlugin(state, pluginId) {
  return mutatePlugin(state, pluginId, (plugin) => ({
    ...plugin,
    status: "loaded",
    enabled: true,
    loadedAt: new Date().toISOString(),
    disabledAt: null,
    runtime: { ...plugin.runtime, loadCount: plugin.runtime.loadCount + 1, lastError: null },
  }), "plugin:load");
}

export function disablePlugin(state, pluginId) {
  return mutatePlugin(state, pluginId, (plugin) => ({
    ...plugin,
    status: "disabled",
    enabled: false,
    disabledAt: new Date().toISOString(),
  }), "plugin:disable");
}

export function updatePluginSettings(state, pluginId, patch = {}) {
  return mutatePlugin(state, pluginId, (plugin) => ({ ...plugin, settings: { ...plugin.settings, ...patch } }), "plugin:settings");
}

export function updatePluginPermissions(state, pluginId, permissions = []) {
  const safePermissions = [...new Set(permissions)].filter((permission) => PLUGIN_PERMISSIONS.includes(permission));
  return mutatePlugin(state, pluginId, (plugin) => ({ ...plugin, permissionsGranted: safePermissions }), "plugin:permissions");
}

export function installMarketplacePlugin(state, pluginId) {
  const manifest = state.marketplace.find((plugin) => plugin.id === pluginId);
  if (!manifest) return state;
  return registerPlugin(state, manifest);
}

function mutatePlugin(state, pluginId, updater, event) {
  let changed = false;
  const registry = state.registry.map((plugin) => {
    if (plugin.id !== pluginId) return plugin;
    changed = true;
    return updater(plugin);
  });
  return changed ? recordPluginEvent({ ...state, registry }, event, pluginId) : state;
}

function recordPluginEvent(state, event, pluginId) {
  return {
    ...state,
    events: [{ event, pluginId, at: new Date().toISOString() }, ...(state.events ?? [])].slice(0, 80),
  };
}
