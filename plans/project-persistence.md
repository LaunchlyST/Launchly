# Project Persistence — Implementation Plan

## Goal
Consolidate the existing scattered project persistence code (~500 lines across app.js) into a proper engine-level module. The system already works — this plan organizes it, adds missing engine methods, and tightens editor integration.

---

## Current State

The persistence system is already fully functional but scattered:

| Feature | Status | Location |
|---------|--------|----------|
| Create project | ✅ Working | `app.js` bootstrap (lines 174-211) |
| Save (manual) | ✅ Working | `app.js` `manualSaveProject()` (lines 619-638) |
| Save As | ✅ Working | `app.js` `manualSaveProject({ saveAs: true })` |
| Auto Save | ✅ Working | `app.js` `saveProjectLocal()` (lines 489-509) |
| Open | ✅ Working | `app.js` `openProject()` (lines 604-617) |
| Duplicate | ✅ Working | `app.js` handler + `duplicateProjectRecord()` |
| Delete (soft) | ✅ Working | `app.js` handler with recycle bin |
| Recovery (3 layers) | ✅ Working | localStorage + errorSystem + version history |
| Recent projects | ✅ Working | `app.js` `filteredProjectItems()` (lines 658-671) |
| Thumbnails | ✅ Working | `projectManager.js` + `app.js` |
| Version history | ✅ Working | `app.js` `createProjectVersion()` (lines 538-559) |
| Folders | ✅ Working | `app.js` with default tree |
| Import/Export | ✅ Working | `app.js` handlers |

**Problem**: All orchestration logic (~500 lines) lives in `app.js`, not in the engine. The engine only has thin factories (`projectManager.js`, 69 lines) and hydration (`editorCore.js` `loadProject()`).

---

## Architecture

```
editor-engine/project/
  projectManager.js         ← KEEP existing factories + add CRUD operations
  projectPersistence.js     ← NEW: consolidated project library management
```

### Flow

```
app.js: editor.createProject({ name: "New Campaign" })
  → editorCore.createProject() 
    → projectPersistence.createProject(state, options)
      → returns normalized project record

app.js: editor.saveProject()
  → editorCore.saveProject()
    → projectPersistence.saveProject(library, activeId, state, options)
      → updates project record, creates version, returns updated library

app.js: editor.openProject(id)
  → editorCore.openProject(id)
    → projectPersistence.openProject(library, id)
      → updates lastOpenedAt, returns project

app.js: persistProjectLibrary()  ← stays in app.js (localStorage I/O)
```

---

## File-by-File Plan

### 1. `editor-engine/project/projectPersistence.js` — NEW

Consolidates all project library operations as pure functions. No I/O.

