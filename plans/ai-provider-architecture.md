# AI Provider Architecture — Implementation Plan

## Goal
Build a unified provider interface so any AI service (OpenAI, Gemini, Claude, OpenRouter, Replicate, Fal, Local) can be swapped in later without changing tool logic. No API keys. No external calls. Architecture only.

---

## Architecture

```
editor-engine/ai/
  providers/
    baseProvider.js          ← abstract interface every provider implements
    providerRegistry.js      ← register, select, route to active provider
    openai.js                ← OpenAI stub
    gemini.js                ← Google Gemini stub
    claude.js                ← Anthropic Claude stub
    openrouter.js            ← OpenRouter stub
    replicate.js             ← Replicate stub
    fal.js                   ← Fal stub
    local.js                 ← local/no-API fallback (wraps existing runAiToolLocally)
  aiToolSystem.js            ← updated: routes runAiTool through provider registry
```

### Flow

```
EditorCore.runAiTool(toolId, instruction)
  → providerRegistry.execute(tool, instruction)
    → activeProvider.run(tool, instruction)
      → provider-specific HTTP call (stubbed: returns local result)
        → { status, result, model, tokens }
```

---

## File-by-File Plan

### 1. `editor-engine/ai/providers/baseProvider.js`

Abstract base that every provider extends. All methods throw if not overridden.

```js
export const PROVIDER_IDS = ["openai", "gemini", "claude", "openrouter", "replicate", "fal", "local"];

export const CAPABILITY_TYPES = ["text", "image", "audio", "video", "multimodal"];

export function createBaseProvider(config) {
  return {
    id: config.id,                    // "openai"
    name: config.name,                // "OpenAI"
    description: config.description,  // "GPT-4o, DALL·E 3, Whisper"
    capabilities: config.capabilities, // ["text", "image", "audio"]
    models: config.models ?? [],       // [{ id, name, type }]
    requiresApiKey: config.requiresApiKey ?? true,
    isConnected: false,
    config: {},                        // stored at connect time
  };
}

// Each provider must implement:
// connect(storedConfig) → validates, sets isConnected
// disconnect() → clears config
// run(tool, instruction, context) → { status, result, model, tokens }
// getModels() → [{ id, name, type }]
// getCapabilities() → string[]
// estimateCost(tool, context) → { tokens, estimatedCost } (optional)
```

### 2. `editor-engine/ai/providers/providerRegistry.js`

Central registry. Holds all providers, tracks the active one.

```js
export function createProviderRegistry() {
  return {
    providers: [],       // registered provider instances
    activeProviderId: null,
    configs: {},         // stored configs per provider (keys redacted in logs)
  };
}

export function registerProvider(registry, provider) → registry
export function setActiveProvider(registry, providerId) → registry
export function getActiveProvider(registry) → provider | null
export function executeWithActiveProvider(registry, tool, instruction, context) → result
export function connectProvider(registry, providerId, storedConfig) → registry
export function disconnectProvider(registry, providerId) → registry
export function listProviders(registry) → [{ id, name, isConnected, capabilities }]
```

The `executeWithActiveProvider` function:
1. Finds the active provider
2. If none connected, falls back to `local` provider
3. Calls `provider.run(tool, instruction, context)`
4. Returns normalized result

### 3. Provider Stubs (openai.js, gemini.js, claude.js, openrouter.js, replicate.js, fal.js)

Each follows the same pattern:

```js
// openai.js example
import { createBaseProvider } from "./baseProvider.js";

export function createOpenAIProvider() {
  return {
    ...createBaseProvider({
      id: "openai",
      name: "OpenAI",
      description: "GPT-4o, GPT-4o-mini, DALL·E 3, Whisper",
      capabilities: ["text", "image", "audio"],
      models: [
        { id: "gpt-4o", name: "GPT-4o", type: "text" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", type: "text" },
        { id: "dall-e-3", name: "DALL·E 3", type: "image" },
        { id: "whisper-1", name: "Whisper", type: "audio" },
      ],
      requiresApiKey: true,
    }),
    connect(storedConfig) { /* validate apiKey, set this.isConnected = true */ },
    disconnect() { /* clear config, set isConnected = false */ },
    async run(tool, instruction, context) {
      // Stub: return local result
      // When connected: POST to https://api.openai.com/v1/chat/completions
      return { status: "stub", result: `OpenAI would process: ${tool.name}`, model: "gpt-4o", tokens: 0 };
    },
    getModels() { return this.models; },
    getCapabilities() { return this.capabilities; },
  };
}
```

