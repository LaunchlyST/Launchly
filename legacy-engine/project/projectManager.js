import { createId } from "../types/editorTypes.js";

export const PROJECT_SCHEMA_VERSION = 1;

export function createProjectRecord({ name = "Untitled Campaign", state = null, settings = {}, thumbnail = null } = {}) {
  const now = new Date().toISOString();
  return {
    id: createId("project"),
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name,
    thumbnail: thumbnail ?? createProjectThumbnail(name),
    settings: {
      width: 3840,
      height: 2160,
      fps: 30,
      sampleRate: 48000,
      colorSpace: "Rec.709",
      autosave: true,
      ...(settings ?? {}),
    },
    state,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    autosavedAt: null,
    manualSavedAt: null,
    deletedAt: null,
  };
}

export function createProjectThumbnail(name = "Project") {
  const hue = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
  return { hue, label: name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "PR" };
}

export function duplicateProjectRecord(project, nextName = `${project.name} Copy`) {
  const now = new Date().toISOString();
  return {
    ...structuredClone(project),
    id: createId("project"),
    name: nextName,
    thumbnail: createProjectThumbnail(nextName),
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    deletedAt: null,
  };
}

export function serializeProjectPackage(project) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), project }, null, 2);
}

export function parseProjectPackage(text) {
  const parsed = JSON.parse(text);
  const project = parsed.project ?? parsed;
  if (!project?.name || !project?.state) throw new Error("Invalid Launchly project file.");
  return { ...createProjectRecord(project), ...project, updatedAt: new Date().toISOString(), deletedAt: null };
}

export function createRecoveryRecord(projectId, state, reason = "autosave") {
  return {
    id: createId("recovery"),
    projectId,
    state,
    reason,
    createdAt: new Date().toISOString(),
  };
}