```js
import { createId } from "../types/editorTypes.js";
import { createProjectRecord, createProjectThumbnail, duplicateProjectRecord, createRecoveryRecord } from "./projectManager.js";

// ─── Project CRUD ───

export function createProject(library, options = {}) {
  const project = createProjectRecord(options);
  project.folderId = options.folderId ?? "root";
  project.favorite = options.favorite ?? false;
  project.versions = [];
  return { project, library: [project, ...library] };
}

export function openProject(library, projectId) {
  const project = library.find((p) => p.id === projectId);
  if (!project) return { project: null, library };
  project.lastOpenedAt = new Date().toISOString();
  return { project, library: sortProjects(library) };
}

export function saveProject(library, projectId, state, options = {}) {
  const project = library.find((p) => p.id === projectId);
  if (!project) return { project: null, library, version: null };
  project.state = state;
  project.updatedAt = new Date().toISOString();
  if (options.manual) project.manualSavedAt = project.updatedAt;
  if (options.autosave) project.autosavedAt = project.updatedAt;
  project.thumbnail = project.thumbnail ?? createProjectThumbnail(project.name);
  return { project, library: sortProjects(library) };
}

export function saveProjectAs(library, projectId, state) {
  const source = library.find((p) => p.id === projectId);
  if (!source) return { project: null, library };
  const copy = duplicateProjectRecord({ ...source, state }, `${source.name} Copy`);
  copy.folderId = source.folderId;
  copy.favorite = false;
  copy.versions = [];
  return { project: copy, library: [copy, ...library] };
}

export function duplicateProject(library, projectId, nextName) {
  const source = library.find((p) => p.id === projectId);
  if (!source) return { project: null, library };
  const copy = duplicateProjectRecord(source, nextName);
  copy.folderId = source.folderId;
  copy.favorite = false;
  copy.versions = [];
  return { project: copy, library: [copy, ...library] };
}

export function deleteProject(library, projectId) {
  const project = library.find((p) => p.id === projectId);
  if (!project) return library;
  project.deletedAt = new Date().toISOString();
  return library;
}

export function restoreProject(library, projectId) {
  const project = library.find((p) => p.id === projectId);
  if (!project) return library;
  project.deletedAt = null;
  project.folderId = "root";
  return library;
}

export function renameProject(library, projectId, newName) {
  const project = library.find((p) => p.id === projectId);
  if (!project) return library;
  project.name = newName;
  project.updatedAt = new Date().toISOString();
  project.thumbnail = createProjectThumbnail(newName);
  return library;
}

export function moveProject(library, projectId, folderId) {
  const project = library.find((p) => p.id === projectId);
  if (!project) return library;
  project.folderId = folderId;
  return library;
}

export function toggleFavorite(library, projectId) {
  const project = library.find((p) => p.id === projectId);
  if (!project) return library;
  project.favorite = !project.favorite;
  return library;
}

// ─── Project Query ───

export function getProject(library, projectId) {
  return library.find((p) => p.id === projectId) ?? null;
}

export function getActiveProject(library, activeProjectId) {
  return library.find((p) => p.id === activeProjectId) ?? library[0] ?? null;
}

export function getRecentProjects(library, limit = 5, maxAgeMs = 14 * 24 * 60 * 60 * 1000) {
  const now = Date.now();
  return library
    .filter((p) => !p.deletedAt && (now - new Date(p.lastOpenedAt ?? p.updatedAt).getTime()) < maxAgeMs)
    .sort((a, b) => new Date(b.lastOpenedAt ?? b.updatedAt) - new Date(a.lastOpenedAt ?? a.updatedAt))
    .slice(0, limit);
}

export function getDeletedProjects(library) {
  return library.filter((p) => p.deletedAt);
}

export function getActiveProjectId(library) {
  return getActiveProject(library)?.id ?? null;
}

// ─── Search, Filter, Sort ───

export function filterProjects(library, options = {}) {
  const { viewMode = "all", folderId = "root", searchQuery = "", sortMode = "recent", folders = [] } = options;
  const folderIds = folderId === "root" ? new Set(folders.map((f) => f.id)) : new Set([folderId]);
  const now = Date.now();

  return library.filter((project) => {
    if (viewMode === "recycle") return Boolean(project.deletedAt);
    if (project.deletedAt) return false;
    if (viewMode === "favorites" && !project.favorite) return false;
    if (viewMode === "recent" && (now - new Date(project.lastOpenedAt ?? project.updatedAt).getTime()) > 14 * 24 * 60 * 60 * 1000) return false;
    return folderIds.has(project.folderId ?? "root");
  }).filter((project) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return `${project.name} ${project.settings?.colorSpace ?? ""}`.toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sortMode === "name") return a.name.localeCompare(b.name);
    if (sortMode === "created") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortMode === "duration") return (b.state?.duration ?? 0) - (a.state?.duration ?? 0);
    return new Date(b.lastOpenedAt ?? b.updatedAt) - new Date(a.lastOpenedAt ?? a.updatedAt);
  });
}

function sortProjects(library) {
  return [...library].sort((a, b) => new Date(b.lastOpenedAt ?? b.updatedAt) - new Date(a.lastOpenedAt ?? a.updatedAt));
}

// ─── Version History ───

export function createVersion(project, state, options = {}) {
  const { type = "manual", comment = "", historyDepth = 0, lastSignature = null } = options;
  const signature = computeVersionSignature(state);
  if (!options.force && type === "auto" && signature === lastSignature) return { version: null, signature };

  const version = {
    id: `version-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    type,
    comment: comment.trim() || (type === "auto" ? "Auto checkpoint" : "Manual checkpoint"),
    state,
    createdAt: new Date().toISOString(),
    clipCount: state.clips?.length ?? 0,
    trackCount: state.tracks?.length ?? 0,
    timelineDuration: state.duration ?? 0,
    historyDepth,
  };

  project.versions = [version, ...(project.versions ?? [])];
  project.versionUpdatedAt = version.createdAt;
  return { version, signature };
}