Provider-specific model lists:
- **OpenAI**: gpt-4o, gpt-4o-mini, dall-e-3, whisper-1, tts-1
- **Gemini**: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash, imagen-3
- **Claude**: claude-sonnet-4-20250514, claude-3-5-haiku-20241022, claude-3-opus-20240229
- **OpenRouter**: claude-sonnet-4, gpt-4o, gemini-2.0-flash, llama-3.1-405b (aggregator)
- **Replicate**: stable-diffusion-xl, whisper, segment-anything, various community models
- **Fal**: fal-ai/flux-pro, fal-ai/realtime-voice, fal-ai/segment-anything
- **Local**: wraps existing `runAiToolLocally()`, always returns stub results

### 4. `editor-engine/ai/providers/local.js`

The fallback provider. Wraps the existing `runAiToolLocally` behavior:

```js
import { createBaseProvider } from "./baseProvider.js";

export function createLocalProvider() {
  return {
    ...createBaseProvider({
      id: "local",
      name: "Local",
      description: "No API required. Runs local edit recommendations.",
      capabilities: ["text"],
      models: [{ id: "local-model", name: "Local Planning", type: "text" }],
      requiresApiKey: false,
    }),
    connect() { this.isConnected = true; },
    disconnect() { this.isConnected = false; },
    async run(tool, instruction) {
      // Identical behavior to existing runAiToolLocally
      return { status: "Done", result: `${tool.name} queued a local edit recommendation.`, model: "local", tokens: 0 };
    },
    getModels() { return this.models; },
    getCapabilities() { return this.capabilities; },
  };
}
```

### 5. Update `editor-engine/ai/aiToolSystem.js`

Add provider registry import and update `runAiToolLocally` to optionally route through provider:

```js
import { createProviderRegistry, executeWithActiveProvider, registerProvider, ... } from "./providers/providerRegistry.js";
import { createLocalProvider } from "./providers/local.js";
// ... other imports

// Existing functions stay unchanged

// New: create a singleton registry with local provider pre-registered
let defaultRegistry = null;

export function getDefaultProviderRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = createProviderRegistry();
    registerProvider(defaultRegistry, createLocalProvider());
    // local is pre-connected and set as active by default
    connectProvider(defaultRegistry, "local", {});
    setActiveProvider(defaultRegistry, "local");
  }
  return defaultRegistry;
}

// Updated: runAiTool now accepts optional registry and routes through it
export function runAiToolLocally(tool, instruction = "", registry = null) {
  const activeRegistry = registry ?? getDefaultProviderRegistry();
  // Delegate to provider system
  return executeWithActiveProvider(activeRegistry, tool, instruction, {});
}
```

### 6. Update `editor-engine/core/editorCore.js`

Add provider methods and wire registry into state:

**New state fields** (in `createDefaultState`):
```js
aiProviderRegistry: null,  // initialized lazily
aiProviderId: "local",     // current provider selection
```

**New methods on EditorCore**:
```js
connectAiProvider(providerId, storedConfig) → provider
disconnectAiProvider(providerId) → provider
switchAiProvider(providerId) → provider
listAiProviders() → [{ id, name, isConnected, capabilities }]
getAiProviderModels(providerId) → [{ id, name, type }]
getAiProviderStatus() → { active, connected, provider }
```

**Updated `runAiTool`**:
```js
runAiTool(toolId, instruction = this.state.aiCommand) {
  // Now routes through provider registry
  const registry = this.getAiProviderRegistry();
  return this.commit("ai:tool-run", () => {
    let result;
    this.state.aiTools = createAiToolState(this.state.aiTools).map((tool) => {
      if (tool.id !== toolId) return tool;
      result = executeWithActiveProvider(registry, tool, instruction);
      return normalizeAiTool({ ...tool, status: result.status, result: result.result, progress: result.status === "Done" ? 100 : tool.progress });
    });
    if (result) this.state.aiQueue = [{ toolId, name: result.name, status: result.status, at: new Date().toISOString(), result: result.result }, ...(this.state.aiQueue ?? [])].slice(0, 12);
    return result;
  });
}
```

### 7. Update `editor-engine/index.js`

Add new exports:
```js
export * from "./ai/providers/baseProvider.js";
export * from "./ai/providers/providerRegistry.js";
export * from "./ai/providers/local.js";
export * from "./ai/providers/openai.js";
export * from "./ai/providers/gemini.js";
export * from "./ai/providers/claude.js";
export * from "./ai/providers/openrouter.js";
export * from "./ai/providers/replicate.js";
export * from "./ai/providers/fal.js";
```

