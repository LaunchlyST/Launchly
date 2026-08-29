import { createId } from "../types/editorTypes.js";

export const AI_TOOL_REGISTRY = Object.freeze([
  { id: "auto-captions", name: "Auto Captions", category: "Captions", status: "Ready", description: "Draft timed caption tracks from the local timeline context.", settings: { language: "English", style: "Sentence" } },
  { id: "remove-silence", name: "Remove Silence", category: "Audio", status: "Ready", description: "Find pauses and propose tighter dialogue pacing.", settings: { threshold: "-38 dB", ripple: "On" } },
  { id: "auto-cut", name: "Auto Cut", category: "Timeline", status: "Ready", description: "Build a paced first-pass edit from selected media.", settings: { pace: "Fast", maxDuration: "30s" } },
  { id: "scene-detection", name: "Scene Detection", category: "Analysis", status: "Ready", description: "Mark visual scene boundaries and shot changes.", settings: { sensitivity: "Balanced" } },
  { id: "object-tracking", name: "Object Tracking", category: "Motion", status: "Ready", description: "Create local subject tracks for reframing and masks.", settings: { target: "Primary subject" } },
  { id: "smart-crop", name: "Smart Crop", category: "Canvas", status: "New", description: "Suggest clean crop bounds for selected clips.", settings: { safeMargins: "On" } },
  { id: "auto-reframe", name: "Auto Reframe", category: "Canvas", status: "Processing", description: "Keep the subject framed for alternate aspect ratios.", settings: { aspect: "9:16" }, progress: 42 },
  { id: "voice-enhancement", name: "Voice Enhancement", category: "Audio", status: "Ready", description: "Prepare a dialogue clarity chain for the audio engine.", settings: { presence: "Studio" } },
  { id: "eye-contact", name: "Eye Contact", category: "Video", status: "New", description: "Preview eye-line correction as a future video tool.", settings: { strength: "Subtle" } },
  { id: "background-removal", name: "Background Removal", category: "Video", status: "Ready", description: "Prepare layer isolation controls for selected subjects.", settings: { edge: "Natural" } },
  { id: "hook-generator", name: "Hook Generator", category: "Copy", status: "Ready", description: "Draft opening hooks for the first three seconds.", settings: { tone: "Premium" } },
  { id: "title-generator", name: "Title Generator", category: "Copy", status: "Ready", description: "Create title options for campaign variants.", settings: { count: "6" } },
  { id: "description-generator", name: "Description Generator", category: "Copy", status: "Ready", description: "Generate short platform-ready descriptions.", settings: { platform: "Universal" } },
  { id: "thumbnail-suggestions", name: "Thumbnail Suggestions", category: "Creative", status: "New", description: "Suggest thumbnail frames, text, and composition notes.", settings: { variants: "4" } },
]);

export function normalizeAiTool(tool) {
  const source = AI_TOOL_REGISTRY.find((item) => item.id === tool?.id) ?? tool ?? AI_TOOL_REGISTRY[0];
  return {
    id: source.id,
    name: source.name,
    category: source.category,
    status: tool?.status ?? source.status ?? "Ready",
    description: source.description,
    settings: { ...(source.settings ?? {}), ...(tool?.settings ?? {}) },
    progress: Number(tool?.progress ?? source.progress ?? 0),
    lastRunAt: tool?.lastRunAt ?? null,
    result: tool?.result ?? null,
  };
}

export function createAiToolState(tools = AI_TOOL_REGISTRY) {
  return tools.map((tool) => normalizeAiTool(tool));
}

export function runAiToolLocally(tool, instruction = "") {
  const completedAt = new Date().toISOString();
  return normalizeAiTool({
    ...tool,
    status: "Done",
    progress: 100,
    lastRunAt: completedAt,
    result: {
      id: createId("ai_result"),
      summary: `${tool.name} queued a local edit recommendation.`,
      instruction: instruction.trim(),
      completedAt,
    },
  });
}