export function getVersion(project, versionId) {
  return (project.versions ?? []).find((v) => v.id === versionId) ?? null;
}

export function restoreVersion(project, versionId) {
  const version = getVersion(project, versionId);
  if (!version) return null;
  return version.state;
}

function computeVersionSignature(state) {
  return JSON.stringify({
    clips: state?.clips?.map((c) => [c.id, c.name, c.trackId, c.timelineStart ?? c.start, c.duration, c.layer, c.groupId, c.hidden, c.solo]),
    tracks: state?.tracks?.map((t) => [t.id, t.name, t.order, t.visible, t.locked]),
    time: state?.time,
    duration: state?.duration,
  });
}

// ─── Recovery ───

export function createRecoverySnapshot(library, recoverySnapshots, projectId, state, reason = "autosave", limit = 8) {
  const record = createRecoveryRecord(projectId, state, reason);
  return [record, ...recoverySnapshots].slice(0, limit);
}

export function findRecoverySnapshot(recoverySnapshots, snapshotId) {
  return recoverySnapshots.find((r) => r.id === snapshotId) ?? null;
}

export function getRecoveryProject(library, snapshot) {
  return library.find((p) => p.id === snapshot?.projectId) ?? null;
}

// ─── Folder Management ───

export function createFolder(folders, name, parentId = "root") {
  const folder = {
    id: `folder-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    name,
    parentId,
    expanded: true,
    favorite: false,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
  return { folder, folders: [...folders, folder] };
}

export function deleteFolder(folders, library, folderId) {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder || folderId === "root") return { folders, library };
  folder.deletedAt = new Date().toISOString();
  const updatedLibrary = library.map((p) => p.folderId === folderId ? { ...p, folderId: "root" } : p);
  return { folders, library: updatedLibrary };
}

export function renameFolder(folders, folderId, newName) {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return folders;
  folder.name = newName;
  return folders;
}

export function getFolderTree(folders, parentId = "root", depth = 0) {
  return folders
    .filter((f) => !f.deletedAt && f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({ ...f, depth, children: getFolderTree(folders, f.id, depth + 1) }));
}

export function getFolderPath(folders, folderId) {
  const path = [];
  let current = folders.find((f) => f.id === folderId);
  while (current) {
    path.unshift(current);
    current = folders.find((f) => f.id === current.parentId);
  }
  return path.length ? path : [folders.find((f) => f.id === "root")].filter(Boolean);
}

// ─── Thumbnail ───

export function generateThumbnail(name, clipCount = 0) {
  const hue = (clipCount * 37 + name.length * 11) % 360;
  const label = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "PR";
  return { hue, label };
}

// ─── Import/Export ───

export function serializeForExport(project) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), project }, null, 2);
}

export function parseImportedProject(text) {
  const parsed = JSON.parse(text);
  const project = parsed.project ?? parsed;
  if (!project?.name || !project?.state) throw new Error("Invalid Launchly project file.");
  return { ...createProjectRecord(project), ...project, updatedAt: new Date().toISOString(), deletedAt: null };
}

// ─── Normalize ───

export function normalizeLibrary(library) {
  return library.map((project) => ({
    ...project,
    folderId: project.folderId ?? "root",
    favorite: Boolean(project.favorite ?? false),
    versions: Array.isArray(project.versions) ? project.versions : [],
    deletedAt: project.deletedAt ?? null,
  }));
}

export function normalizeFolders(folders) {
  if (!folders.length) {
    const now = new Date().toISOString();
    return [
      { id: "root", name: "All Projects", parentId: null, expanded: true, favorite: false, createdAt: now, deletedAt: null },
      { id: "folder-campaigns", name: "Campaigns", parentId: "root", expanded: true, favorite: false, createdAt: now, deletedAt: null },
      { id: "folder-social", name: "Social Cuts", parentId: "root", expanded: true, favorite: true, createdAt: now, deletedAt: null },
    ];
  }
  return folders;
}
```

### 2. `editor-engine/project/projectManager.js` — UPDATE

Keep existing factories, add utility exports:

```js
// Keep ALL existing exports unchanged
export const PROJECT_SCHEMA_VERSION = 1;
export function createProjectRecord(...) { ... }       // unchanged
export function createProjectThumbnail(...) { ... }    // unchanged
export function duplicateProjectRecord(...) { ... }    // unchanged
export function serializeProjectPackage(...) { ... }    // unchanged
export function parseProjectPackage(...) { ... }        // unchanged
export function createRecoveryRecord(...) { ... }       // unchanged
```

No changes needed — this file stays as-is.

### 3. `editor-engine/core/editorCore.js` — UPDATE

Add project management methods that delegate to `projectPersistence.js`.

**New import**:
```js
import {
  createProject as persistenceCreateProject,
  openProject as persistenceOpenProject,
  saveProject as persistenceSaveProject,
  saveProjectAs as persistenceSaveProjectAs,
  duplicateProject as persistenceDuplicateProject,
  deleteProject as persistenceDeleteProject,
  restoreProject as persistenceRestoreProject,
  renameProject as persistenceRenameProject,
  moveProject as persistenceMoveProject,
  toggleFavorite as persistenceToggleFavorite,
  createVersion as persistenceCreateVersion,
  getVersion as persistenceGetVersion,
  restoreVersion as persistenceRestoreVersion,
  createRecoverySnapshot,
  normalizeLibrary,
  normalizeFolders,
  serializeForExport as persistenceSerializeForExport,
  parseImportedProject as persistenceParseImportedProject,
} from "../project/projectPersistence.js";
```

**New methods on EditorCore**:
```js
// ─── Project CRUD ───
createProjectState(options = {}) {
  return persistenceCreateProject(this.state.projectLibrary ?? [], options);
}

saveProjectState(state, options = {}) {
  return persistenceSaveProject(this.state.projectLibrary ?? [], this.state.activeProjectId, state, options);
}

saveProjectAsState(state) {
  return persistenceSaveProjectAs(this.state.projectLibrary ?? [], this.state.activeProjectId, state);
}

duplicateProjectState(nextName) {
  return persistenceDuplicateProject(this.state.projectLibrary ?? [], this.state.activeProjectId, nextName);
}

deleteProjectState(projectId) {
  return persistenceDeleteProject(this.state.projectLibrary ?? [], projectId);
}

restoreProjectState(projectId) {
  return persistenceRestoreProject(this.state.projectLibrary ?? [], projectId);
}

renameProjectState(projectId, newName) {
  return persistenceRenameProject(this.state.projectLibrary ?? [], projectId, newName);
}

moveProjectState(projectId, folderId) {
  return persistenceMoveProject(this.state.projectLibrary ?? [], projectId, folderId);
}

toggleFavoriteState(projectId) {
  return persistenceToggleFavorite(this.state.projectLibrary ?? [], projectId);
}

// ─── Project Query ───
getProjectState(projectId) {
  return (this.state.projectLibrary ?? []).find((p) => p.id === projectId) ?? null;
}

getActiveProjectState() {
  return (this.state.projectLibrary ?? []).find((p) => p.id === this.state.activeProjectId) ?? null;
}

getRecentProjects(limit = 5) {
  return getRecentProjects(this.state.projectLibrary ?? [], limit);
}

// ─── Version History ───
createProjectVersion(state, options = {}) {
  const project = this.getActiveProjectState();
  if (!project) return null;
  const { version, signature } = persistenceCreateVersion(project, state, {
    ...options,
    historyDepth: this.state.history?.length ?? 0,
    lastSignature: this._lastAutoCheckpointSignature,
  });
  this._lastAutoCheckpointSignature = signature;
  return version;
}

restoreProjectVersion(versionId) {
  const project = this.getActiveProjectState();
  if (!project) return null;
  return persistenceRestoreVersion(project, versionId);
}

// ─── Recovery ───
createRecoverySnapshot(snapshot, reason = "autosave") {
  return createRecoverySnapshot(
    this.state.projectLibrary ?? [],
    this.state.recoverySnapshots ?? [],
    this.state.activeProjectId,
    snapshot,
    reason
  );
}

// ─── Import/Export ───
exportProjectToFile() {
  const project = this.getActiveProjectState();
  if (!project) return null;
  return { json: persistenceSerializeForExport(project), name: project.name };
}

importProjectFromFile(text) {
  const project = persistenceParseImportedProject(text);
  return project;
}
```

### 4. Update `editor-engine/project/projectManager.js` — NO CHANGES

Keep as-is. All factories remain unchanged.

### 5. Update `editor-engine/index.js` — ADD EXPORTS

```js
export * from "./project/projectPersistence.js";
// Keep existing:
// export * from "./project/projectManager.js";  (already there, but NOT currently exported)
```

Wait — checking: `projectManager.js` is NOT currently exported from `index.js`. Let me verify:

The current `index.js` does NOT have:
```js
export * from "./project/projectManager.js";
```

It only has:
```js
export * from "./project/projectManager.js";  // line 25 — wait, let me check
```

Actually looking at the index.js I read earlier, line 25 is:
```js
export * from "./project/projectManager.js";
```

So it IS exported. Good. Add the new module:
```js
export * from "./project/projectManager.js";
export * from "./project/projectPersistence.js";
```

### 6. Update `app.js` — REPLACE SCATTERED CODE

Replace the ~300 lines of scattered persistence code with thin wrappers that call engine methods.

**Replace `saveProjectLocal()`** (lines 489-509):
```js
function saveProjectLocal() {
  try {
    const state = editor.serialize();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(state));
    const project = currentProject();
    if (!project) return;
    
    // Use engine persistence
    const result = editor.saveProjectState(state, { autosave: true });
    if (result.project) Object.assign(project, result.project);
    
    // Version checkpoint
    editor.createProjectVersion(state, { type: "auto", comment: `Auto checkpoint after ${editor.state.autosave?.reason ?? "edit"}` });
    
    // Sync
    markProjectSyncChange("Autosave prepared for future sync");
    persistProjectLibrary();
    
    // Recovery snapshots
    const limit = Math.max(3, Number(settings.recoverySnapshots ?? 8));
    recoverySnapshots = editor.createRecoverySnapshot(state, "autosave");
    if (recoverySnapshots.length > limit) recoverySnapshots = recoverySnapshots.slice(0, limit);
    localStorage.setItem(PROJECT_RECOVERY_KEY, JSON.stringify(recoverySnapshots));
    editor.createRecoveryPoint("autosave");
  } catch (error) {
    editor.logError(error, { source: "autosave", severity: "error", userMessage: "Autosave failed. Recovery remains available from memory." });
    renderErrorCenter();
  }
}
```

**Replace `manualSaveProject()`** (lines 619-638):
```js
function manualSaveProject({ saveAs = false } = {}) {
  const state = editor.serialize();
  const project = currentProject();
  if (!project) return;

  if (saveAs) {
    const result = editor.saveProjectAsState(state);
    if (result.project) {
      projectLibrary.unshift(result.project);
      activeProjectId = result.project.id;
    }
  } else {
    const result = editor.saveProjectState(state, { manual: true });
    if (result.project) Object.assign(project, result.project);
  }

  editor.createProjectVersion(state, { type: "manual", comment: saveAs ? "Save As checkpoint" : "Manual save checkpoint" });
  persistProjectLibrary();
  syncProjectHeader();
  renderProjectManager();
  showToast(saveAs ? "Project saved as copy" : "Project saved manually");
}
```

**Replace `openProject()`** (lines 604-617):
```js
function openProject(projectId) {
  const project = editor.getProjectState(projectId);
  if (!project) return;
  activeProjectId = project.id;
  project.lastOpenedAt = new Date().toISOString();
  editor.loadProject(project.state);
  editor.setProjectMetadata({ id: project.id, name: project.name, settings: project.settings, thumbnail: project.thumbnail });
  persistProjectLibrary();
  renderTimelineFromState();
  updateTimecode();
  syncProjectHeader();
  renderProjectManager();
  showToast(`${project.name} opened`);
}
```

**Replace `filteredProjectItems()`** (lines 658-671):
```js
function filteredProjectItems(folderId) {
  return filterProjects(projectLibrary, {
    viewMode: projectViewMode,
    folderId,
    searchQuery: projectSearchQuery,
    sortMode: projectSortMode,
    folders: projectFolders,
  });
}
```

**Replace version functions** (lines 538-593):
```js
function createProjectVersion({ type = "manual", comment = "", force = false } = {}) {
  return editor.createProjectVersion(editor.serialize(), { type, comment, force });
}

function restoreProjectVersion(versionId) {
  const project = currentProject();
  const state = editor.restoreProjectVersion(versionId);
  if (!state) return;
  createProjectVersion({ type: "auto", comment: "Before version restore", force: true });
  project.state = state;
  project.updatedAt = new Date().toISOString();
  activeProjectId = project.id;
  editor.loadProject(state);
  editor.setProjectMetadata({ id: project.id, name: project.name, settings: project.settings, thumbnail: project.thumbnail });
  persistProjectLibrary();
  renderTimelineFromState();
  updateTimecode();
  syncProjectHeader();
  renderProjectManager();
  showToast(`Restored: ${versionId}`, { type: "success", title: "Version Restored" });
}
```

**Replace bootstrap** (lines 174-211):
```js
editor.hydrateFromDom(document);
try {
  projectLibrary = normalizeLibrary(JSON.parse(localStorage.getItem(PROJECT_LIBRARY_KEY) || "[]"));
  projectFolders = normalizeFolders(JSON.parse(localStorage.getItem(PROJECT_FOLDERS_KEY) || "[]"));
  recoverySnapshots = JSON.parse(localStorage.getItem(PROJECT_RECOVERY_KEY) || "[]");
  
  const legacy = localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!projectLibrary.length) {
    const initial = createProjectRecord({ name: "Untitled Campaign", state: legacy ? JSON.parse(legacy) : editor.serialize() });
    initial.folderId = "folder-campaigns";
    projectLibrary = [initial];
    localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(projectLibrary));
  }
  
  localStorage.setItem(PROJECT_FOLDERS_KEY, JSON.stringify(projectFolders));
  activeProjectId = localStorage.getItem(`${PROJECT_LIBRARY_KEY}.active`) || projectLibrary[0]?.id;
  const activeProject = editor.getActiveProjectState();
  if (activeProject?.state) {
    activeProjectId = activeProject.id;
    editor.loadProject(activeProject.state);
    editor.setProjectMetadata({ id: activeProject.id, name: activeProject.name, settings: activeProject.settings, thumbnail: activeProject.thumbnail });
  }
} catch {
  localStorage.removeItem(PROJECT_STORAGE_KEY);
  localStorage.removeItem(PROJECT_LIBRARY_KEY);
  localStorage.removeItem(PROJECT_FOLDERS_KEY);
}
```

**Replace `persistProjectLibrary()`** — stays in app.js (localStorage I/O):
```js
function persistProjectLibrary() {
  projectLibrary.sort((a, b) => new Date(b.lastOpenedAt ?? b.updatedAt) - new Date(a.lastOpenedAt ?? a.updatedAt));
  localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(projectLibrary));
  localStorage.setItem(PROJECT_FOLDERS_KEY, JSON.stringify(projectFolders));
  if (activeProjectId) localStorage.setItem(`${PROJECT_LIBRARY_KEY}.active`, activeProjectId);
}
```

**Replace `currentProject()`**:
```js
function currentProject() {
  return editor.getActiveProjectState();
}
```

**Replace `createProjectThumbnailFromDom()`**:
```js
function createProjectThumbnailFromDom(name) {
  return generateThumbnail(name, editor.state.clips?.length ?? 0);
}
```

**Replace duplicate handler**:
```js
// In the duplicate handler:
const result = editor.duplicateProjectState();
if (result.project) {
  projectLibrary = result.library;
  showToast(`Duplicated: ${result.project.name}`);
}
```

**Replace delete handler**:
```js
// In the delete handler:
projectLibrary = editor.deleteProjectState(projectId);
if (projectId === activeProjectId) {
  const next = projectLibrary.find((p) => !p.deletedAt);
  if (next) openProject(next.id);
}
persistProjectLibrary();
renderProjectManager();
```

**Replace folder functions**:
```js
function folderName(folderId) {
  return projectFolders.find((f) => f.id === folderId)?.name ?? "All Projects";
}

function projectFolderPath(folderId) {
  return getFolderPath(projectFolders, folderId);
}

function renderFolderTree(parentId = "root", depth = 0) {
  return getFolderTree(projectFolders, parentId, depth)
    .map((folder) => `
      <button class="${folder.id === activeProjectFolderId ? "active" : ""}${folder.favorite ? " favorite" : ""}" style="--folder-depth:${depth}" data-project-folder="${folder.id}">
        <span>${escapeHtml(folder.name)}</span><em>${projectLibrary.filter((p) => p.folderId === folder.id && !p.deletedAt).length}</em>
      </button>
      ${folder.children.map((child) => renderFolderTree(child.id, depth + 1)).join("")}
    `).join("");
}
```

**Replace import/export handlers**:
```js
// Export:
function handleProjectExport() {
  const result = editor.exportProjectToFile();
  if (!result) return;
  const blob = new Blob([result.json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${result.name}.launchly.json`; a.click();
  URL.revokeObjectURL(url);
}

// Import:
function handleProjectImport(text) {
  const project = editor.importProjectFromFile(text);
  project.folderId = activeProjectFolderId;
  projectLibrary.unshift(project);
  activeProjectId = project.id;
  persistProjectLibrary();
  openProject(project.id);
}
```

---

## Net Effect

| Metric | Before | After |
|--------|--------|-------|
| Persistence logic in app.js | ~500 lines | ~150 lines (thin wrappers + localStorage I/O) |
| Engine project methods | 3 (loadProject, serialize, setProjectMetadata) | 15+ (CRUD, versions, recovery, import/export) |
| projectManager.js | 69 lines (factories only) | 69 lines (unchanged) |
| projectPersistence.js | N/A | ~350 lines (all pure functions) |
| localStorage operations | Scattered across app.js | Consolidated in `persistProjectLibrary()` + bootstrap |

---

## What This Does NOT Change
- No new UI elements
- No new HTML
- No new CSS
- No new localStorage keys
- No changes to the 3-layer recovery system
- No changes to the sync system integration

## What This DOES Change
- Persistence logic moves from app.js into engine module
- EditorCore gets 15+ project management methods
- Pure functions enable testing without DOM/localStorage
- All project operations go through a single module
- app.js becomes a thin I/O + rendering layer