### 8. Update `index.html` — AI Settings panel

Add provider selector to the existing AI Settings section in the settings modal:

```html
<!-- Add inside the AI settings panel -->
<label>AI Provider
  <select data-ai-provider-select>
    <option value="local" selected>Local (No API)</option>
    <option value="openai">OpenAI</option>
    <option value="gemini">Google Gemini</option>
    <option value="claude">Anthropic Claude</option>
    <option value="openrouter">OpenRouter</option>
    <option value="replicate">Replicate</option>
    <option value="fal">Fal</option>
  </select>
</label>
<div data-ai-provider-config hidden>
  <label>API Key <input data-ai-api-key type="password" placeholder="sk-..." /></label>
  <label>Model <select data-ai-model-select></select></label>
  <button data-ai-connect-provider>Connect</button>
  <span data-ai-provider-status></span>
</div>
```

### 9. Update `app.js` — Wire provider UI

New handlers:

1. **Provider select change** → updates model dropdown options, shows/hides config panel
2. **Connect button** → calls `editor.connectAiProvider(id, { apiKey })`
3. **Model select** → updates provider model preference
4. **Provider status badge** → renders in AI panel header ("Connected to OpenAI" / "Local mode")

Add to the `renderAiPanel()` function:
```js
// In the AI panel head, show active provider
const status = editor.getAiProviderStatus();
panelHead.innerHTML += `<span class="ai-provider-badge">${status.active ?? 'Local'}</span>`;
```

Add to `renderSettingsSection()` — update the `ai:` panel:
```js
ai: `
  <div class="settings-section-head"><strong>AI Settings</strong><span>Configure AI providers for enhanced tools.</span></div>
  <div class="settings-grid">
    ${settingsField("AI Provider", "aiProvider", providerSelect())}
    ${settingsField("Local Planning Mode", "aiLocalOnly", `<input data-setting type="checkbox" ${settingChecked("aiLocalOnly")} />`)}
    ${settingsField("AI Suggestions", "aiSuggestions", `<input data-setting type="checkbox" ${settingChecked("aiSuggestions")} />`)}
    ${settingsField("Preview Quality", "aiPreviewQuality", settingOptions("aiPreviewQuality", ["Draft", "Balanced", "Detailed"]))}
    <div data-ai-provider-config class="settings-provider-config" hidden>
      ${settingsField("API Key", "aiApiKey", `<input data-setting type="password" placeholder="Enter API key" />`)}
      ${settingsField("Model", "aiModel", `<select data-setting></select>`)}
      <button data-ai-connect-provider class="settings-connect-btn">Connect Provider</button>
      <span data-ai-provider-status class="settings-provider-status"></span>
    </div>
  </div>`,
```

### 10. Update `styles.css`

Add minimal styles for provider UI:
```css
.ai-provider-badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(191, 238, 255, 0.15);
  font-size: 10px;
  font-weight: 700;
  color: var(--soft);
}

.ai-provider-badge.connected { background: rgba(157, 231, 198, 0.2); }

.settings-provider-config { display: grid; gap: 8px; }
.settings-connect-btn { ... }
.settings-provider-status { font-size: 11px; color: var(--muted); }
```

---

## Data Shape — Provider Result

```js
{
  status: "Done" | "Processing" | "Error" | "stub",
  result: {
    summary: string,
    instruction: string,
    completedAt: string (ISO),
    model: string,
    tokens: number,
    provider: string,
  },
  model: string,
  tokens: number,
}
```

## Data Shape — Stored Provider Config

```js
{
  apiKey: "...",          // stored but never logged
  model: "gpt-4o",       // selected model
  organization: "",       // optional (OpenAI)
  region: "",             // optional (Gemini, Fal)
  customEndpoint: "",     // optional override
}
```

---

## What This Does NOT Do
- No API calls are made
- No API keys are validated against external services
- No HTTP client code is written
- No `.env` file is created
- No changes to existing tool behavior (local mode stays default)

## What This DOES Do
- Clean provider interface that any AI service can slot into
- Registry pattern for provider management
- Configurable model selection per provider
- Seamless fallback to local mode
- Foundation for future `connect()` implementations to add real HTTP calls
- UI hooks for provider selection in settings and AI panel
- All existing functionality preserved — local mode is the default and always works
