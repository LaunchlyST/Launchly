import { AI_TOOL_REGISTRY, DEFAULT_SHORTCUTS, actionForShortcut, canDropPayloadOnTrack, createBackgroundQueue, createConflictResolver, createDownloadManager, createDragSession, createFrameCache, createMediaEngine, createOfflineMode, createPlayer, createProjectRecord, createProjectSyncManager, createRafScheduler, createRecoveryRecord, createShortcutState, createStorageEngine, createUploadManager, duplicateProjectRecord, isClipInWindow, normalizeDragPayload, normalizeShortcut, parseProjectPackage, runWhenIdle, serializeProjectPackage, timelineViewportWindow, EditorCore, captionSafePosition } from "./editor-engine/index.js";

const notificationStack = document.querySelector("[data-notification-stack]");
const timecode = document.querySelector("[data-timecode]");
const cursor = document.querySelector("[data-cursor]");
const score = document.querySelector("[data-score]");
const timelineEditor = document.querySelector(".timeline-editor");
const videoFrame = document.querySelector(".video-frame");
const contextMenu = document.querySelector("[data-context-menu]");
const exportDropdown = document.querySelector("[data-export-dropdown]");
const mediaLibrary = document.querySelector("[data-media-library]");
const mediaPreview = document.querySelector("[data-media-preview]");
const snapGuide = document.querySelector("[data-snap-guide]");
const totalDuration = document.querySelector("[data-total-duration]");
const previewStatus = document.querySelector("[data-preview-status]");
const previewFps = document.querySelector("[data-preview-fps]");
const globalSearch = document.querySelector("[data-global-search]");
const globalSearchInput = document.querySelector("[data-global-search-input]");
const globalSearchResults = document.querySelector("[data-global-search-results]");
const globalSearchFilters = document.querySelector("[data-global-search-filters]");

const clipElementCache = new Map();
const globalSearchCount = document.querySelector("[data-global-search-count]");
const globalSearchEmpty = document.querySelector("[data-global-search-empty]");
const aiCommandBackdrop = document.querySelector("[data-ai-command-backdrop]");
const aiCommandInput = document.querySelector("[data-ai-command-input]");
const aiCommandSuggestions = document.querySelector("[data-ai-command-suggestions]");
const aiCommandPreview = document.querySelector("[data-ai-command-preview]");
const aiCommandHistory = document.querySelector("[data-ai-command-history]");
let frame = 84;
let playing = false;
let playbackSpeed = 1;
let previewVolume = 0.82;
let notificationSequence = 0;
const activeNotifications = new Map();
let timelineZoom = 1;
let exportJobTimer = null;
let activeExportJob = null;
const editor = new EditorCore({ fps: 30, duration: 190 });
const storageEngine = createStorageEngine({ storageLimitMB: 12 });
editor.setStorageEngine(storageEngine);
const mediaEngine = createMediaEngine(editor.state.assetManager);
const playback = createPlayer({
  fps: editor.state.fps,
  duration: editor.state.duration,
  renderFrame: (time) => editor.renderFrame(time),
  onFrame: handlePlaybackEngineFrame,
});
const PROJECT_STORAGE_KEY = "launchly.editor.project.v1";
const PROJECT_LIBRARY_KEY = "launchly.editor.projects.v1";
const PROJECT_FOLDERS_KEY = "launchly.editor.projectFolders.v1";
const PROJECT_RECOVERY_KEY = "launchly.editor.recovery.v1";
const SHORTCUT_STORAGE_KEY = "launchly.editor.shortcuts.v1";
const SETTINGS_STORAGE_KEY = "launchly.editor.settings.v1";
const ERROR_STORAGE_KEY = "launchly.editor.errors.v1";
const USER_TEMPLATE_STORAGE_KEY = "launchly.editor.userTemplates.v1";
const SYNC_STORAGE_KEY = "launchly.editor.sync.v1";
let projectLibrary = [];
let projectFolders = [];
let recoverySnapshots = [];
let activeProjectId = null;
let activeProjectFolderId = "root";
let projectSearchQuery = "";
let projectSortMode = "recent";
let projectViewMode = "all";
let lastAutoCheckpointSignature = "";
let shortcuts = createShortcutState(JSON.parse(localStorage.getItem(SHORTCUT_STORAGE_KEY) || "{}"));
let recordingShortcutAction = null;
let activeTemplateCategory = "All";
let userTemplates = [];
let syncArchitecture = null;
const DEFAULT_SETTINGS = Object.freeze({
  theme: "Midnight Glass",
  accent: "Ice Blue",
  language: "English",
  region: "United Kingdom",
  autosave: true,
  autosaveInterval: 180,
  playbackQuality: "Balanced",
  playbackResolution: "1080p Proxy",
  timelineSnap: true,
  timelineMagnetic: true,
  timelineWaveforms: true,
  timelineThumbnails: true,
  performanceMode: "Adaptive",
  gpuRendering: true,
  backgroundRendering: true,
  proxyMedia: true,
  storageLimit: 12,
  thumbnailCache: true,
  exportResolution: "1080p",
  exportFormat: "MP4",
  exportCodec: "H.264",
  exportFps: 30,
  aiLocalOnly: true,
  aiSuggestions: true,
  aiPreviewQuality: "Draft",
  notifyExports: true,
  notifyAutosave: false,
  notifyWarnings: true,
  syncPrepared: true,
  syncOfflineMode: false,
  syncBackgroundQueue: true,
  syncConflictStrategy: "Ask every time",
  syncUploadPolicy: "Project changes only",
  syncDownloadPolicy: "Manual",
  accountName: "Matas",
  accountRole: "Creator",
});
const TEMPLATE_CATEGORIES = ["All", "Intro", "Outro", "Titles", "YouTube", "TikTok", "Instagram", "Lower thirds", "Product ads", "Podcast", "Education", "Business", "Gaming", "Saved"];
const TEMPLATE_LIBRARY = Object.freeze([
  { id: "intro-cinematic-hook", category: "Intro", name: "Cinematic Hook", description: "Three-beat opener with title reveal, hero plate, and quick product flash.", duration: "00:08", format: "16:9", accent: "ice", textTemplate: "editorial" },
  { id: "intro-social-punch", category: "Intro", name: "Social Punch", description: "Fast vertical opener for short-form attention in the first two seconds.", duration: "00:05", format: "9:16", accent: "mint", textTemplate: "captionGlass" },
  { id: "outro-brand-close", category: "Outro", name: "Brand Close", description: "Logo lockup, soft call-to-action, and final music fade.", duration: "00:07", format: "16:9", accent: "ice", textTemplate: "lowerThird" },
  { id: "outro-subscribe-clean", category: "Outro", name: "Subscribe End Card", description: "Balanced end screen structure for channel videos and campaign recaps.", duration: "00:10", format: "16:9", accent: "amber", textTemplate: "subtitleClean" },
  { id: "titles-editorial", category: "Titles", name: "Editorial Title Set", description: "Premium title, subtitle, and chapter card typography stack.", duration: "00:06", format: "Any", accent: "ice", textTemplate: "editorial" },
  { id: "titles-glass-caption", category: "Titles", name: "Glass Caption Pack", description: "Readable frosted captions with safe spacing and subtle motion.", duration: "Reusable", format: "Any", accent: "mint", textTemplate: "captionGlass", captionTemplate: "glass" },
  { id: "youtube-review", category: "YouTube", name: "YouTube Review Flow", description: "Hook, proof points, B-roll blocks, chapter cards, and end screen.", duration: "08:00", format: "16:9", accent: "ice" },
  { id: "youtube-tutorial", category: "YouTube", name: "Tutorial Structure", description: "Intro promise, step sections, zoom callouts, and recap layout.", duration: "12:00", format: "16:9", accent: "mint", captionTemplate: "editorial" },
  { id: "tiktok-product-burst", category: "TikTok", name: "Product Burst", description: "Vertical fast-cut product advert with captions and punchy beats.", duration: "00:30", format: "9:16", accent: "mint", textTemplate: "captionGlass" },
  { id: "tiktok-storytime", category: "TikTok", name: "Storytime Cut", description: "Sentence captions, jump-cut pacing, and retention marker slots.", duration: "00:45", format: "9:16", accent: "ice", captionTemplate: "speaker" },
  { id: "instagram-reel-polish", category: "Instagram", name: "Reel Polish", description: "Lifestyle edit rhythm with lower callouts and soft brand ending.", duration: "00:25", format: "9:16", accent: "rose", textTemplate: "lowerThird" },
  { id: "instagram-carousel-video", category: "Instagram", name: "Carousel Video", description: "Square campaign structure with cover, value slides, and close.", duration: "00:35", format: "1:1", accent: "amber", textTemplate: "editorial" },
  { id: "lower-third-speaker", category: "Lower thirds", name: "Speaker Identifier", description: "Elegant name, role, and company lower third for interviews.", duration: "00:05", format: "Any", accent: "ice", textTemplate: "lowerThird" },
  { id: "lower-third-stat", category: "Lower thirds", name: "Metric Callout", description: "Statistic lower third with subtle emphasis and caption-safe position.", duration: "00:04", format: "Any", accent: "mint", textTemplate: "lowerThird" },
  { id: "product-ad-launch", category: "Product ads", name: "Launch Advert", description: "Problem, reveal, proof, offer, and CTA campaign structure.", duration: "00:30", format: "16:9", accent: "ice", textTemplate: "editorial" },
  { id: "product-ad-demo", category: "Product ads", name: "Feature Demo", description: "Macro detail shots, feature captions, and smooth benefit pacing.", duration: "00:45", format: "16:9", accent: "mint", captionTemplate: "glass" },
  { id: "podcast-clips", category: "Podcast", name: "Podcast Clip", description: "Speaker captions, waveform strip, quote title, and vertical crop.", duration: "01:00", format: "9:16", accent: "ice", captionTemplate: "speaker" },
  { id: "podcast-full-episode", category: "Podcast", name: "Episode Layout", description: "Full episode structure with intro slate, chapters, and sponsor card.", duration: "45:00", format: "16:9", accent: "amber" },
  { id: "education-lesson", category: "Education", name: "Lesson Builder", description: "Learning objective, steps, examples, knowledge check, and recap.", duration: "06:00", format: "16:9", accent: "mint", textTemplate: "subtitleClean" },
  { id: "education-micro", category: "Education", name: "Micro Lesson", description: "Short vertical explainer with clear captions and visual checkpoints.", duration: "00:40", format: "9:16", accent: "ice", captionTemplate: "editorial" },
  { id: "business-update", category: "Business", name: "Executive Update", description: "Measured corporate update with chapter cards and metric callouts.", duration: "03:00", format: "16:9", accent: "ice", textTemplate: "editorial" },
  { id: "business-case-study", category: "Business", name: "Case Study", description: "Challenge, process, outcome, proof, and testimonial structure.", duration: "02:30", format: "16:9", accent: "mint", textTemplate: "lowerThird" },
  { id: "gaming-highlight", category: "Gaming", name: "Highlight Reel", description: "Cold open, kill streak markers, chat caption moments, and punch ending.", duration: "01:00", format: "16:9", accent: "rose", textTemplate: "captionGlass" },
  { id: "gaming-short", category: "Gaming", name: "Vertical Clip", description: "Fast vertical gameplay beat map with captions and reaction callouts.", duration: "00:30", format: "9:16", accent: "mint", captionTemplate: "speaker" }
]);
let settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}") };
let activeSettingsSection = "theme";
let renderRevision = 0;
const previewFrameCache = createFrameCache(120);
const timelineRenderScheduler = createRafScheduler(() => renderTimelineFromState({ scheduled: true }));
const assetRenderScheduler = createRafScheduler(() => renderAssetManager({ scheduled: true }));
const previewScheduler = createRafScheduler(() => applyAnimatedPreviewFrame());
const aiRenderScheduler = createRafScheduler(() => renderAiPanel());
const exportRenderScheduler = createRafScheduler(() => renderExportPanels());
let dragSession = null;
let dragScrollRaf = null;
let dragLastEvent = null;
let activeGlobalSearchFilter = "All";
let activeGlobalSearchIndex = 0;
let activeAiCommandIndex = 0;
let aiCommandHistoryItems = [];
let mediaPreviewTimer = null;
let mediaPreviewState = { assetId: null, progress: 0, playing: false, imageZoom: 1 };
let pendingReplaceClipId = null;
let lastFocusedBeforeOverlay = null;
const activeIntervals = new Set();
const activeTimeouts = new Set();
const aiToolTimers = new Map();
const throttledToastState = new Map();

const AI_COMMANDS = Object.freeze([
  { command: "Remove silence", intent: "Audio cleanup", tool: "Remove Silence", result: "Prepared silence ranges, pacing gaps, and ripple edit checkpoints." },
  { command: "Generate captions", intent: "Captions", tool: "Auto Captions", result: "Prepared editable caption track, safe-zone style, and timing markers." },
  { command: "Create TikTok version", intent: "Format conversion", tool: "Auto Reframe", result: "Prepared 9:16 timeline plan, center crop, hook beat, and caption emphasis." },
  { command: "Make video 30 seconds", intent: "Duration edit", tool: "Auto Cut", result: "Prepared short-form pacing plan with suggested keep/remove sections." },
  { command: "Center subject", intent: "Composition", tool: "Smart Crop", result: "Prepared subject-centered framing notes and keyframe markers." },
  { command: "Improve voice", intent: "Audio polish", tool: "Voice Enhance", result: "Prepared voice presence, noise cleanup, and music ducking settings." },
  { command: "Generate hook", intent: "Creative", tool: "AI Hook Generator", result: "Prepared three opener concepts and a first-three-seconds edit plan." },
]);

document.querySelectorAll("button:not([type])").forEach((button) => {
  button.type = "button";
});
document.querySelector("[data-text-content]")?.setAttribute("draggable", "true");
document.querySelector("[data-text-template]")?.setAttribute("draggable", "true");
document.querySelector("[data-transition-name]")?.setAttribute("draggable", "true");
document.querySelector("[data-effect-type]")?.setAttribute("draggable", "true");

editor.hydrateFromDom(document);
try {
  projectLibrary = JSON.parse(localStorage.getItem(PROJECT_LIBRARY_KEY) || "[]");
  projectFolders = JSON.parse(localStorage.getItem(PROJECT_FOLDERS_KEY) || "[]");
  recoverySnapshots = JSON.parse(localStorage.getItem(PROJECT_RECOVERY_KEY) || "[]");
  const legacy = localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!projectFolders.length) {
    projectFolders = [
      { id: "root", name: "All Projects", parentId: null, expanded: true, favorite: false, createdAt: new Date().toISOString(), deletedAt: null },
      { id: "folder-campaigns", name: "Campaigns", parentId: "root", expanded: true, favorite: false, createdAt: new Date().toISOString(), deletedAt: null },
      { id: "folder-social", name: "Social Cuts", parentId: "root", expanded: true, favorite: true, createdAt: new Date().toISOString(), deletedAt: null }
    ];
  }
  if (!projectLibrary.length) {
    const initial = createProjectRecord({ name: "Untitled Campaign", state: legacy ? JSON.parse(legacy) : editor.serialize() });
    initial.folderId = "folder-campaigns";
    initial.favorite = false;
    projectLibrary = [initial];
    localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(projectLibrary));
  }
  projectLibrary.forEach((project) => {
    project.folderId = project.folderId ?? "root";
    project.favorite = Boolean(project.favorite ?? false);
    project.versions = Array.isArray(project.versions) ? project.versions : [];
  });
  localStorage.setItem(PROJECT_FOLDERS_KEY, JSON.stringify(projectFolders));
  activeProjectId = localStorage.getItem(`${PROJECT_LIBRARY_KEY}.active`) || projectLibrary[0]?.id;
  const activeProject = projectLibrary.find((project) => project.id === activeProjectId) ?? projectLibrary[0];
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
window.launchlyEditor = editor;
try {
  const storedErrors = JSON.parse(localStorage.getItem(ERROR_STORAGE_KEY) || "null");
  if (storedErrors) editor.state.errors = { ...editor.state.errors, ...storedErrors };
} catch {
  localStorage.removeItem(ERROR_STORAGE_KEY);
}
try {
  userTemplates = JSON.parse(localStorage.getItem(USER_TEMPLATE_STORAGE_KEY) || "[]");
} catch {
  userTemplates = [];
  localStorage.removeItem(USER_TEMPLATE_STORAGE_KEY);
}
try {
  const storedSync = JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY) || "{}");
  syncArchitecture = createSyncArchitecture(storedSync);
} catch {
  localStorage.removeItem(SYNC_STORAGE_KEY);
  syncArchitecture = createSyncArchitecture();
}
syncMediaEngineFromEditor();

function syncMediaEngineFromEditor() {
  const next = createMediaEngine(editor.state.assetManager);
  mediaEngine.state = next.state;
  return mediaEngine.state;
}

function commitMediaEngineToEditor(reason = "media library updated") {
  editor.state.assetManager = mediaEngine.state;
  const project = currentProject?.();
  if (project) {
    project.state = editor.serialize();
    project.updatedAt = new Date().toISOString();
    persistProjectLibrary();
  }
  renderAssetManager();
  renderSyncStatus();
  showToast(reason, { type: "success", title: "Media Engine" });
}

function createSyncArchitecture(snapshot = {}) {
  return {
    offlineMode: createOfflineMode(snapshot.offlineMode ?? {}),
    backgroundQueue: createBackgroundQueue(snapshot.backgroundQueue ?? {}),
    projectSync: createProjectSyncManager(snapshot.projectSync ?? {}),
    uploadManager: createUploadManager(snapshot.uploadManager ?? {}),
    downloadManager: createDownloadManager(snapshot.downloadManager ?? {}),
    conflictResolver: createConflictResolver(snapshot.conflictResolver ?? {}),
  };
}

function syncSnapshot() {
  return {
    offlineMode: syncArchitecture.offlineMode.state,
    backgroundQueue: syncArchitecture.backgroundQueue.state,
    projectSync: syncArchitecture.projectSync.state,
    uploadManager: syncArchitecture.uploadManager.state,
    downloadManager: syncArchitecture.downloadManager.state,
    conflictResolver: syncArchitecture.conflictResolver.state,
  };
}

function persistSyncState() {
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncSnapshot()));
    storageEngine.write("sync", "architecture", syncSnapshot());
  } catch (error) {
    editor.logError(error, { source: "persistSyncState", severity: "warning", userMessage: "Sync state save failed." });
  }
  renderSyncStatus();
}

function ensureProjectSyncRecord() {
  const project = currentProject();
  if (!project) return null;
  return syncArchitecture.projectSync.upsertProject({
    projectId: project.id,
    name: project.name,
    status: syncArchitecture.offlineMode.state.offline ? "offline-ready" : "local-only",
    localRevision: project.versions?.length ? project.versions.length + 1 : 1,
    pendingChanges: 0,
  });
}

function markProjectSyncChange(reason = "Project changed locally") {
  const project = currentProject();
  if (!project || !syncArchitecture) return null;
  const record = syncArchitecture.projectSync.markLocalChange({ projectId: project.id, name: project.name });
  syncArchitecture.backgroundQueue.enqueue({
    type: "project-sync",
    label: reason,
    projectId: project.id,
    priority: "high",
    metadata: syncArchitecture.projectSync.createManifest(project.id) ?? {},
  });
  syncArchitecture.uploadManager.prepareUpload({
    projectId: project.id,
    label: `${project.name} project package`,
    bytesTotal: Math.max(1, JSON.stringify(project.state ?? {}).length),
    metadata: { revision: record.localRevision },
  });
  syncArchitecture.projectSync.markQueued(project.id);
  persistSyncState();
  return record;
}

function queueSyncDownload() {
  const project = currentProject();
  if (!project) return null;
  const intent = syncArchitecture.downloadManager.prepareDownload({
    projectId: project.id,
    label: `${project.name} manifest refresh`,
    bytesExpected: Math.max(1024, JSON.stringify(project.state ?? {}).length),
    metadata: { targetRevision: (project.versions?.length ?? 0) + 1 },
  });
  syncArchitecture.backgroundQueue.enqueue({
    type: "project-download",
    label: "Prepare cloud manifest refresh",
    projectId: project.id,
    metadata: { intentId: intent.id },
  });
  persistSyncState();
  return intent;
}

function simulateSyncConflict() {
  const project = currentProject();
  if (!project) return null;
  const record = ensureProjectSyncRecord();
  const conflict = syncArchitecture.conflictResolver.createConflict({
    projectId: project.id,
    label: `${project.name} revision conflict`,
    localRevision: record?.localRevision ?? 2,
    remoteRevision: (record?.remoteRevision ?? 0) + 2,
    localSummary: "Browser copy contains unsynced timeline and asset changes.",
    remoteSummary: "Future cloud copy reports a newer project manifest.",
  });
  syncArchitecture.backgroundQueue.enqueue({
    type: "conflict-review",
    label: "Resolve project conflict before syncing",
    projectId: project.id,
    priority: "high",
    metadata: { conflictId: conflict.id },
  });
  persistSyncState();
  return conflict;
}

function resolveSyncConflict(conflictId, strategy) {
  const resolved = syncArchitecture.conflictResolver.resolve(conflictId, strategy);
  if (!resolved) return;
  syncArchitecture.backgroundQueue.enqueue({
    type: "conflict-resolution",
    label: `Conflict resolved: ${strategy.replace("-", " ")}`,
    projectId: resolved.projectId,
    metadata: { conflictId, strategy },
  });
  persistSyncState();
  showToast("Sync conflict resolved locally", { type: "success", title: "Conflict Resolver" });
}

function setSyncOffline(nextOffline) {
  if (nextOffline) {
    syncArchitecture.offlineMode.setOffline("Manual offline mode");
    syncArchitecture.backgroundQueue.pause("offline mode");
  } else {
    syncArchitecture.offlineMode.setOnline();
    syncArchitecture.backgroundQueue.resume();
  }
  settings.syncOfflineMode = Boolean(nextOffline);
  saveSettings();
  persistSyncState();
}

function handleSyncAction(action) {
  if (action === "queue-project") {
    markProjectSyncChange("Prepare active project for sync");
    showToast("Project sync task queued locally", { type: "info", title: "Sync Manager" });
  }
  if (action === "queue-download") {
    queueSyncDownload();
    showToast("Download intent prepared locally", { type: "info", title: "Download Manager" });
  }
  if (action === "simulate-conflict") {
    simulateSyncConflict();
    showToast("Conflict record created locally", { type: "warning", title: "Conflict Resolver" });
  }
  if (action === "toggle-offline") {
    setSyncOffline(!syncArchitecture.offlineMode.state.offline);
    showToast(syncArchitecture.offlineMode.state.offline ? "Offline mode enabled" : "Offline mode disabled", { type: "info", title: "Offline Mode" });
  }
  if (action === "clear-completed") {
    syncArchitecture.backgroundQueue.clearCompleted();
    persistSyncState();
    showToast("Completed sync jobs cleared");
  }
  renderSettingsContent();
}

function syncStatusLabel(status) {
  return String(status ?? "ready").replace(/-/g, " ");
}

function renderSyncSettingsPanel() {
  ensureProjectSyncRecord();
  const { backgroundQueue, projectSync, uploadManager, downloadManager, conflictResolver, offlineMode } = syncArchitecture;
  const project = projectSync.getProject(activeProjectId) ?? {};
  const openConflicts = conflictResolver.openConflicts();
  const jobs = [...backgroundQueue.state.jobs].reverse().slice(0, 8);
  const uploads = uploadManager.state.intents.slice(-3).reverse();
  const downloads = downloadManager.state.intents.slice(-3).reverse();
  const moduleCards = [
    ["Project Sync Manager", syncStatusLabel(project.status), `${project.pendingChanges ?? 0} pending changes`],
    ["Upload Manager", uploadManager.state.policy, `${uploadManager.state.intents.length} prepared intents`],
    ["Download Manager", downloadManager.state.policy, `${downloadManager.state.intents.length} prepared intents`],
    ["Conflict Resolver", openConflicts.length ? "attention needed" : "ready", `${openConflicts.length} open conflicts`],
    ["Background Queue", backgroundQueue.state.paused ? "paused" : "ready", `${backgroundQueue.pending().length} pending jobs`],
    ["Offline Mode", offlineMode.state.offline ? "offline" : "online", offlineMode.state.offline ? offlineMode.state.reason : `Last online ${new Date(offlineMode.state.lastOnlineAt).toLocaleString()}`],
  ];
  return `
    <div class="settings-section-head"><strong>Cloud Sync</strong><span>Architecture-only cloud readiness. Managers create local manifests, queue work, and resolve conflicts without contacting any server.</span></div>
    <div class="sync-architecture">
      <div class="sync-action-row">
        <button data-sync-action="queue-project">Queue Project Sync</button>
        <button data-sync-action="queue-download">Prepare Download</button>
        <button data-sync-action="simulate-conflict">Simulate Conflict</button>
        <button data-sync-action="toggle-offline">${offlineMode.state.offline ? "Go Online" : "Go Offline"}</button>
        <button data-sync-action="clear-completed">Clear Completed</button>
      </div>
      <div class="settings-grid">
        ${settingsField("Prepared Architecture", "syncPrepared", `<input data-setting type="checkbox" ${settingChecked("syncPrepared")} />`)}
        ${settingsField("Background Queue", "syncBackgroundQueue", `<input data-setting type="checkbox" ${settingChecked("syncBackgroundQueue")} />`)}
        ${settingsField("Upload Policy", "syncUploadPolicy", settingOptions("syncUploadPolicy", ["Project changes only", "Assets and project", "Manual"]))}
        ${settingsField("Download Policy", "syncDownloadPolicy", settingOptions("syncDownloadPolicy", ["Manual", "On project open", "When online"]))}
        ${settingsField("Conflict Strategy", "syncConflictStrategy", settingOptions("syncConflictStrategy", ["Ask every time", "Keep local copy", "Keep newest revision", "Duplicate project"]))}
      </div>
      <div class="sync-module-grid">
        ${moduleCards.map(([name, status, detail]) => `<article class="sync-module-card ${String(status).replace(/\s+/g, "-")}"><strong>${name}</strong><span>${status}</span><p>${detail}</p></article>`).join("")}
      </div>
      <div class="sync-columns">
        <section>
          <div class="plugin-head"><strong>Background Queue</strong><span>${backgroundQueue.state.jobs.length} jobs</span></div>
          <div class="sync-list">${jobs.map((job) => `<article class="${job.status}"><strong>${escapeHtml(job.label)}</strong><span>${job.type} - ${job.status} - ${Math.round(job.progress)}%</span></article>`).join("") || '<div class="plugin-empty">No sync jobs queued.</div>'}</div>
        </section>
        <section>
          <div class="plugin-head"><strong>Transfer Intents</strong><span>${uploadManager.state.intents.length + downloadManager.state.intents.length} prepared</span></div>
          <div class="sync-list">${[...uploads, ...downloads].map((item) => `<article><strong>${escapeHtml(item.label)}</strong><span>${item.type} - ${item.status} - ${Math.round(item.progress)}%</span></article>`).join("") || '<div class="plugin-empty">No upload or download intents prepared.</div>'}</div>
        </section>
        <section>
          <div class="plugin-head"><strong>Conflicts</strong><span>${openConflicts.length} open</span></div>
          <div class="sync-list">${openConflicts.map((conflict) => `
            <article class="warning">
              <strong>${escapeHtml(conflict.label)}</strong>
              <span>Local r${conflict.localRevision} - Remote r${conflict.remoteRevision}</span>
              <div class="sync-resolution-row">
                <button data-sync-resolve="${conflict.id}" data-sync-strategy="keep-local">Keep Local</button>
                <button data-sync-resolve="${conflict.id}" data-sync-strategy="keep-remote">Keep Remote</button>
                <button data-sync-resolve="${conflict.id}" data-sync-strategy="duplicate">Duplicate</button>
              </div>
            </article>`).join("") || '<div class="plugin-empty">No conflicts detected.</div>'}</div>
        </section>
      </div>
    </div>`;
}

function renderSyncStatus() {
  const side = document.querySelector("[data-sync-side-list]");
  const status = document.querySelector("[data-sync-side-status]");
  if (!side || !status || !syncArchitecture) return;
  const project = syncArchitecture.projectSync.getProject(activeProjectId) ?? ensureProjectSyncRecord();
  const pending = syncArchitecture.backgroundQueue.pending().length;
  const conflicts = syncArchitecture.conflictResolver.openConflicts().length;
  status.textContent = syncArchitecture.offlineMode.state.offline ? "Offline-ready" : "Prepared";
  side.innerHTML = `
    <article><strong>Project Sync</strong><span>${syncStatusLabel(project?.status)} - r${project?.localRevision ?? 1}</span></article>
    <article><strong>Background Queue</strong><span>${pending} pending jobs</span></article>
    <article><strong>Conflict Resolver</strong><span>${conflicts} open conflicts</span></article>
    <article><strong>Offline Mode</strong><span>${syncArchitecture.offlineMode.state.offline ? "Paused and cached" : "Online-ready architecture"}</span></article>
  `;
}

function saveProjectLocal() {
  try {
    const state = editor.serialize();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(state));
    const project = currentProject();
    if (!project) return;
    project.state = state;
    project.updatedAt = new Date().toISOString();
    project.autosavedAt = project.updatedAt;
    project.thumbnail = project.thumbnail ?? createProjectThumbnailFromDom(project.name);
    createProjectVersion({ type: "auto", comment: `Auto checkpoint after ${editor.state.autosave?.reason ?? "edit"}` });
    markProjectSyncChange("Autosave prepared for future sync");
    persistProjectLibrary();
  } catch (error) {
    editor.logError(error, { source: "autosave", severity: "error", userMessage: "Autosave failed. Recovery remains available from memory." });
    renderErrorCenter();
  }
  try {
    const project = currentProject();
    if (project) {
      const state = project.state ?? editor.serialize();
      const limit = Math.max(3, Number(settings.recoverySnapshots ?? 8));
      recoverySnapshots = [createRecoveryRecord(project.id, state, "autosave"), ...recoverySnapshots].slice(0, limit);
      localStorage.setItem(PROJECT_RECOVERY_KEY, JSON.stringify(recoverySnapshots));
      editor.createRecoveryPoint("autosave");
    }
  } catch (error) {
    editor.logError(error, { source: "recovery-snapshot", severity: "warning", userMessage: "Recovery snapshot write failed." });
  }
}

function currentProject() {
  return projectLibrary.find((project) => project.id === activeProjectId) ?? null;
}

let _persistTimer = null;
function persistProjectLibrary() {
  clearManagedTimeout(_persistTimer);
  _persistTimer = managedTimeout(_doPersistProjectLibrary, 300);
}
function _doPersistProjectLibrary() {
  try {
    projectLibrary.sort((a, b) => new Date(b.lastOpenedAt ?? b.updatedAt) - new Date(a.lastOpenedAt ?? a.updatedAt));
    localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(projectLibrary));
    localStorage.setItem(PROJECT_FOLDERS_KEY, JSON.stringify(projectFolders));
    if (activeProjectId) localStorage.setItem(`${PROJECT_LIBRARY_KEY}.active`, activeProjectId);
    storageEngine.write("project", "library", projectLibrary);
    storageEngine.write("project", "folders", projectFolders);
    if (activeProjectId) storageEngine.write("project", "activeId", activeProjectId);
  } catch (error) {
    editor.logError(error, { source: "persistProjectLibrary", severity: "error", userMessage: "Project library save failed. Storage may be full." });
    renderErrorCenter();
  }
}

function createProjectThumbnailFromDom(name) {
  const clipCount = editor.state.clips?.length ?? 0;
  const hue = (clipCount * 37 + name.length * 11) % 360;
  return { hue, label: name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "PR" };
}

function projectVersionSignature(state) {
  return JSON.stringify({
    clips: state?.clips?.map((clip) => [clip.id, clip.name, clip.trackId, clip.timelineStart ?? clip.start, clip.duration, clip.layer, clip.groupId, clip.hidden, clip.solo]),
    tracks: state?.tracks?.map((track) => [track.id, track.name, track.order, track.visible, track.locked]),
    time: state?.time,
    duration: state?.duration
  });
}

function createProjectVersion({ type = "manual", comment = "", force = false } = {}) {
  const project = currentProject();
  if (!project) return null;
  const state = editor.serialize();
  const signature = projectVersionSignature(state);
  if (!force && type === "auto" && signature === lastAutoCheckpointSignature) return null;
  lastAutoCheckpointSignature = signature;
  const version = {
    id: `version-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    type,
    comment: comment.trim() || (type === "auto" ? "Auto checkpoint" : "Manual checkpoint"),
    state,
    createdAt: new Date().toISOString(),
    clipCount: state.clips?.length ?? 0,
    trackCount: state.tracks?.length ?? 0,
    timelineDuration: state.duration ?? 0,
    historyDepth: editor.state.history?.length ?? 0
  };
  project.versions = [version, ...(project.versions ?? [])].slice(0, 30);
  project.versionUpdatedAt = version.createdAt;
  persistProjectLibrary();
  return version;
}

function restoreProjectVersion(versionId) {
  const project = currentProject();
  const version = project?.versions?.find((item) => item.id === versionId);
  if (!project || !version) return;
  createProjectVersion({ type: "auto", comment: "Before version restore", force: true });
  project.state = version.state;
  project.updatedAt = new Date().toISOString();
  activeProjectId = project.id;
  editor.loadProject(version.state);
  editor.setProjectMetadata({ id: project.id, name: project.name, settings: project.settings, thumbnail: project.thumbnail });
  persistProjectLibrary();
  renderTimelineFromState();
  updateTimecode();
  syncProjectHeader();
  renderProjectManager();
  showToast(`Restored: ${version.comment}`, { type: "success", title: "Version Restored" });
}

function renderVersionHistory() {
  const target = document.querySelector("[data-version-history]");
  const count = document.querySelector("[data-version-count]");
  if (!target || !count) return;
  const versions = currentProject()?.versions ?? [];
  count.textContent = `${versions.length} version${versions.length === 1 ? "" : "s"}`;
  target.innerHTML = versions.length ? versions.map((version) => `
    <article data-version-id="${version.id}" class="${version.type}">
      <strong>${escapeHtml(version.comment)}</strong>
      <span>${new Date(version.createdAt).toLocaleString()} - ${version.type} - ${version.clipCount} clips - ${formatDuration(version.timelineDuration)}</span>
      <p>Undo depth ${version.historyDepth} - ${version.trackCount} tracks</p>
      <button data-version-restore="${version.id}">Restore</button>
    </article>
  `).join("") : '<div class="export-empty">No timeline snapshots yet.</div>';
}

function syncProjectHeader() {
  const project = currentProject();
  const name = project?.name ?? editor.state.project?.name ?? "Untitled Campaign";
  document.querySelector(".project-meta strong") && (document.querySelector(".project-meta strong").textContent = name);
  document.querySelector("[data-project-name]") && (document.querySelector("[data-project-name]").value = name);
  document.querySelector("#export-title") && (document.querySelector("#export-title").textContent = name);
}

function openProject(projectId) {
  const project = projectLibrary.find((item) => item.id === projectId);
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

function manualSaveProject({ saveAs = false } = {}) {
  const project = currentProject();
  if (!project) return;
  const state = editor.serialize();
  const target = saveAs ? duplicateProjectRecord({ ...project, state }, `${project.name} Copy`) : project;
  target.state = state;
  target.updatedAt = new Date().toISOString();
  target.manualSavedAt = target.updatedAt;
  target.thumbnail = createProjectThumbnailFromDom(target.name);
  if (saveAs) {
    projectLibrary.unshift(target);
    activeProjectId = target.id;
  }
  editor.setProjectMetadata({ id: target.id, name: target.name, settings: target.settings, thumbnail: target.thumbnail });
  createProjectVersion({ type: "manual", comment: saveAs ? "Save As checkpoint" : "Manual save checkpoint" });
  persistProjectLibrary();
  syncProjectHeader();
  renderProjectManager();
  showToast(saveAs ? "Project saved as copy" : "Project saved manually");
}

function folderName(folderId) {
  return projectFolders.find((folder) => folder.id === folderId)?.name ?? "All Projects";
}

function projectFolderPath(folderId) {
  const path = [];
  let current = projectFolders.find((folder) => folder.id === folderId);
  while (current) {
    path.unshift(current);
    current = projectFolders.find((folder) => folder.id === current.parentId);
  }
  return path.length ? path : [projectFolders.find((folder) => folder.id === "root")].filter(Boolean);
}

function projectMatchesSearch(value) {
  return !projectSearchQuery || String(value).toLowerCase().includes(projectSearchQuery);
}

function filteredProjectItems(folderId) {
  const folderIds = folderId === "root" ? new Set(projectFolders.map((folder) => folder.id)) : new Set([folderId]);
  return projectLibrary.filter((project) => {
    if (projectViewMode === "recycle") return Boolean(project.deletedAt);
    if (project.deletedAt) return false;
    if (projectViewMode === "favorites" && !project.favorite) return false;
    if (projectViewMode === "recent" && Date.now() - new Date(project.lastOpenedAt ?? project.updatedAt).getTime() > 1000 * 60 * 60 * 24 * 14) return false;
    return folderIds.has(project.folderId ?? "root");
  }).filter((project) => projectMatchesSearch(`${project.name} ${folderName(project.folderId)} ${project.settings?.colorSpace ?? ""}`)).sort((a, b) => {
    if (projectSortMode === "name") return a.name.localeCompare(b.name);
    if (projectSortMode === "created") return new Date(b.createdAt) - new Date(a.createdAt);
    if (projectSortMode === "duration") return (b.state?.duration ?? 0) - (a.state?.duration ?? 0);
    return new Date(b.lastOpenedAt ?? b.updatedAt) - new Date(a.lastOpenedAt ?? a.updatedAt);
  });
}

function renderFolderTree(parentId = "root", depth = 0) {
  return projectFolders
    .filter((folder) => !folder.deletedAt && folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((folder) => `
      <button class="${folder.id === activeProjectFolderId ? "active" : ""}${folder.favorite ? " favorite" : ""}" style="--folder-depth:${depth}" data-project-folder="${folder.id}">
        <span>${escapeHtml(folder.name)}</span><em>${projectLibrary.filter((project) => project.folderId === folder.id && !project.deletedAt).length}</em>
      </button>
      ${renderFolderTree(folder.id, depth + 1)}
    `).join("");
}

function renderProjectManager() {
  const grid = document.querySelector("[data-project-grid]");
  const recent = document.querySelector("[data-recent-projects]");
  const recovery = document.querySelector("[data-recovery-list]");
  if (!grid || !recent || !recovery) return;
  const visible = projectLibrary.filter((project) => !project.deletedAt);
  grid.innerHTML = visible.map((project) => `
    <article class="project-card${project.id === activeProjectId ? " active" : ""}" data-project-id="${project.id}">
      <div class="project-thumb" style="--thumb-hue:${project.thumbnail?.hue ?? 190}"><span>${project.thumbnail?.label ?? "PR"}</span></div>
      <div><strong>${project.name}</strong><span>${project.settings?.width ?? 3840}x${project.settings?.height ?? 2160} · ${project.settings?.fps ?? 30} fps</span></div>
      <div class="project-card-actions">
        <button data-project-card-action="open">Open</button>
        <button data-project-card-action="duplicate">Duplicate</button>
        <button data-project-card-action="delete">Delete</button>
      </div>
    </article>
  `).join("");
  recent.innerHTML = visible.slice(0, 5).map((project) => `<article data-project-id="${project.id}"><strong>${escapeHtml(project.name)}</strong><span>${new Date(project.updatedAt).toLocaleString()} · ${project.manualSavedAt ? "Manual save" : "Auto save"}</span></article>`).join("") || '<div class="export-empty">No recent projects.</div>';
  recovery.innerHTML = recoverySnapshots.map((item) => `<article data-recovery-id="${item.id}"><strong>${escapeHtml(projectLibrary.find((project) => project.id === item.projectId)?.name ?? "Recovered Project")}</strong><span>${new Date(item.createdAt).toLocaleString()} · ${item.reason}</span><button data-recovery-restore="${item.id}">Restore</button></article>`).join("") || '<div class="export-empty">No recovery snapshots.</div>';
  document.querySelector("[data-project-count]").textContent = `${visible.length} project${visible.length === 1 ? "" : "s"}`;
  document.querySelector("[data-recovery-count]").textContent = `${recoverySnapshots.length} snapshot${recoverySnapshots.length === 1 ? "" : "s"}`;
  const project = currentProject();
  if (project) {
    document.querySelector("[data-project-name]").value = project.name;
    document.querySelector("[data-project-setting=\"fps\"]").value = String(project.settings?.fps ?? 30);
    document.querySelector("[data-project-setting=\"resolution\"]").value = `${project.settings?.width ?? 3840}x${project.settings?.height ?? 2160}`;
    document.querySelector("[data-project-setting=\"colorSpace\"]").value = project.settings?.colorSpace ?? "Rec.709";
  }
}

function startInlineProjectRename(container, target, kind = "project") {
  const title = container?.querySelector("strong");
  if (!title || !target) return;
  const input = document.createElement("input");
  input.className = "project-inline-rename";
  input.value = target.name;
  title.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    const nextName = input.value.trim() || target.name;
    target.name = nextName;
    target.updatedAt = new Date().toISOString();
    if (kind === "project") {
      target.thumbnail = createProjectThumbnailFromDom(target.name);
      if (target.id === activeProjectId) {
        editor.setProjectMetadata({ name: target.name, thumbnail: target.thumbnail });
        syncProjectHeader();
      }
    }
    persistProjectLibrary();
    renderProjectManager();
    showToast(`${kind === "folder" ? "Folder" : "Project"} renamed`);
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") renderProjectManager();
  });
  input.addEventListener("blur", commit, { once: true });
}

renderProjectManager = function renderProjectFileManager() {
  const grid = document.querySelector("[data-project-grid]");
  const recent = document.querySelector("[data-recent-projects]");
  const recovery = document.querySelector("[data-recovery-list]");
  const tree = document.querySelector("[data-project-folder-tree]");
  const recycle = document.querySelector("[data-project-recycle]");
  const crumbs = document.querySelector("[data-project-breadcrumbs]");
  if (!grid || !recent || !recovery || !tree || !recycle || !crumbs) return;
  const liveFolders = projectFolders.filter((folder) => !folder.deletedAt);
  if (!liveFolders.some((folder) => folder.id === activeProjectFolderId)) activeProjectFolderId = "root";
  const childFolders = liveFolders
    .filter((folder) => folder.parentId === activeProjectFolderId && folder.id !== "root")
    .filter((folder) => projectMatchesSearch(folder.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const visible = filteredProjectItems(activeProjectFolderId);
  grid.innerHTML = [
    ...childFolders.map((folder) => `
      <article class="project-folder-card" draggable="true" data-project-folder-id="${folder.id}">
        <div class="folder-icon"></div>
        <div><strong>${escapeHtml(folder.name)}</strong><span>${projectLibrary.filter((project) => project.folderId === folder.id && !project.deletedAt).length} projects</span></div>
        <div class="project-card-actions">
          <button data-folder-card-action="open">Open</button>
          <button data-folder-card-action="rename">Rename</button>
          <button data-folder-card-action="delete">Delete</button>
        </div>
      </article>
    `),
    ...visible.map((project) => `
      <article class="project-card${project.id === activeProjectId ? " active" : ""}${project.favorite ? " favorite" : ""}" draggable="true" data-project-id="${project.id}">
        <div class="project-thumb" style="--thumb-hue:${project.thumbnail?.hue ?? 190}"><span>${project.thumbnail?.label ?? "PR"}</span></div>
        <div><strong>${escapeHtml(project.name)}</strong><span>${project.settings?.width ?? 3840}x${project.settings?.height ?? 2160} - ${project.settings?.fps ?? 30} fps - ${folderName(project.folderId)}</span></div>
        <div class="project-card-actions">
          <button data-project-card-action="open">Open</button>
          <button data-project-card-action="favorite">${project.favorite ? "Unfavorite" : "Favorite"}</button>
          <button data-project-card-action="rename">Rename</button>
          <button data-project-card-action="duplicate">Duplicate</button>
          <button data-project-card-action="${project.deletedAt ? "restore" : "delete"}">${project.deletedAt ? "Restore" : "Delete"}</button>
        </div>
      </article>
    `)
  ].join("") || '<div class="export-empty project-empty">No projects or folders match this view.</div>';
  tree.innerHTML = `<button class="${activeProjectFolderId === "root" ? "active" : ""}" style="--folder-depth:0" data-project-folder="root"><span>All Projects</span><em>${projectLibrary.filter((project) => !project.deletedAt).length}</em></button>${renderFolderTree("root", 1)}`;
  crumbs.innerHTML = projectFolderPath(activeProjectFolderId).map((folder) => `<button data-project-breadcrumb="${folder.id}">${escapeHtml(folder.name)}</button>`).join("<span>/</span>");
  const liveProjects = projectLibrary.filter((project) => !project.deletedAt);
  const deletedProjects = projectLibrary.filter((project) => project.deletedAt);
  recent.innerHTML = [...liveProjects].sort((a, b) => new Date(b.lastOpenedAt ?? b.updatedAt) - new Date(a.lastOpenedAt ?? a.updatedAt)).slice(0, 5).map((project) => `<article data-project-id="${project.id}"><strong>${escapeHtml(project.name)}</strong><span>${new Date(project.updatedAt).toLocaleString()} - ${project.manualSavedAt ? "Manual save" : "Auto save"}</span></article>`).join("") || '<div class="export-empty">No recent projects.</div>';
  recycle.innerHTML = deletedProjects.map((project) => `<article data-project-id="${project.id}"><strong>${escapeHtml(project.name)}</strong><span>Deleted ${new Date(project.deletedAt).toLocaleString()}</span><button data-project-card-action="restore">Restore</button></article>`).join("") || '<div class="export-empty">Recycle bin is empty.</div>';
  recovery.innerHTML = recoverySnapshots.map((item) => `<article data-recovery-id="${item.id}"><strong>${escapeHtml(projectLibrary.find((project) => project.id === item.projectId)?.name ?? "Recovered Project")}</strong><span>${new Date(item.createdAt).toLocaleString()} - ${item.reason}</span><button data-recovery-restore="${item.id}">Restore</button></article>`).join("") || '<div class="export-empty">No recovery snapshots.</div>';
  document.querySelector("[data-project-count]").textContent = `${liveProjects.length} project${liveProjects.length === 1 ? "" : "s"}`;
  document.querySelector("[data-project-folder-count]").textContent = `${liveFolders.length} folder${liveFolders.length === 1 ? "" : "s"}`;
  document.querySelector("[data-project-bin-count]").textContent = `${deletedProjects.length} deleted`;
  document.querySelector("[data-recovery-count]").textContent = `${recoverySnapshots.length} snapshot${recoverySnapshots.length === 1 ? "" : "s"}`;
  const project = currentProject();
  if (project) {
    document.querySelector("[data-project-name]").value = project.name;
    document.querySelector("[data-project-setting=\"fps\"]").value = String(project.settings?.fps ?? 30);
    document.querySelector("[data-project-setting=\"resolution\"]").value = `${project.settings?.width ?? 3840}x${project.settings?.height ?? 2160}`;
    document.querySelector("[data-project-setting=\"colorSpace\"]").value = project.settings?.colorSpace ?? "Rec.709";
  }
  renderVersionHistory();
  renderSyncStatus();
};

function clipElement(id) {
  const cached = clipElementCache.get(id);
  if (cached && cached.isConnected) return cached;
  const el = document.querySelector(`[data-clip-id="${id}"]`);
  if (el) clipElementCache.set(id, el);
  else clipElementCache.delete(id);
  return el;
}

function syncClipToDom(clip) {
  const element = clipElement(clip.id);
  if (!element) return;
  if (element.classList.contains("dragging") || element.classList.contains("trimming")) return;
  element.style.setProperty("--start", (clip.timelineStart ?? clip.start).toFixed(2));
  element.style.setProperty("--length", clip.duration.toFixed(2));
  element.classList.toggle("selected", editor.state.selectedClipIds.includes(clip.id));
  element.classList.toggle("layer-hidden", Boolean(clip.hidden));
  element.classList.toggle("layer-locked", Boolean(clip.locked));
  element.classList.toggle("layer-solo", Boolean(clip.solo));
  element.style.opacity = String(clip.opacity ?? 1);
  element.style.transform = `translateY(${element.classList.contains("dragging") ? "-1px" : "0"}) scale(${clip.transform?.scale ?? 1}) rotate(${clip.transform?.rotate ?? 0}deg)`;
  element.dataset.speed = clip.speed;
  element.dataset.blendMode = clip.blendMode;
  element.dataset.colorLabel = clip.colorLabel ?? "";
}

function syncEditorToDom() {
  editor.state.clips.forEach(syncClipToDom);
  if (timelineEditor) timelineEditor.querySelectorAll(".edit-clip, .caption-block").forEach((element) => {
    element.classList.toggle("selected", editor.state.selectedClipIds.includes(element.dataset.clipId));
  });
  if (!playing) {
    const active = editor.previewFrame().at(-1);
    if (active) {
      document.querySelector(".scene-kicker").textContent = active.name;
      document.querySelector(".meter-chip").textContent = `${active.type} · ${active.blendMode}`;
    }
    const selected = editor.selectedClips[0];
    if (selected) {
      document.querySelector(".layer-identity strong").textContent = selected.name;
      document.querySelector(".layer-identity span").textContent = `${selected.type} layer`;
    }
    renderLayerManager();
    renderKeyframePanel();
    renderTransitionPanel();
    renderEffectsPanel();
    syncColorPanelFromClip();
    syncTextPanelFromClip();
    syncCaptionPanelFromClip();
    syncAudioPanelFromClip();
  }
}

function syncPlaybackDom() {
  const active = editor.previewFrame().at(-1);
  if (active) {
    document.querySelector(".scene-kicker").textContent = active.name;
    document.querySelector(".meter-chip").textContent = `${active.type} - ${active.blendMode}`;
  }
}

function layerColorClass(label = "") {
  return String(label || "Ice").toLowerCase().replace(/\s+/g, "-");
}

function sortedLayerClips() {
  const trackOrder = new Map(editor.state.tracks.map((track) => [track.id, track.order]));
  return [...editor.state.clips].sort((a, b) => ((b.layer ?? trackOrder.get(b.trackId) ?? 0) - (a.layer ?? trackOrder.get(a.trackId) ?? 0)) || ((b.timelineStart ?? b.start) - (a.timelineStart ?? a.start)));
}

function layerTypeLabel(clip) {
  if (clip.type === "caption") return "Caption";
  if (clip.type === "text") return "Text";
  if (clip.type === "audio") return "Audio";
  if (clip.type === "image") return "Image";
  if (clip.type === "effect") return "Effect";
  return "Video";
}

function groupName(groupId) {
  if (!groupId) return null;
  const groupClips = editor.state.clips.filter((clip) => clip.groupId === groupId);
  return groupClips[0]?.groupName ?? `Group ${groupId.slice(-4)}`;
}

function renderLayerManager() {
  const list = document.querySelector("[data-layer-manager]");
  if (!list) return;
  const layers = sortedLayerClips();
  const seenGroups = new Set();
  list.innerHTML = layers.map((clip) => {
    const selected = editor.state.selectedClipIds.includes(clip.id);
    const groupHeader = clip.groupId && !seenGroups.has(clip.groupId)
      ? (seenGroups.add(clip.groupId), `<div class="layer-group-row" data-layer-group="${clip.groupId}"><span>${escapeHtml(groupName(clip.groupId))}</span><em>${editor.state.clips.filter((item) => item.groupId === clip.groupId).length} layers</em></div>`)
      : "";
    return `${groupHeader}<button class="layer-row ${selected ? "active" : ""} ${clip.hidden ? "hidden-layer" : ""} ${clip.locked ? "locked-layer" : ""} color-${layerColorClass(clip.colorLabel)}" draggable="true" data-layer-id="${clip.id}" data-layer-name="${escapeHtml(clip.name)}" data-layer-type="${layerTypeLabel(clip)} layer">
      <i></i>
      <div><strong>${escapeHtml(clip.name)}</strong><span>${layerTypeLabel(clip)} - ${formatDuration(clip.duration)}${clip.groupId ? ` - ${escapeHtml(groupName(clip.groupId))}` : ""}</span></div>
      <em>${clip.solo ? "S" : ""}${clip.hidden ? "H" : ""}${clip.locked ? "L" : ""}</em>
    </button>`;
  }).join("") || '<div class="layer-empty">No layers in timeline.</div>';
  const selected = editor.selectedClips[0];
  document.querySelector("[data-layer-action=\"hide\"]")?.classList.toggle("active", !selected?.hidden);
  document.querySelector("[data-layer-action=\"lock\"]")?.classList.toggle("active", Boolean(selected?.locked));
  document.querySelector("[data-layer-action=\"solo\"]")?.classList.toggle("active", Boolean(selected?.solo));
}

function refreshLayerLiveUpdate(message = "Layer updated") {
  renderRevision += 1;
  syncEditorToDom();
  renderTimelineFromState();
  updateTimecode();
  showToast(message);
}

function persistTimelineEdit(reason = "timeline edit") {
  const project = currentProject();
  if (!project) return;
  project.state = editor.serialize();
  project.updatedAt = new Date().toISOString();
  editor.state.autosave = { ...(editor.state.autosave ?? {}), status: "saving", reason, updatedAt: project.updatedAt };
  persistProjectLibrary();
  markProjectSyncChange(reason);
}

function renameSelectedLayerInline(row, clip) {
  const title = row?.querySelector("strong");
  if (!title || !clip) return;
  const input = document.createElement("input");
  input.className = "layer-inline-rename";
  input.value = clip.name;
  title.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    editor.setClipProperties(clip.id, { name: input.value.trim() || clip.name });
    refreshLayerLiveUpdate("Layer renamed");
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") renderLayerManager();
  });
  input.addEventListener("blur", commit, { once: true });
}

function selectedPreviewTarget() {
  return document.querySelector(".scene-card");
}

function updateClipValue(prop, label) {
  const output = document.querySelector(`[data-clip-value="${prop}"]`);
  if (output) output.textContent = label;
}

function applyClipPreviewStyles(prop, value) {
  const target = selectedPreviewTarget();
  if (!target || !videoFrame) return;
  if (prop === "positionX") target.style.setProperty("--layer-x", `${value}px`);
  if (prop === "positionY") target.style.setProperty("--layer-y", `${value}px`);
  if (prop === "anchorX") target.style.setProperty("--layer-anchor-x", `${value}%`);
  if (prop === "anchorY") target.style.setProperty("--layer-anchor-y", `${value}%`);
  if (prop === "scale") target.style.setProperty("--layer-scale", (value / 100).toFixed(2));
  if (prop === "rotate") target.style.setProperty("--layer-rotate", `${value}deg`);
  if (prop === "motionBlur") target.style.setProperty("--layer-motion-blur", `${value / 10}px`);
  if (prop === "easingPreset") target.dataset.motionEase = value;
  if (prop === "opacity") target.style.setProperty("--layer-opacity", (value / 100).toFixed(2));
  if (prop === "crop") videoFrame.style.setProperty("--preview-crop", `${value}%`);
  if (prop === "blur") target.style.setProperty("--layer-blur", `${value}px`);
  if (prop === "shadow") target.style.setProperty("--layer-shadow", (value / 100).toFixed(2));
  if (prop === "border") target.style.setProperty("--layer-border", `${value}px`);
  if (prop === "color") videoFrame.style.setProperty("--preview-hue", `${(value - 50) * 1.8}deg`);
  if (prop === "blendMode") target.style.mixBlendMode = value;
  if (prop === "speed") previewStatus.textContent = `Layer speed ${(value / 100).toFixed(2)}x`;
  if (prop === "volume") {
    videoFrame.style.setProperty("--preview-volume", (value / 100).toFixed(2));
    document.querySelector(".meter-chip").textContent = value === 0 ? "Muted selected layer" : `Layer volume ${value}%`;
  }
  if (prop === "fadeIn") videoFrame.style.setProperty("--preview-fade-in", (value / 300).toFixed(2));
  if (prop === "fadeOut") videoFrame.style.setProperty("--preview-fade-out", (value / 300).toFixed(2));
  videoFrame.classList.toggle("has-crop", Number.parseFloat(getComputedStyle(videoFrame).getPropertyValue("--preview-crop")) > 0);
}

function applyAnimatedPreviewFrame() {
  const frameKey = `${renderRevision}:${Math.round(editor.state.time * editor.state.fps)}:${editor.state.canvasZoom}:${playbackSpeed}`;
  const frame = previewFrameCache.get(frameKey) ?? previewFrameCache.set(frameKey, editor.renderFrame(editor.state.time));
  const layer = frame.layers.at(-1);
  const target = selectedPreviewTarget();
  if (!layer || !target || !videoFrame) return;
  target.style.setProperty("--layer-x", `${layer.transform.x}px`);
  target.style.setProperty("--layer-y", `${layer.transform.y}px`);
  target.style.setProperty("--layer-scale", String(layer.transform.scale));
  target.style.setProperty("--layer-rotate", `${layer.transform.rotate}deg`);
  target.style.setProperty("--layer-anchor-x", `${Math.round((layer.transform.anchorX ?? 0.5) * 100)}%`);
  target.style.setProperty("--layer-anchor-y", `${Math.round((layer.transform.anchorY ?? 0.5) * 100)}%`);
  target.style.setProperty("--layer-motion-blur", `${Number(layer.transform.motionBlur ?? 0) / 10}px`);
  target.dataset.motionEase = layer.transform.easingPreset ?? "smooth";
  target.style.setProperty("--layer-opacity", String(layer.opacity));
  videoFrame.style.setProperty("--preview-crop", layer.transform.crop ? `${Math.round((layer.transform.crop.x ?? 0) * 100)}%` : "0%");
  const blur = layer.effects.find((effect) => effect.type === "blur")?.parameters?.radius ?? 0;
  target.style.setProperty("--layer-blur", `${blur}px`);
  const fx = layer.effectPreview ?? {};
  target.style.setProperty("--effect-glow", `${fx.glow ?? 0}`);
  target.style.setProperty("--effect-shadow-opacity", `${(fx.shadowOpacity ?? 0) / 100}`);
  target.style.setProperty("--effect-shadow-distance", `${fx.shadowDistance ?? 0}px`);
  target.style.setProperty("--effect-shadow-blur", `${fx.shadowBlur ?? 0}px`);
  videoFrame.style.setProperty("--effect-vignette", `${fx.vignette ?? 0}`);
  videoFrame.style.setProperty("--effect-noise", `${(fx.noise ?? 0) + (fx.grain ?? 0)}`);
  videoFrame.style.setProperty("--effect-bloom", `${fx.bloom ?? 0}`);
  videoFrame.style.setProperty("--effect-rgb", `${(fx.rgbSplit ?? 0) + (fx.chromaticAberration ?? 0)}px`);
  videoFrame.style.setProperty("--effect-contrast", `${1 + (fx.contrastBoost ?? 0)}`);
  const grade = layer.colorPreview ?? {};
  videoFrame.style.setProperty("--grade-brightness", grade.brightness ?? 1);
  videoFrame.style.setProperty("--grade-contrast", grade.contrast ?? 1);
  videoFrame.style.setProperty("--grade-saturation", grade.saturation ?? 1);
  videoFrame.style.setProperty("--grade-hue", `${grade.hue ?? 0}deg`);
  applyTextPreview(layer.textPreview);
  applyCaptionPreview(layer.captionPreview);
  applyAudioPreview(frame.audioMix);
  target.style.mixBlendMode = layer.blendMode;
  const transition = layer.activeTransitions?.at(-1);
  videoFrame.style.setProperty("--transition-overlay-opacity", transition?.overlay?.opacity ?? 0);
  videoFrame.style.setProperty("--transition-overlay-color", transition?.overlay?.color ?? "#000");
  target.style.setProperty("--transition-x", `${transition?.transform?.x ?? 0}px`);
  target.style.setProperty("--transition-y", `${transition?.transform?.y ?? 0}px`);
  target.style.setProperty("--transition-scale", transition?.transform?.scale ?? 1);
  target.style.setProperty("--transition-rotate", `${transition?.transform?.rotate ?? 0}deg`);
  target.style.setProperty("--transition-opacity", transition?.opacity ?? 1);
  target.style.setProperty("--transition-blur", `${transition?.blur ?? 0}px`);
  target.style.setProperty("--transition-clip-path", transition?.clipPath ?? "none");
}

function withTimelineDraft(clipId, patch, task) {
  const clip = editor.state.clips.find((item) => item.id === clipId);
  if (!clip) return task?.();
  const previous = {
    timelineStart: clip.timelineStart,
    start: clip.start,
    duration: clip.duration,
    trackId: clip.trackId,
  };
  Object.assign(clip, patch);
  try {
    return task?.();
  } finally {
    Object.assign(clip, previous);
  }
}

function applyCaptionPreview(caption) {
  const target = selectedPreviewTarget();
  if (!target || !caption) return;
  const heading = target.querySelector("h1");
  const activeWords = caption.words?.map((word) => word.active ? `<span class="caption-word active">${word.text}</span>` : `<span class="caption-word">${word.text}</span>`).join(" ") || caption.text;
  heading.innerHTML = caption.mode === "word" ? activeWords : caption.text;
  target.style.setProperty("--caption-speaker-color", caption.speakerColor ?? "#bfeeff");
  target.classList.toggle("caption-safe", Boolean(caption.safeZone));
  target.dataset.captionAnimation = caption.animation ?? "none";
  if (caption.safeZone) {
    const aspect = `${editor.state.width ?? 1920}:${editor.state.height ?? 1080}`;
    const safePos = captionSafePosition(aspect);
    Object.entries(safePos).forEach(([prop, value]) => {
      if (prop === "transform") heading.style.transform = value;
      else heading.style[prop] = value;
    });
  } else {
    heading.style.removeProperty("bottom");
    heading.style.removeProperty("left");
    heading.style.removeProperty("transform");
    heading.style.removeProperty("maxWidth");
  }
}

function applyTextPreview(preview) {
  const target = selectedPreviewTarget();
  if (!target) return;
  const heading = target.querySelector("h1");
  if (!preview) {
    target.classList.remove("text-kind-title", "text-kind-subtitle", "text-kind-caption", "text-kind-lower-third");
    return;
  }
  heading.textContent = preview.text || "Text layer";
  target.classList.remove("text-kind-title", "text-kind-subtitle", "text-kind-caption", "text-kind-lower-third");
  target.classList.add(`text-kind-${preview.kind}`);
  target.dataset.textAnimation = preview.animation;
  target.style.setProperty("--text-font-family", preview.fontFamily);
  target.style.setProperty("--text-font-weight", preview.fontWeight);
  target.style.setProperty("--text-font-size", preview.fontSize);
  target.style.setProperty("--text-letter-spacing", preview.letterSpacing);
  target.style.setProperty("--text-stroke-width", preview.strokeWidth);
  target.style.setProperty("--text-stroke-color", preview.strokeColor);
  target.style.setProperty("--text-shadow", preview.shadow);
  target.style.setProperty("--text-glow", preview.glow);
  target.style.setProperty("--text-bg-color", preview.backgroundColor);
  target.style.setProperty("--text-bg-opacity", preview.backgroundOpacity);
  target.style.setProperty("--text-align", preview.align);
  target.style.setProperty("--text-color", preview.color);
  target.style.setProperty("--text-pos-x", `${preview.posX ?? 50}%`);
  target.style.setProperty("--text-pos-y", `${preview.posY ?? 50}%`);
  target.style.setProperty("--text-scale", `${(preview.scale ?? 100) / 100}`);
  target.style.setProperty("--text-rotation", `${preview.rotation ?? 0}deg`);
  syncCanvasTextOverlay(preview);
}

function syncCanvasTextOverlay(preview) {
  const overlay = document.querySelector("[data-canvas-text-overlay]");
  const content = document.querySelector("[data-canvas-text-content]");
  if (!overlay || !content) return;
  if (!preview || !preview.text) {
    overlay.hidden = true;
    return;
  }
  overlay.hidden = false;
  content.textContent = preview.text;
  content.style.setProperty("--text-font-family", preview.fontFamily);
  content.style.setProperty("--text-font-weight", preview.fontWeight);
  content.style.setProperty("--text-font-size", preview.fontSize);
  content.style.setProperty("--text-letter-spacing", preview.letterSpacing);
  content.style.setProperty("--text-line-height", preview.lineHeight);
  content.style.setProperty("--text-stroke-width", preview.strokeWidth);
  content.style.setProperty("--text-stroke-color", preview.strokeColor);
  content.style.setProperty("--text-shadow", preview.shadow);
  content.style.setProperty("--text-glow", preview.glow);
  content.style.setProperty("--text-color", preview.color);
  content.style.setProperty("--text-align", preview.align);
  content.style.setProperty("--text-pos-x", `${preview.posX ?? 50}%`);
  content.style.setProperty("--text-pos-y", `${preview.posY ?? 50}%`);
  content.style.setProperty("--text-scale", `${(preview.scale ?? 100) / 100}`);
  content.style.setProperty("--text-rotation", `${preview.rotation ?? 0}deg`);
}

(function initCanvasTextOverlay() {
  const overlay = document.querySelector("[data-canvas-text-overlay]");
  const content = document.querySelector("[data-canvas-text-content]");
  if (!overlay || !content) return;
  let dragStart = null;
  let isEditing = false;

  content.addEventListener("dblclick", () => {
    const clip = selectedTextClip();
    if (!clip) return;
    isEditing = true;
    content.contentEditable = "true";
    content.focus();
    overlay.dataset.editing = "true";
    document.body.classList.add("is-dragging");
  });

  content.addEventListener("blur", () => {
    if (!isEditing) return;
    isEditing = false;
    content.contentEditable = "false";
    overlay.dataset.editing = "false";
    document.body.classList.remove("is-dragging");
    const clip = selectedTextClip();
    if (clip && content.textContent.trim()) {
      editor.setTextLayer({ text: content.textContent.trim() });
      syncTextPanelFromClip();
    }
  });

  content.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      content.blur();
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      content.blur();
    }
    e.stopPropagation();
  });

  overlay.addEventListener("mousedown", (e) => {
    if (isEditing) return;
    const clip = selectedTextClip();
    if (!clip) return;
    if (e.target === content || content.contains(e.target)) {
      dragStart = { x: e.clientX, y: e.clientY, posX: clip.textLayer?.style?.posX ?? 50, posY: clip.textLayer?.style?.posY ?? 50 };
      document.body.classList.add("is-dragging");
      e.preventDefault();
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragStart) return;
    const frame = document.querySelector(".video-frame");
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.x) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.y) / rect.height) * 100;
    const newX = Math.round(Math.max(0, Math.min(100, dragStart.posX + dx)));
    const newY = Math.round(Math.max(0, Math.min(100, dragStart.posY + dy)));
    editor.setTextStyle("posX", newX);
    editor.setTextStyle("posY", newY);
    syncTextPanelFromClip();
    applyAnimatedPreviewFrame();
  });

  document.addEventListener("mouseup", () => {
    if (dragStart) {
      dragStart = null;
      document.body.classList.remove("is-dragging");
    }
  });
})();

editor.subscribe(({ event }) => {
  if (!playing && !["playhead:seek", "canvas:zoom"].includes(event)) {
    renderRevision += 1;
    previewFrameCache.clear();
  }
  if (event === "player:ended") {
    playing = false;
    updateTransportControls();
    updateTimecode();
    renderTimelineFromState();
  }
  if (event.startsWith("clip:") || event.startsWith("history:") || event.startsWith("track:") || event.startsWith("transition:") || event.startsWith("effect:") || event.startsWith("keyframe:")) timelineRenderScheduler.request();
  else if (!["playhead:seek", "playback"].includes(event)) syncEditorToDom();
  if (event.startsWith("clip:") || event.startsWith("track:") || event.startsWith("keyframe:") || event.startsWith("history:undo") || event.startsWith("history:redo")) persistTimelineEdit(event);
  if (event.startsWith("ai:") || event.startsWith("history:")) aiRenderScheduler.request();
  if (event.startsWith("export:") || event.startsWith("history:")) exportRenderScheduler.request();
  if (event.startsWith("asset:") || event.startsWith("history:")) assetRenderScheduler.request();
  if (event.startsWith("error:")) {
    persistErrorState();
    renderErrorCenter();
  }
  if (settings.autosave && !event.startsWith("error:") && !["hydrate", "project:load", "playhead:seek", "playback", "canvas:zoom"].includes(event)) {
    clearManagedTimeout(editor.localSaveTimer);
    editor.localSaveTimer = managedTimeout(saveProjectLocal, Math.max(60, Number(settings.autosaveInterval ?? 180)) * 1000);
  }
  if (event === "autosave") {
    document.querySelector(".project-meta span").innerHTML = "<i></i> Saved just now";
    syncProjectHeader();
    renderProjectManager();
  }
});

function notificationTypeFromMessage(message) {
  const text = String(message).toLowerCase();
  if (text.includes("failed") || text.includes("error") || text.includes("blocked") || text.includes("missing")) return "error";
  if (text.includes("warning") || text.includes("locked") || text.includes("cannot") || text.includes("invalid")) return "warning";
  if (text.includes("complete") || text.includes("saved") || text.includes("created") || text.includes("added") || text.includes("updated")) return "success";
  if (text.includes("queued") || text.includes("running") || text.includes("rendering") || text.includes("upload")) return "progress";
  return "info";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatTimecode(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function notify({ message, title = null, type = "info", progress = null, duration = 3200, id = null } = {}) {
  return null;
}

function notificationTitle(type) {
  return ({ success: "Success", warning: "Warning", error: "Error", info: "Information", progress: "Progress" })[type] ?? "Information";
}

function dismissNotification(id) {
  const element = activeNotifications.get(id);
  if (!element) return;
  element.classList.remove("visible");
  clearManagedTimeout(element.dismissTimer);
  managedTimeout(() => element.remove(), 180);
  activeNotifications.delete(id);
}

function showToast(message, options = {}) {
  return notify({ message, type: options.type ?? notificationTypeFromMessage(message), title: options.title, progress: options.progress, duration: options.duration });
}

function persistErrorState() {
  try {
    localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(editor.state.errors));
    storageEngine.write("error", "state", editor.state.errors);
  } catch {
    document.body.classList.add("safe-mode");
  }
}

function renderErrorCenter() {
  const center = document.querySelector("[data-error-center]");
  if (center) center.hidden = true;
}

function reportUiError(error, context = {}) {
  const entry = editor.logError(error, { source: "runtime", severity: "error", userMessage: "The editor recovered safely.", ...context });
  persistErrorState();
  return entry;
}

function managedInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.add(id);
  return id;
}

function clearManagedInterval(id) {
  if (!id) return;
  clearInterval(id);
  activeIntervals.delete(id);
}

function managedTimeout(callback, delay) {
  const id = setTimeout(() => {
    activeTimeouts.delete(id);
    callback();
  }, delay);
  activeTimeouts.add(id);
  return id;
}

function clearManagedTimeout(id) {
  if (!id) return;
  clearTimeout(id);
  activeTimeouts.delete(id);
}

function clearTransientTimers() {
  activeIntervals.forEach((id) => clearInterval(id));
  activeTimeouts.forEach((id) => clearTimeout(id));
  activeIntervals.clear();
  activeTimeouts.clear();
  aiToolTimers.clear();
  mediaPreviewTimer = null;
  exportJobTimer = null;
}

function throttledToast(key, message, interval = 900) {
  const now = performance.now();
  const last = throttledToastState.get(key) ?? 0;
  if (now - last < interval) return;
  throttledToastState.set(key, now);
  showToast(message);
}

function setActiveWithin(selector, target) {
  if (!target) return;
  document.querySelectorAll(selector).forEach((item) => {
    item.classList.remove("active", "selected");
    if (item.matches("button")) {
      item.setAttribute("aria-selected", "false");
      if (item.matches(".toggle-pill, .mini-toggle, .track-mini")) item.setAttribute("aria-pressed", "false");
    }
  });
  target.classList.add(target.matches(".edit-clip, .caption-block") ? "selected" : "active");
  if (target.matches("button")) {
    target.setAttribute("aria-selected", "true");
    if (target.matches(".toggle-pill, .mini-toggle, .track-mini")) target.setAttribute("aria-pressed", "true");
  }
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}`;
}

function handlePlaybackEngineFrame(state, renderedFrame) {
  playing = state.playing;
  playbackSpeed = state.rate;
  previewVolume = state.volume;
  if (editor.state.playbackRate !== state.rate) editor.setPlaybackRate(state.rate);
  if (editor.state.canvasZoom !== state.canvasZoom) editor.setCanvasZoom(state.canvasZoom);
  if (editor.state.time !== state.time) editor.seek(state.time);
  if (editor.state.playing !== state.playing) editor.setPlaying(state.playing);
  if (renderedFrame) previewFrameCache.set(`${renderRevision}:${renderedFrame.frame}:${state.canvasZoom}:${state.rate}`, renderedFrame);
  updateTimecode();
}

function updateTransportControls() {
  document.querySelectorAll("[data-play-preview]").forEach((control) => {
    control.textContent = playing ? "Pause" : "Play";
    control.setAttribute("aria-pressed", String(playing));
  });
  videoFrame?.classList.toggle("is-playing", playing);
  const speedControl = document.querySelector("[data-playback-speed]");
  const zoomControl = document.querySelector("[data-canvas-zoom]");
  const volumeControl = document.querySelector("[data-preview-volume]");
  if (speedControl) speedControl.value = String(playbackSpeed);
  if (zoomControl) zoomControl.value = String(Math.round(editor.state.canvasZoom * 100));
  if (volumeControl) volumeControl.value = String(Math.round(previewVolume * 100));
}

function updateTimecode() {
  frame = editor.state.time;
  timecode.textContent = formatClock(frame);
  if (totalDuration) totalDuration.textContent = formatClock(editor.state.duration);
  renderPlayhead();
  if (previewStatus) previewStatus.textContent = playing ? `Playing ${playbackSpeed}x` : "GPU smooth";
  if (previewFps) previewFps.textContent = `${editor.state.fps * 2} fps`;
  videoFrame?.style.setProperty("--preview-progress", `${Math.min(100, Math.max(0, (frame / editor.state.duration) * 100))}%`);
  videoFrame?.style.setProperty("--preview-volume", previewVolume.toFixed(2));
  updatePreviewHUD();
  previewScheduler.request();
}

/* Renders the playhead purely from editor.state.time. This is the only place
   that writes the playhead's position, so playback, scrubbing, zooming and
   scrolling all stay in sync by definition. */
function renderPlayhead() {
  if (!cursor || !timelineEditor) return;
  const scroll = document.querySelector("[data-timeline-scroll]");
  const gutter = scroll ? scroll.offsetLeft : 168;
  const unit = rulerPixelsPerSecond();
  const time = Math.min(editor.state.duration, Math.max(0, editor.state.time));
  cursor.style.left = `${(gutter + time * unit).toFixed(2)}px`;
  // Span every track, not just the visible slice of the scroll container.
  cursor.style.height = `${Math.max(timelineEditor.scrollHeight, timelineEditor.clientHeight)}px`;
}

function isTextEditing() {
  const tagName = document.activeElement?.tagName;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(tagName) || document.activeElement?.isContentEditable;
}

function togglePlayback() {
  playback.configure({ fps: editor.state.fps, duration: editor.state.duration, time: editor.state.time, rate: playbackSpeed, canvasZoom: editor.state.canvasZoom });
  playback.toggle();
  showToast(playing ? "Preview playing" : "Preview paused");
}

document.querySelectorAll(".canvas-toolbar button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.overlayToggle) {
      const className = {
        safe: "show-safe",
        guides: "show-guides",
        grid: "show-grid",
      }[button.dataset.overlayToggle];
      button.classList.toggle("active");
      videoFrame.classList.toggle(className, button.classList.contains("active"));
      showToast(`${button.textContent} ${button.classList.contains("active") ? "shown" : "hidden"}`);
      return;
    }
    if (button.dataset.zoomPreset || button.dataset.zoomFit || button.dataset.fullscreenPreview) return;
    setActiveWithin(".canvas-toolbar button[data-canvas-preset]", button);
    showToast(`${button.textContent} canvas preset selected`);
  });
});

document.querySelector("[data-canvas-zoom]")?.addEventListener("input", (event) => {
  const zoom = Number(event.target.value) / 100;
  playback.setCanvasZoom(zoom);
  editor.setCanvasZoom(zoom);
  videoFrame.style.setProperty("--canvas-zoom", zoom.toFixed(2));
  updateZoomPresetUI(Math.round(zoom * 100));
  throttledToast("canvas-zoom", `Canvas zoom ${event.target.value}%`, 800);
});

function setCanvasZoom(percent) {
  const zoom = Math.max(25, Math.min(200, percent)) / 100;
  playback.setCanvasZoom(zoom);
  editor.setCanvasZoom(zoom);
  videoFrame.style.setProperty("--canvas-zoom", zoom.toFixed(2));
  const slider = document.querySelector("[data-canvas-zoom]");
  if (slider) slider.value = Math.round(zoom * 100);
  updateZoomPresetUI(Math.round(zoom * 100));
}

function updateZoomPresetUI(activePercent) {
  document.querySelectorAll("[data-zoom-preset]").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.zoomPreset) === activePercent);
  });
}

document.querySelectorAll("[data-zoom-preset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const percent = Number(btn.dataset.zoomPreset);
    setCanvasZoom(percent);
    showToast(`Canvas zoom ${percent}%`);
  });
});

document.querySelector("[data-zoom-fit]")?.addEventListener("click", () => {
  const viewerEl = document.querySelector(".viewer");
  if (!viewerEl || !videoFrame) return;
  const vw = viewerEl.clientWidth - 32;
  const vh = viewerEl.clientHeight - 32;
  const fitScale = Math.min(vw / 960, vh / 540, 1);
  const percent = Math.round(fitScale * 100);
  setCanvasZoom(percent);
  showToast(`Fit to screen (${percent}%)`);
});

/* ── Resizable Preview ────────────────────────────────── */
const resizeHandle = document.querySelector("[data-preview-resize]");
if (resizeHandle) {
  let resizing = false;
  let startX, startY, startW, startH;
  resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = videoFrame.offsetWidth;
    startH = videoFrame.offsetHeight;
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
  });
  document.addEventListener("mousemove", (e) => {
    if (!resizing) return;
    const dx = e.clientX - startX;
    const newW = Math.max(320, Math.min(startW + dx, 1600));
    const newH = newW * 9 / 16;
    videoFrame.style.width = `${newW}px`;
    videoFrame.style.height = `${newH}px`;
    videoFrame.style.maxWidth = "none";
    videoFrame.style.aspectRatio = "unset";
  });
  document.addEventListener("mouseup", () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}

/* ── Preview HUD: Frame / Resolution / GPU ────────────── */
const hudFrame = document.querySelector("[data-preview-frame]");
const hudResolution = document.querySelector("[data-preview-resolution]");
const hudGpu = document.querySelector("[data-preview-gpu]");
const previewFrame = document.querySelector(".video-frame");

function updatePreviewHUD() {
  const fps = editor.state.fps || 30;
  const currentFrame = Math.round(editor.state.time * fps);
  if (hudFrame) hudFrame.textContent = `Frame ${currentFrame}`;
  if (hudResolution) {
    const w = editor.state.width || 1920;
    const h = editor.state.height || 1080;
    hudResolution.textContent = `${w}×${h}`;
  }
  if (hudGpu) {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "WebGL";
        hudGpu.textContent = gpu.length > 24 ? gpu.slice(0, 22) + "…" : gpu;
      } else {
        hudGpu.textContent = "Software";
      }
    } catch {
      hudGpu.textContent = "WebGL";
    }
  }
}

updatePreviewHUD();

/* ── Media Loaded: Instant Preview Activation ─────────── */
function activateMediaPreview() {
  if (!previewFrame) return;
  previewFrame.classList.add("media-loaded");
  const ew = previewFrame.querySelector(".empty-workspace");
  if (ew) ew.style.display = "none";
  const overlays = previewFrame.querySelectorAll(".safe-zone-overlay, .guide-overlay, .render-scanline, .frame-glow, .ambient-ring");
  overlays.forEach((el) => { el.style.display = ""; });
  const timelineEmpty = document.querySelector("[data-timeline-empty-state]");
  if (timelineEmpty) timelineEmpty.hidden = true;
}

function deactivateMediaPreview() {
  if (!previewFrame) return;
  previewFrame.classList.remove("media-loaded");
  const ew = previewFrame.querySelector(".empty-workspace");
  if (ew) ew.style.display = "";
  const overlays = previewFrame.querySelectorAll(".safe-zone-overlay, .guide-overlay, .render-scanline, .frame-glow, .ambient-ring");
  overlays.forEach((el) => { el.style.display = "none"; });
  const canvasOverlay = document.querySelector("[data-canvas-text-overlay]");
  if (canvasOverlay) canvasOverlay.hidden = true;
  const hasClips = editor.state.clips.length > 0;
  const timelineEmpty = document.querySelector("[data-timeline-empty-state]");
  if (timelineEmpty) timelineEmpty.hidden = hasClips;
}

/* Observe timeline for media presence */
document.querySelector("[data-media-upload]")?.addEventListener("change", () => {
  managedTimeout(() => activateMediaPreview(), 800);
});

/* Also activate when clips exist on render */
document.addEventListener("editor:state-change", () => {
  const hasClips = editor.state.tracks.some((t) => t.clips.length > 0);
  if (hasClips) activateMediaPreview();
  else deactivateMediaPreview();
  const timelineEmpty = document.querySelector("[data-timeline-empty-state]");
  if (timelineEmpty) timelineEmpty.hidden = editor.state.clips.length > 0;
});

document.querySelector("[data-playback-speed]")?.addEventListener("change", (event) => {
  playbackSpeed = playback.setRate(Number(event.target.value));
  editor.setPlaybackRate(playbackSpeed);
  showToast(`Playback speed ${playbackSpeed}x`);
  updateTimecode();
});

document.querySelector("[data-preview-volume]")?.addEventListener("input", (event) => {
  previewVolume = playback.setVolume(Number(event.target.value) / 100);
  videoFrame.style.setProperty("--preview-volume", previewVolume.toFixed(2));
  document.querySelector(".meter-chip").textContent = previewVolume === 0 ? "Muted preview" : `Preview volume ${event.target.value}%`;
  throttledToast("preview-volume", `Preview volume ${event.target.value}%`, 900);
});

document.querySelector("[data-fullscreen-preview]")?.addEventListener("click", async () => {
  videoFrame.classList.toggle("preview-fullscreen");
  try {
    if (!document.fullscreenElement && videoFrame.requestFullscreen) await videoFrame.requestFullscreen();
    else if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
  } catch {
    showToast(videoFrame.classList.contains("preview-fullscreen") ? "Fullscreen preview simulated" : "Fullscreen closed");
    playback.setFullscreen(videoFrame.classList.contains("preview-fullscreen"));
    return;
  }
  playback.setFullscreen(Boolean(document.fullscreenElement));
  showToast(document.fullscreenElement ? "Fullscreen preview" : "Fullscreen closed");
});

document.addEventListener("fullscreenchange", () => {
  videoFrame.classList.toggle("preview-fullscreen", document.fullscreenElement === videoFrame);
  playback.setFullscreen(document.fullscreenElement === videoFrame);
});

function selectedTrackForShortcut() {
  const clip = editor.selectedClips[0];
  return clip ? editor.state.tracks.find((track) => track.id === clip.trackId) : null;
}

function toggleSelectedTrackLock() {
  const track = selectedTrackForShortcut();
  if (!track) return showToast("Select a clip to lock its track");
  editor.setTrackState(track.id, { locked: !track.locked });
  renderTimelineFromState();
  showToast(`${track.name} ${track.locked ? "unlocked" : "locked"}`);
}

function toggleSelectedMute() {
  const clip = selectedAudioClip();
  if (clip) {
    editor.selectClip(clip.id);
    editor.setMute(!clip.audio?.muted);
    syncAudioPanelFromClip();
    showToast(clip.audio?.muted ? "Audio muted" : "Audio unmuted");
    return;
  }
  const track = selectedTrackForShortcut();
  if (track?.type === "audio") {
    editor.setTrackAudio(track.id, { muted: !track.muted });
    showToast(`${track.name} ${track.muted ? "unmuted" : "muted"}`);
  }
}

function toggleSelectedTrackSolo() {
  const track = selectedTrackForShortcut();
  if (!track) return showToast("Select a clip to solo its track");
  editor.soloTrack(track.id);
  renderTimelineFromState();
  showToast(track.solo ? `${track.name} soloed` : `Solo off — all tracks visible`);
}

function nudgeSelectedClips(delta) {
  editor.selectedClips.forEach((clip) => editor.moveClip(clip.id, (clip.timelineStart ?? clip.start) + delta));
  renderTimelineFromState();
  updateTimecode();
}

function setTimelineZoom(nextZoom, centerOnPlayhead = true) {
  const prevZoom = timelineZoom;
  timelineZoom = Math.max(0.45, Math.min(3.5, nextZoom));
  if (centerOnPlayhead && prevZoom !== timelineZoom) {
    const scrollArea = document.querySelector("[data-timeline-scroll]");
    if (scrollArea) {
      const playheadTime = playback.currentTime ?? editor.state.time ?? 0;
      const unit = timelinePixelsPerSecond();
      const playheadX = playheadTime * unit;
      const viewportCenter = scrollArea.scrollLeft + scrollArea.clientWidth / 2;
      const ratio = viewportCenter / (prevZoom !== 0 ? (unit / prevZoom) * playheadTime || 1 : 1);
      const newUnit = 16 * timelineZoom;
      const newPlayheadX = playheadTime * newUnit;
      const newScrollLeft = Math.max(0, newPlayheadX - scrollArea.clientWidth / 2);
      document.documentElement.style.setProperty("--timeline-zoom", timelineZoom.toFixed(2));
      timelineEditor.style.setProperty("--zoom", timelineZoom.toFixed(2));
      editor.setZoom(timelineZoom);
      updateTimelineRuler();
      scrollArea.scrollLeft = newScrollLeft;
    } else {
      document.documentElement.style.setProperty("--timeline-zoom", timelineZoom.toFixed(2));
      timelineEditor.style.setProperty("--zoom", timelineZoom.toFixed(2));
      editor.setZoom(timelineZoom);
      updateTimelineRuler();
    }
  } else {
    document.documentElement.style.setProperty("--timeline-zoom", timelineZoom.toFixed(2));
    timelineEditor.style.setProperty("--zoom", timelineZoom.toFixed(2));
    editor.setZoom(timelineZoom);
    updateTimelineRuler();
  }
  timelineRenderScheduler.request();
  showToast(`Timeline zoom ${Math.round(timelineZoom * 100)}%`);
}

function shortcutActions(action) {
  const actions = {
    copy: () => { editor.copySelected(); showToast("Selected clips copied"); },
    cut: () => { editor.copySelected(); editor.deleteSelected(); renderTimelineFromState(); showToast("Clips cut"); },
    paste: () => { editor.paste(editor.state.time); renderTimelineFromState(); showToast("Clips pasted"); },
    duplicate: () => { editor.duplicateSelected(); renderTimelineFromState(); showToast("Selected clips duplicated"); },
    group: () => { editor.groupSelected(); showToast("Selected clips grouped"); },
    ungroup: () => { editor.ungroupSelected(); renderTimelineFromState(); showToast("Selected clips ungrouped"); },
    undo: () => { editor.undo(); updateTimecode(); renderTimelineFromState(); showToast("Undo applied", { type: "info", title: "Undo" }); },
    redo: () => { editor.redo(); updateTimecode(); renderTimelineFromState(); showToast("Redo applied", { type: "info" }); },
    delete: () => { editor.deleteSelected(); renderTimelineFromState(); showToast("Deleted selected clips"); },
    rippleDelete: () => { editor.deleteSelected({ ripple: true }); renderTimelineFromState(); showToast("Ripple delete applied"); },
    playPause: () => togglePlayback(),
    split: () => { editor.splitSelected(editor.state.time); renderTimelineFromState(); showToast("Split at playhead"); },
    mute: () => toggleSelectedMute(),
    lock: () => toggleSelectedTrackLock(),
    solo: () => toggleSelectedTrackSolo(),
    reverse: () => { editor.reverseSelected(); showToast("Reverse toggled on selected clips"); },
    freezeFrame: () => { editor.freezeFrameSelected(); showToast("Freeze frame added at playhead"); },
    selectAll: () => { editor.state.selectedClipIds = editor.state.clips.map((c) => c.id); syncEditorToDom(); showToast(`Selected all ${editor.state.clips.length} clips`); },
    deselectAll: () => { editor.clearSelection(); syncEditorToDom(); showToast("Selection cleared"); },
    stepLeft: () => {
      playback.configure({ fps: editor.state.fps, duration: editor.state.duration, time: editor.state.time, rate: playbackSpeed, canvasZoom: editor.state.canvasZoom });
      playback.step(-1);
      updateTimecode();
    },
    stepRight: () => {
      playback.configure({ fps: editor.state.fps, duration: editor.state.duration, time: editor.state.time, rate: playbackSpeed, canvasZoom: editor.state.canvasZoom });
      playback.step(1);
      updateTimecode();
    },
    moveLeft: () => nudgeSelectedClips(-1 / editor.state.fps),
    moveRight: () => nudgeSelectedClips(1 / editor.state.fps),
    zoomIn: () => setTimelineZoom(timelineZoom + 0.15),
    zoomOut: () => setTimelineZoom(timelineZoom - 0.15),
    zoomToFit: () => { editor.zoomToFit(); setTimelineZoom(editor.state.zoom); showToast("Zoomed to fit"); },
    zoomToSelection: () => { editor.zoomToSelection(); setTimelineZoom(editor.state.zoom); showToast("Zoomed to selection"); },
    disableClip: () => { editor.selectedClips.forEach((c) => editor.toggleClipDisabled(c.id)); renderTimelineFromState(); showToast("Clip visibility toggled"); },
    fullscreen: () => document.querySelector("[data-fullscreen-preview]")?.click(),
    export: () => openExportModal(),
  };
  actions[action]?.();
}

function handleShortcutEvent(event) {
  if (recordingShortcutAction) {
    event.preventDefault();
    const shortcut = normalizeShortcut(event);
    if (!shortcut) return;
    shortcuts = { ...shortcuts, [recordingShortcutAction]: shortcut };
    localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(shortcuts));
    recordingShortcutAction = null;
    renderShortcutsModal();
    showToast(`${shortcut} assigned`);
    return true;
  }
  if (isTextEditing()) return false;
  const shortcut = normalizeShortcut(event);
  const action = actionForShortcut(shortcuts, shortcut);
  if (!action) return false;
  event.preventDefault();
  shortcutActions(action);
  return true;
}

function shortcutLabel(action) {
  return ({
    copy: "Copy",
    cut: "Cut",
    paste: "Paste",
    duplicate: "Duplicate",
    group: "Group",
    undo: "Undo",
    redo: "Redo",
    delete: "Delete",
    rippleDelete: "Ripple Delete",
    playPause: "Play / Pause",
    split: "Split",
    mute: "Mute",
    lock: "Lock Track",
    solo: "Solo Track",
    reverse: "Reverse",
    freezeFrame: "Freeze Frame",
    selectAll: "Select All",
    stepLeft: "Step Left",
    stepRight: "Step Right",
    moveLeft: "Nudge Left",
    moveRight: "Nudge Right",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    fullscreen: "Fullscreen",
    export: "Export",
  })[action] ?? action;
}

function renderShortcutsModal() {
  const list = document.querySelector("[data-shortcuts-list]");
  if (!list) return;
  list.innerHTML = Object.keys(DEFAULT_SHORTCUTS).map((action) => `
    <article class="shortcut-row">
      <div><strong>${shortcutLabel(action)}</strong><span>${action}</span></div>
      <button class="${recordingShortcutAction === action ? "recording" : ""}" data-record-shortcut="${action}">${recordingShortcutAction === action ? "Press keys..." : shortcuts[action]}</button>
    </article>
  `).join("");
  document.querySelectorAll("[data-shortcut]").forEach((item) => {
    const action = item.dataset.shortcutAction;
    if (action && shortcuts[action]) item.dataset.shortcut = shortcuts[action];
  });
}

document.querySelector("[data-open-shortcuts]")?.addEventListener("click", () => {
  document.querySelector("[data-shortcuts-modal]").hidden = false;
  renderShortcutsModal();
});

document.querySelector("[data-close-shortcuts]")?.addEventListener("click", () => {
  document.querySelector("[data-shortcuts-modal]").hidden = true;
  recordingShortcutAction = null;
});

document.querySelector("[data-shortcuts-list]")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-record-shortcut]");
  if (!button) return;
  recordingShortcutAction = button.dataset.recordShortcut;
  renderShortcutsModal();
});

document.querySelector("[data-shortcuts-reset]")?.addEventListener("click", () => {
  shortcuts = createShortcutState();
  localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(shortcuts));
  recordingShortcutAction = null;
  renderShortcutsModal();
  showToast("Shortcuts reset");
});

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    storageEngine.write("settings", "all", settings);
    document.querySelector("[data-settings-status]") && (document.querySelector("[data-settings-status]").textContent = "Preferences saved locally");
  } catch (error) {
    editor.logError(error, { source: "saveSettings", severity: "error", userMessage: "Settings save failed. Storage may be full." });
    renderErrorCenter();
  }
}

function settingsField(label, key, control) {
  return `<label class="settings-field"><span>${label}</span>${control.replace(/data-setting(="[^"]*")?/, `data-setting="${key}"`)}</label>`;
}

function settingChecked(key) {
  return settings[key] ? "checked" : "";
}

function settingOptions(key, values) {
  return `<select data-setting="${key}">${values.map((value) => `<option${settings[key] === value ? " selected" : ""}>${value}</option>`).join("")}</select>`;
}

async function renderStorageMeter() {
  const meter = document.querySelector("[data-storage-meter]");
  const details = document.querySelector("[data-storage-details]");
  if (!meter) return;
  try {
    const info = await storageEngine.getStorageInfo();
    const usedKB = (info.local.estimated / 1024).toFixed(1);
    const limitMB = info.limitMB;
    meter.innerHTML = `
      <strong>Local cache</strong>
      <span>${usedKB} KB / ${limitMB} MB (${info.percentUsed}%)</span>
      <div class="storage-bar"><div class="storage-fill" style="width:${Math.min(100, info.percentUsed)}%"></div></div>
      ${info.isOverLimit ? '<span class="storage-warning">Over limit - cleanup recommended</span>' : ""}
    `;
    if (details) {
      const cacheEntries = Object.values(info.cache).reduce((sum, c) => sum + (c.entries ?? 0), 0);
      const tempCount = info.temp?.count ?? 0;
      details.innerHTML = `<span>${cacheEntries} cached entries · ${tempCount} temp files · ${info.blob?.keys ?? 0} blobs</span>`;
    }
  } catch {}
}

function renderSettingsContent() {
  const target = document.querySelector("[data-settings-content]");
  if (!target) return;
  const panels = {
    theme: `
      <div class="settings-section-head"><strong>Theme</strong><span>Control the editor appearance without changing the workspace layout.</span></div>
      <div class="settings-grid">
        ${settingsField("Theme", "theme", settingOptions("theme", ["Midnight Glass", "Deep Cinema", "Soft Frost", "High Contrast"]))}
        ${settingsField("Accent", "accent", settingOptions("accent", ["Ice Blue", "Soft Cyan", "Mint", "Amber"]))}
        ${settingsField("Panel Transparency", "panelTransparency", '<input data-setting type="range" min="40" max="90" value="' + (settings.panelTransparency ?? 68) + '" />')}
      </div>`,
    language: `
      <div class="settings-section-head"><strong>Language</strong><span>Local interface preferences for labels, formatting, and regional defaults.</span></div>
      <div class="settings-grid">
        ${settingsField("Language", "language", settingOptions("language", ["English", "Spanish", "French", "German", "Lithuanian"]))}
        ${settingsField("Region", "region", settingOptions("region", ["United Kingdom", "United States", "European Union", "Lithuania"]))}
        ${settingsField("Time Format", "timeFormat", settingOptions("timeFormat", ["HH:MM:SS", "MM:SS", "Frames"]))}
      </div>`,
    autosave: `
      <div class="settings-section-head"><strong>Autosave</strong><span>Autosave is local-only and writes project recovery data into this browser.</span></div>
      <div class="settings-grid">
        ${settingsField("Enable Autosave", "autosave", `<input data-setting type="checkbox" ${settingChecked("autosave")} />`)}
        ${settingsField("Autosave Interval", "autosaveInterval", '<input data-setting type="range" min="60" max="600" step="30" value="' + settings.autosaveInterval + '" />')}
        ${settingsField("Recovery Snapshots", "recoverySnapshots", '<input data-setting type="number" min="3" max="24" value="' + (settings.recoverySnapshots ?? 8) + '" />')}
      </div>`,
    playback: `
      <div class="settings-section-head"><strong>Playback Quality</strong><span>Choose preview quality and playback behavior for smoother editing.</span></div>
      <div class="settings-grid">
        ${settingsField("Quality Mode", "playbackQuality", settingOptions("playbackQuality", ["Performance", "Balanced", "Quality"]))}
        ${settingsField("Preview Resolution", "playbackResolution", settingOptions("playbackResolution", ["720p Proxy", "1080p Proxy", "Original"]))}
        ${settingsField("Dropped Frame Warning", "droppedFrameWarning", `<input data-setting type="checkbox" ${settingChecked("droppedFrameWarning")} />`)}
      </div>`,
    timeline: `
      <div class="settings-section-head"><strong>Timeline Options</strong><span>Defaults for editing feel, ruler density, and clip visuals.</span></div>
      <div class="settings-grid">
        ${settingsField("Snapping", "timelineSnap", `<input data-setting type="checkbox" ${settingChecked("timelineSnap")} />`)}
        ${settingsField("Magnetic Editing", "timelineMagnetic", `<input data-setting type="checkbox" ${settingChecked("timelineMagnetic")} />`)}
        ${settingsField("Waveforms", "timelineWaveforms", `<input data-setting type="checkbox" ${settingChecked("timelineWaveforms")} />`)}
        ${settingsField("Clip Thumbnails", "timelineThumbnails", `<input data-setting type="checkbox" ${settingChecked("timelineThumbnails")} />`)}
      </div>`,
    shortcuts: `
      <div class="settings-section-head"><strong>Keyboard Shortcuts</strong><span>Current desktop bindings. Use the dedicated shortcut editor for recording new keys.</span></div>
      <div class="settings-shortcut-preview">${Object.keys(DEFAULT_SHORTCUTS).slice(0, 12).map((action) => `<article><span>${shortcutLabel(action)}</span><strong>${shortcuts[action]}</strong></article>`).join("")}</div>
      <div class="settings-actions"><button data-open-shortcuts-from-settings>Customize Shortcuts</button></div>`,
    performance: `
      <div class="settings-section-head"><strong>Performance</strong><span>Local rendering preferences for smooth playback and low UI latency.</span></div>
      <div class="settings-grid">
        ${settingsField("Performance Mode", "performanceMode", settingOptions("performanceMode", ["Adaptive", "Battery Saver", "Maximum Smoothness"]))}
        ${settingsField("GPU Rendering", "gpuRendering", `<input data-setting type="checkbox" ${settingChecked("gpuRendering")} />`)}
        ${settingsField("Background Rendering", "backgroundRendering", `<input data-setting type="checkbox" ${settingChecked("backgroundRendering")} />`)}
        ${settingsField("Proxy Media", "proxyMedia", `<input data-setting type="checkbox" ${settingChecked("proxyMedia")} />`)}
      </div>`,
    plugins: renderPluginSettingsPanel(),
    storage: `
      <div class="settings-section-head"><strong>Storage</strong><span>Manage browser-local project, thumbnail, and recovery storage.</span></div>
      <div class="settings-grid">
        ${settingsField("Storage Limit", "storageLimit", '<input data-setting type="range" min="2" max="50" value="' + settings.storageLimit + '" />')}
        ${settingsField("Thumbnail Cache", "thumbnailCache", `<input data-setting type="checkbox" ${settingChecked("thumbnailCache")} />`)}
        <div class="settings-storage-meter" data-storage-meter><strong>Local cache</strong><span>${Math.max(1, Math.round(JSON.stringify(localStorage).length / 1024))} KB used in this browser</span></div>
        <button data-action="cleanup-storage" type="button">Run Cleanup</button>
        <div data-storage-details class="storage-details"></div>
      </div>`,
    sync: renderSyncSettingsPanel(),
    errors: renderRecoverySettingsPanel(),
    export: `
      <div class="settings-section-head"><strong>Export Defaults</strong><span>Default values for the export window. No render backend is connected.</span></div>
      <div class="settings-grid">
        ${settingsField("Resolution", "exportResolution", settingOptions("exportResolution", ["720p", "1080p", "1440p", "4K"]))}
        ${settingsField("Format", "exportFormat", settingOptions("exportFormat", ["MP4", "MOV", "WEBM"]))}
        ${settingsField("Codec", "exportCodec", settingOptions("exportCodec", ["H.264", "HEVC", "VP9"]))}
        ${settingsField("FPS", "exportFps", '<input data-setting type="number" min="24" max="60" value="' + settings.exportFps + '" />')}
      </div>`,
    ai: `
      <div class="settings-section-head"><strong>AI Settings</strong><span>Prepared local preferences for future AI tools. No APIs are connected.</span></div>
      <div class="settings-grid">
        ${settingsField("Local Planning Mode", "aiLocalOnly", `<input data-setting type="checkbox" ${settingChecked("aiLocalOnly")} />`)}
        ${settingsField("AI Suggestions", "aiSuggestions", `<input data-setting type="checkbox" ${settingChecked("aiSuggestions")} />`)}
        ${settingsField("Preview Quality", "aiPreviewQuality", settingOptions("aiPreviewQuality", ["Draft", "Balanced", "Detailed"]))}
      </div>`,
    notifications: `
      <div class="settings-section-head"><strong>Notifications</strong><span>Choose which local editor events should surface as toasts.</span></div>
      <div class="settings-grid">
        ${settingsField("Export Updates", "notifyExports", `<input data-setting type="checkbox" ${settingChecked("notifyExports")} />`)}
        ${settingsField("Autosave Updates", "notifyAutosave", `<input data-setting type="checkbox" ${settingChecked("notifyAutosave")} />`)}
        ${settingsField("Warnings", "notifyWarnings", `<input data-setting type="checkbox" ${settingChecked("notifyWarnings")} />`)}
      </div>`,
    account: `
      <div class="settings-section-head"><strong>Account</strong><span>Frontend-only account display settings. No authentication is connected.</span></div>
      <div class="settings-grid">
        ${settingsField("Display Name", "accountName", '<input data-setting value="' + settings.accountName + '" />')}
        ${settingsField("Role", "accountRole", settingOptions("accountRole", ["Creator", "Editor", "Producer", "Admin"]))}
        <div class="settings-account-card"><span>MA</span><strong>${settings.accountName}</strong><em>${settings.accountRole}</em></div>
      </div>`,
  };
  target.innerHTML = panels[activeSettingsSection] ?? panels.theme;
}

function renderRecoverySettingsPanel() {
  const errors = editor.state.errors ?? { logs: [], recoveryPoints: [], missingMedia: [] };
  return `
    <div class="settings-section-head"><strong>Recovery</strong><span>Global crash, undo, autosave, missing media, and render failure diagnostics.</span></div>
    <div class="recovery-actions">
      <button data-error-action="recovery-point">Create Recovery Point</button>
      <button data-error-action="scan-media">Scan Missing Media</button>
      <button data-error-action="clear-logs">Clear Logs</button>
    </div>
    <div class="recovery-grid">
      <section>
        <div class="plugin-head"><strong>Error Log</strong><span>${errors.logs.length} entries</span></div>
        <div class="recovery-list">${errors.logs.slice(0, 10).map((item) => `<article class="${escapeHtml(item.severity)}"><strong>${escapeHtml(item.userMessage)}</strong><span>${escapeHtml(item.source)} - ${new Date(item.at).toLocaleString()}</span><p>${escapeHtml(item.message)}</p></article>`).join("") || '<div class="plugin-empty">No errors logged.</div>'}</div>
      </section>
      <section>
        <div class="plugin-head"><strong>Recovery Points</strong><span>${errors.recoveryPoints.length} points</span></div>
        <div class="recovery-list">${errors.recoveryPoints.slice(0, 8).map((item) => `<article><strong>${item.reason}</strong><span>${new Date(item.at).toLocaleString()}</span></article>`).join("") || '<div class="plugin-empty">No recovery points yet.</div>'}</div>
      </section>
      <section>
        <div class="plugin-head"><strong>Missing Media</strong><span>${errors.missingMedia.length} clips</span></div>
        <div class="recovery-list">${errors.missingMedia.map((item) => `<article class="warning"><strong>${item.name}</strong><span>${item.reason}</span></article>`).join("") || '<div class="plugin-empty">No missing media detected.</div>'}</div>
      </section>
    </div>`;
}

function pluginPermissionChips(plugin) {
  return editor.state.plugins.permissionCatalog.map((permission) => {
    const checked = plugin.permissionsGranted.includes(permission) ? "checked" : "";
    const requested = plugin.manifest.permissions.includes(permission) ? " requested" : "";
    return `<label class="plugin-permission${requested}"><input type="checkbox" data-plugin-permission="${permission}" data-plugin-id="${plugin.id}" ${checked} />${permission}</label>`;
  }).join("");
}

function pluginSettingsControls(plugin) {
  const entries = Object.entries(plugin.manifest.settingsSchema ?? {});
  if (!entries.length) return '<p class="plugin-empty">This plugin has no configurable settings.</p>';
  return entries.map(([key, schema]) => {
    const value = plugin.settings?.[key] ?? schema.default ?? "";
    if (schema.type === "boolean") return `<label class="plugin-setting"><span>${key}</span><input type="checkbox" data-plugin-setting="${key}" data-plugin-id="${plugin.id}" ${value ? "checked" : ""} /></label>`;
    if (schema.type === "number") return `<label class="plugin-setting"><span>${key}</span><input type="number" data-plugin-setting="${key}" data-plugin-id="${plugin.id}" value="${value}" /></label>`;
    return `<label class="plugin-setting"><span>${key}</span><input data-plugin-setting="${key}" data-plugin-id="${plugin.id}" value="${value}" /></label>`;
  }).join("");
}

function renderPluginSettingsPanel() {
  const state = editor.state.plugins;
  const installedIds = new Set(state.registry.map((plugin) => plugin.id));
  const installed = state.registry.length ? state.registry.map((plugin) => `
    <article class="plugin-card installed" data-plugin-card="${plugin.id}">
      <div>
        <strong>${plugin.manifest.name}</strong>
        <span>${plugin.manifest.category} - v${plugin.manifest.version} - ${plugin.status}</span>
        <p>${plugin.manifest.description}</p>
      </div>
      <div class="plugin-actions">
        <button data-plugin-load="${plugin.id}" ${plugin.enabled ? "disabled" : ""}>Load</button>
        <button data-plugin-disable="${plugin.id}" ${!plugin.enabled ? "disabled" : ""}>Disable</button>
      </div>
      <details>
        <summary>Permissions</summary>
        <div class="plugin-permissions">${pluginPermissionChips(plugin)}</div>
      </details>
      <details>
        <summary>Settings</summary>
        <div class="plugin-settings">${pluginSettingsControls(plugin)}</div>
      </details>
    </article>
  `).join("") : '<div class="plugin-empty">No plugins installed yet.</div>';
  const marketplace = state.marketplace.map((plugin) => `
    <article class="plugin-card marketplace">
      <div>
        <strong>${plugin.name}</strong>
        <span>${plugin.category} - ${plugin.marketplace.pricing}${plugin.marketplace.verified ? " - Verified" : ""}</span>
        <p>${plugin.description}</p>
      </div>
      <button data-plugin-install="${plugin.id}" ${installedIds.has(plugin.id) ? "disabled" : ""}>${installedIds.has(plugin.id) ? "Installed" : "Install"}</button>
    </article>
  `).join("");
  return `
    <div class="settings-section-head"><strong>Plugins</strong><span>Local plugin registry, permissions, settings, and marketplace architecture for future extensibility.</span></div>
    <div class="plugin-manager">
      <section>
        <div class="plugin-head"><strong>Installed Plugins</strong><span>${state.registry.filter((plugin) => plugin.enabled).length} active</span></div>
        <div class="plugin-list">${installed}</div>
      </section>
      <section>
        <div class="plugin-head"><strong>Marketplace Architecture</strong><span>${state.marketplace.length} available</span></div>
        <div class="plugin-list marketplace-list">${marketplace}</div>
      </section>
      <section>
        <div class="plugin-head"><strong>Event Log</strong><span>${state.events.length} events</span></div>
        <div class="plugin-event-log">${state.events.slice(0, 8).map((item) => `<article><strong>${item.event}</strong><span>${item.pluginId} - ${new Date(item.at).toLocaleTimeString()}</span></article>`).join("") || '<div class="plugin-empty">No plugin events yet.</div>'}</div>
      </section>
    </div>`;
}

function applySettingsToUi() {
  document.body.dataset.theme = settings.theme?.toLowerCase().replace(/\s+/g, "-");
  document.body.dataset.accent = settings.accent?.toLowerCase().replace(/\s+/g, "-");
  document.querySelector('[data-toggle-timeline="snap"]')?.classList.toggle("active", Boolean(settings.timelineSnap));
  document.querySelector('[data-toggle-timeline="magnetic"]')?.classList.toggle("active", Boolean(settings.timelineMagnetic));
  editor.state.snap = Boolean(settings.timelineSnap);
  editor.state.magnetic = Boolean(settings.timelineMagnetic);
  document.body.classList.toggle("hide-timeline-waveforms", !settings.timelineWaveforms);
  document.body.classList.toggle("hide-timeline-thumbnails", !settings.timelineThumbnails);
  document.querySelector(".profile-avatar") && (document.querySelector(".profile-avatar").textContent = (settings.accountName ?? "Matas").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase());
  document.body.classList.toggle("performance-max", settings.performanceMode === "Maximum Smoothness");
  timelineRenderScheduler.request();
}

document.querySelector("[data-open-settings]")?.addEventListener("click", () => {
  document.querySelector("[data-settings-modal]").hidden = false;
  renderSettingsContent();
});

document.querySelector("[data-close-settings]")?.addEventListener("click", () => {
  document.querySelector("[data-settings-modal]").hidden = true;
});

document.querySelector(".settings-nav")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-settings-section]");
  if (!button) return;
  activeSettingsSection = button.dataset.settingsSection;
  setActiveWithin(".settings-nav button", button);
  renderSettingsContent();
});

document.querySelector("[data-settings-content]")?.addEventListener("input", (event) => {
  const pluginPermission = event.target.closest("[data-plugin-permission]");
  if (pluginPermission) {
    const plugin = editor.state.plugins.registry.find((item) => item.id === pluginPermission.dataset.pluginId);
    if (!plugin) return;
    const permissions = new Set(plugin.permissionsGranted);
    if (pluginPermission.checked) permissions.add(pluginPermission.dataset.pluginPermission);
    else permissions.delete(pluginPermission.dataset.pluginPermission);
    editor.updatePluginPermissions(plugin.id, [...permissions]);
    renderSettingsContent();
    showToast("Plugin permissions updated");
    return;
  }
  const pluginSetting = event.target.closest("[data-plugin-setting]");
  if (pluginSetting) {
    const value = pluginSetting.type === "checkbox" ? pluginSetting.checked : pluginSetting.type === "number" ? Number(pluginSetting.value) : pluginSetting.value;
    editor.updatePluginSettings(pluginSetting.dataset.pluginId, { [pluginSetting.dataset.pluginSetting]: value });
    showToast("Plugin settings updated");
    return;
  }
  const input = event.target.closest("[data-setting]");
  if (!input) return;
  settings[input.dataset.setting] = input.type === "checkbox" ? input.checked : input.type === "number" || input.type === "range" ? Number(input.value) : input.value;
  if (input.dataset.setting === "syncOfflineMode") setSyncOffline(Boolean(settings.syncOfflineMode));
  saveSettings();
  applySettingsToUi();
});

document.querySelector("[data-settings-content]")?.addEventListener("click", (event) => {
  const shortcuts = event.target.closest("[data-open-shortcuts-from-settings]");
  const install = event.target.closest("[data-plugin-install]");
  const load = event.target.closest("[data-plugin-load]");
  const disable = event.target.closest("[data-plugin-disable]");
  const errorAction = event.target.closest("[data-error-action]");
  const syncAction = event.target.closest("[data-sync-action]");
  const syncResolve = event.target.closest("[data-sync-resolve]");
  const cleanupStorage = event.target.closest("[data-action=\"cleanup-storage\"]");
  if (!shortcuts && !install && !load && !disable && !errorAction && !syncAction && !syncResolve && !cleanupStorage) return;
  if (cleanupStorage) {
    storageEngine.cleanup().then((result) => {
      renderStorageMeter();
      showToast(`Cleanup freed ${result.freedBytes} bytes`);
    }).catch(() => {});
    return;
  }
  if (shortcuts) {
    document.querySelector("[data-settings-modal]").hidden = true;
    document.querySelector("[data-shortcuts-modal]").hidden = false;
    renderShortcutsModal();
    return;
  }
  if (syncAction) {
    handleSyncAction(syncAction.dataset.syncAction);
    return;
  }
  if (syncResolve) {
    resolveSyncConflict(syncResolve.dataset.syncResolve, syncResolve.dataset.syncStrategy);
    renderSettingsContent();
    return;
  }
  if (errorAction) {
    const action = errorAction.dataset.errorAction;
    if (action === "recovery-point") {
      editor.createRecoveryPoint("manual");
      showToast("Recovery point created");
    }
    if (action === "scan-media") {
      const missing = editor.scanMissingMedia();
      showToast(missing.length ? `${missing.length} missing media item${missing.length === 1 ? "" : "s"}` : "No missing media detected");
    }
    if (action === "clear-logs") {
      editor.state.errors = { ...editor.state.errors, logs: [], notifications: [], missingMedia: [] };
      persistErrorState();
      renderErrorCenter();
      showToast("Recovery logs cleared");
    }
    renderSettingsContent();
    return;
  }
  if (install) {
    editor.installMarketplacePlugin(install.dataset.pluginInstall);
    showToast("Plugin installed locally");
  }
  if (load) {
    editor.loadPlugin(load.dataset.pluginLoad);
    showToast("Plugin loaded");
  }
  if (disable) {
    editor.disablePlugin(disable.dataset.pluginDisable);
    showToast("Plugin disabled");
  }
  renderSettingsContent();
});

document.querySelector("[data-settings-reset]")?.addEventListener("click", () => {
  settings = { ...DEFAULT_SETTINGS };
  saveSettings();
  applySettingsToUi();
  renderSettingsContent();
  showToast("Settings reset");
});

applySettingsToUi();
editor.scanMissingMedia();
renderErrorCenter();
ensureProjectSyncRecord();
persistSyncState();

function openToolPanel(label, { toggle = false, silent = false } = {}) {
  const button = document.querySelector(`.tool[data-label="${label}"]`);
  const panel = document.querySelector(".tool-panel");
  if (!button || !panel) return;
  const alreadyOpen = panel.classList.contains("open") && button.classList.contains("active");
  setActiveWithin(".tool", button);
  document.querySelectorAll("[data-panel-view]").forEach((view) => {
    view.hidden = view.dataset.panelView !== label;
  });
  if (label === "Media") document.querySelector("[data-tool-panel-title]").textContent = "Project Media";
  panel.classList.toggle("open", toggle ? !alreadyOpen : true);
  if (!silent) showToast(`${label} panel ${toggle && alreadyOpen ? "closed" : "opened"}`);
}

document.querySelectorAll(".tool").forEach((button) => {
  button.addEventListener("click", () => openToolPanel(button.dataset.label, { toggle: true }));
});

function persistUserTemplates() {
  localStorage.setItem(USER_TEMPLATE_STORAGE_KEY, JSON.stringify(userTemplates));
}

function allTemplates() {
  return [
    ...TEMPLATE_LIBRARY,
    ...userTemplates.map((template) => ({ ...template, category: template.category || "Saved", saved: true }))
  ];
}

function filteredTemplates() {
  const query = document.querySelector("[data-template-search]")?.value.trim().toLowerCase() ?? "";
  return allTemplates().filter((template) => {
    const categoryMatch = activeTemplateCategory === "All" || (activeTemplateCategory === "Saved" ? template.saved : template.category === activeTemplateCategory);
    const text = [template.name, template.category, template.description, template.format, template.duration].filter(Boolean).join(" ").toLowerCase();
    return categoryMatch && (!query || text.includes(query));
  });
}

function renderTemplateCategories() {
  const target = document.querySelector("[data-template-categories]");
  if (!target) return;
  target.innerHTML = TEMPLATE_CATEGORIES.map((category) => `<button class="${category === activeTemplateCategory ? "active" : ""}" data-template-category="${category}">${category}</button>`).join("");
}

function templateAccentClass(template) {
  return ({ mint: "mint", rose: "rose", amber: "amber" })[template.accent] ?? "ice";
}

function renderTemplateLibrary() {
  const target = document.querySelector("[data-template-library]");
  const empty = document.querySelector("[data-template-empty]");
  if (!target) return;
  renderTemplateCategories();
  const templates = filteredTemplates();
  target.innerHTML = templates.map((template) => `
    <article class="template-card ${templateAccentClass(template)}${template.saved ? " saved" : ""}" data-template-id="${escapeHtml(template.id)}">
      <div class="template-preview"><span>${escapeHtml(template.category)}</span><b>${escapeHtml(template.format ?? "Any")}</b></div>
      <div class="template-card-body">
        <strong>${escapeHtml(template.name)}</strong>
        <p>${escapeHtml(template.description)}</p>
        <div><span>${escapeHtml(template.duration ?? "Reusable")}</span><span>${template.saved ? "User saved" : "Built-in"}</span></div>
      </div>
      <footer>
        <button data-apply-template="${escapeHtml(template.id)}">Apply</button>
        ${template.saved ? `<button class="danger" data-delete-user-template="${escapeHtml(template.id)}">Delete</button>` : `<button data-preview-template="${escapeHtml(template.id)}">Preview</button>`}
      </footer>
    </article>
  `).join("");
  if (empty) empty.hidden = templates.length > 0;
}

function applyTemplate(templateId) {
  const template = allTemplates().find((item) => item.id === templateId);
  if (!template) return;
  if (template.format === "9:16" || template.format === "16:9" || template.format === "1:1") {
    document.querySelector(`[data-canvas-preset="${template.format}"]`)?.click();
  }
  if (template.textTemplate && document.querySelector("[data-text-template]")) {
    document.querySelector("[data-text-template]").value = template.textTemplate;
    if (selectedTextClip()) editor.applyTextTemplate(template.textTemplate);
  }
  if (template.captionTemplate && document.querySelector("[data-caption-template]")) {
    document.querySelector("[data-caption-template]").value = template.captionTemplate;
    if (selectedCaptionClip()) editor.applyCaptionTemplate(template.captionTemplate);
  }
  const nameField = document.querySelector("[data-user-template-name]");
  if (nameField) nameField.value = template.name;
  renderTimelineFromState();
  updateTimecode();
  showToast(`${template.name} template applied`, { type: "success", title: "Template Applied" });
}

function saveUserTemplate() {
  const nameInput = document.querySelector("[data-user-template-name]");
  const category = document.querySelector("[data-user-template-category]")?.value ?? "Saved";
  const name = nameInput?.value.trim() || `${category} Template`;
  const selected = editor.selectedClips[0];
  const template = {
    id: `user-template-${Date.now()}`,
    category,
    name,
    description: selected ? `Saved from selected ${selected.type} layer at ${formatDuration(editor.state.time)}.` : `Saved from ${currentProject()?.name ?? "current project"} workspace.`,
    duration: selected ? formatDuration(selected.duration) : formatDuration(editor.state.duration),
    format: document.querySelector(".canvas-toolbar .active")?.dataset.canvasPreset ?? "Any",
    accent: "ice",
    textTemplate: document.querySelector("[data-text-template]")?.value ?? null,
    captionTemplate: document.querySelector("[data-caption-template]")?.value ?? null,
    saved: true,
    createdAt: new Date().toISOString()
  };
  userTemplates = [template, ...userTemplates].slice(0, 60);
  persistUserTemplates();
  activeTemplateCategory = "Saved";
  renderTemplateLibrary();
  showToast(`${name} saved locally`, { type: "success", title: "Template Saved" });
}

let _templateSearchTimer = null;
document.querySelector("[data-template-search]")?.addEventListener("input", () => { clearManagedTimeout(_templateSearchTimer); _templateSearchTimer = managedTimeout(renderTemplateLibrary, 150); });
document.querySelector("[data-template-categories]")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-template-category]");
  if (!button) return;
  activeTemplateCategory = button.dataset.templateCategory;
  renderTemplateLibrary();
});
document.querySelector("[data-template-library]")?.addEventListener("click", (event) => {
  const apply = event.target.closest("[data-apply-template]");
  const preview = event.target.closest("[data-preview-template]");
  const remove = event.target.closest("[data-delete-user-template]");
  if (apply) applyTemplate(apply.dataset.applyTemplate);
  if (preview) {
    const template = allTemplates().find((item) => item.id === preview.dataset.previewTemplate);
    if (template) showToast(template.description, { title: template.name, type: "info" });
  }
  if (remove) {
    userTemplates = userTemplates.filter((template) => template.id !== remove.dataset.deleteUserTemplate);
    persistUserTemplates();
    renderTemplateLibrary();
    showToast("User template deleted", { type: "warning" });
  }
});
document.querySelector("[data-save-user-template]")?.addEventListener("click", saveUserTemplate);

const GLOBAL_SEARCH_CATEGORIES = ["All", "Media", "Effects", "Transitions", "Templates", "Fonts", "Projects", "Audio", "Captions", "AI Tools", "Keyboard shortcuts"];

function optionSearchItems(selector, category, meta, action) {
  return [...document.querySelectorAll(`${selector} option`)].map((option) => ({
    id: `${category}:${option.value}`,
    category,
    title: option.textContent.trim(),
    meta,
    keywords: [option.value, option.textContent, category, meta],
    action: () => action(option)
  }));
}

let _searchIndexCache = null;
let _searchIndexRevision = 0;
function buildGlobalSearchIndex() {
  const currentRev = editor.state.autosave?.version ?? 0;
  if (_searchIndexCache && _searchIndexRevision === currentRev) return _searchIndexCache;
  _searchIndexRevision = currentRev;
  const assets = editor.state.assetManager?.assets ?? [];
  const mediaItems = assets.map((asset) => ({
    id: `asset:${asset.id}`,
    category: asset.type === "Audio" ? "Audio" : "Media",
    title: asset.name,
    meta: `${asset.type} - ${formatDuration(asset.duration)} - ${asset.folder ?? "Project Media"}`,
    keywords: [asset.name, asset.type, asset.folder, ...(asset.tags ?? [])],
    action: () => {
      openToolPanel("Media", { silent: true });
      const input = document.querySelector("[data-am-search]");
      if (input) input.value = asset.name;
      editor.setAssetFilter({ query: asset.name, type: asset.type === "Audio" ? "Audio" : "All", favoritesOnly: false });
      renderAssetManager();
      showToast(`${asset.name} revealed`);
    }
  }));
  const projects = projectLibrary.filter((project) => !project.deletedAt).map((project) => ({
    id: `project:${project.id}`,
    category: "Projects",
    title: project.name,
    meta: `${project.id === activeProjectId ? "Current project" : "Project"} - ${new Date(project.updatedAt ?? Date.now()).toLocaleDateString()}`,
    keywords: [project.name, project.settings?.colorSpace, project.settings?.fps, project.settings?.width],
    action: () => {
      document.querySelector("[data-project-modal]").hidden = false;
      renderProjectManager();
      showToast(`${project.name} highlighted in Projects`);
    }
  }));
  const templateItems = allTemplates().map((template) => ({
    id: `template-system:${template.id}`,
    category: "Templates",
    title: template.name,
    meta: `${template.category} - ${template.format ?? "Any"} - ${template.duration ?? "Reusable"}`,
    keywords: [template.name, template.category, template.description, template.format, template.duration],
    action: () => {
      openToolPanel("Templates", { silent: true });
      activeTemplateCategory = template.saved ? "Saved" : template.category;
      const input = document.querySelector("[data-template-search]");
      if (input) input.value = template.name;
      renderTemplateLibrary();
      showToast(`${template.name} found in Templates`);
    }
  }));
  const shortcutsIndex = Object.keys(DEFAULT_SHORTCUTS).map((action) => ({
    id: `shortcut:${action}`,
    category: "Keyboard shortcuts",
    title: shortcutLabel(action),
    meta: `${shortcuts[action] ?? DEFAULT_SHORTCUTS[action]} - ${action}`,
    keywords: [action, shortcutLabel(action), shortcuts[action], DEFAULT_SHORTCUTS[action]],
    action: () => {
      document.querySelector("[data-shortcuts-modal]").hidden = false;
      renderShortcutsModal();
      showToast(`${shortcutLabel(action)} shortcut opened`);
    }
  }));
  const captions = [...document.querySelectorAll(".caption-block, [data-caption-words] button")].map((item, index) => ({
    id: `caption:${index}`,
    category: "Captions",
    title: item.textContent.trim().replace(/\s+/g, " ").slice(0, 64) || `Caption ${index + 1}`,
    meta: "Caption text and timing",
    keywords: [item.textContent, "caption", "subtitle", "safe zone"],
    action: () => {
      const input = document.querySelector("[data-caption-search]");
      if (input) {
        input.value = item.textContent.trim().split(/\s+/).slice(0, 3).join(" ");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      showToast("Caption search focused");
    }
  }));
  const aiTools = (editor.state.aiTools?.length ? editor.state.aiTools : AI_TOOL_REGISTRY).map((tool) => ({
    id: `ai:${tool.id}`,
    category: "AI Tools",
    title: tool.name,
    meta: `${tool.status ?? "ready"} - ${tool.description ?? "Local tool"}`,
    keywords: [tool.name, tool.description, tool.category, tool.status],
    action: () => {
      openToolPanel("AI Tools", { silent: true });
      activeAiCategory = tool.category ?? "All";
      renderAiPanel();
      document.querySelector(`[data-ai-tool-id="${tool.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      showToast(`${tool.name} ready`);
    }
  }));
  return [
    ...mediaItems,
    ...optionSearchItems("[data-effect-type]", "Effects", "Stackable live preview effect", (option) => {
      document.querySelector("[data-effect-type]").value = option.value;
      showToast(`${option.textContent} selected`);
    }),
    ...optionSearchItems("[data-transition-name]", "Transitions", "Timeline transition", (option) => {
      document.querySelector("[data-transition-name]").value = option.value;
      showToast(`${option.textContent} transition selected`);
    }),
    ...optionSearchItems("[data-text-template]", "Templates", "Text template", (option) => {
      document.querySelector("[data-text-template]").value = option.value;
      showToast(`${option.textContent} template selected`);
    }),
    ...optionSearchItems("[data-caption-template]", "Templates", "Caption template", (option) => {
      document.querySelector("[data-caption-template]").value = option.value;
      showToast(`${option.textContent} caption template selected`);
    }),
    ...templateItems,
    ...optionSearchItems("[data-text-style=\"fontFamily\"]", "Fonts", "Text font family", (option) => {
      document.querySelector("[data-text-style=\"fontFamily\"]").value = option.value;
      document.querySelector("[data-text-style=\"fontFamily\"]").dispatchEvent(new Event("change", { bubbles: true }));
      showToast(`${option.textContent} font selected`);
    }),
    ...projects,
    ...captions,
    ...aiTools,
    ...shortcutsIndex
  ];
  _searchIndexCache = result;
  return result;
}

function renderGlobalSearchFilters() {
  if (!globalSearchFilters) return;
  globalSearchFilters.innerHTML = GLOBAL_SEARCH_CATEGORIES.map((category) => `<button class="${category === activeGlobalSearchFilter ? "active" : ""}" data-global-search-filter="${category}">${category}</button>`).join("");
}

function filteredGlobalSearchItems() {
  const query = globalSearchInput?.value.trim().toLowerCase() ?? "";
  return buildGlobalSearchIndex().filter((item) => {
    const matchesFilter = activeGlobalSearchFilter === "All" || item.category === activeGlobalSearchFilter;
    const haystack = [item.title, item.meta, ...(item.keywords ?? [])].filter(Boolean).join(" ").toLowerCase();
    return matchesFilter && (!query || haystack.includes(query));
  }).slice(0, 48);
}

function renderGlobalSearchResults() {
  if (!globalSearchResults) return;
  const items = filteredGlobalSearchItems();
  activeGlobalSearchIndex = Math.min(activeGlobalSearchIndex, Math.max(0, items.length - 1));
  globalSearchResults.innerHTML = items.map((item, index) => `
    <button class="global-search-result${index === activeGlobalSearchIndex ? " active" : ""}" data-global-search-result="${escapeHtml(item.id)}">
      <span>${escapeHtml(item.category)}</span>
      <div><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.meta)}</em></div>
    </button>
  `).join("");
  if (globalSearchCount) globalSearchCount.textContent = `${items.length} result${items.length === 1 ? "" : "s"}`;
  if (globalSearchEmpty) globalSearchEmpty.hidden = items.length > 0;
  globalSearchResults.dataset.searchItems = JSON.stringify(items.map((item) => item.id));
}

function openGlobalSearch() {
  if (!globalSearch) return;
  lastFocusedBeforeOverlay = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeGlobalSearchFilter = "All";
  activeGlobalSearchIndex = 0;
  globalSearch.hidden = false;
  globalSearch.setAttribute("aria-hidden", "false");
  document.querySelector("[data-open-global-search]")?.setAttribute("aria-expanded", "true");
  renderGlobalSearchFilters();
  renderGlobalSearchResults();
  requestAnimationFrame(() => {
    globalSearch.classList.add("open");
    globalSearchInput?.focus();
    globalSearchInput?.select();
  });
}

function closeGlobalSearch() {
  if (!globalSearch) return;
  globalSearch.classList.remove("open");
  globalSearch.setAttribute("aria-hidden", "true");
  document.querySelector("[data-open-global-search]")?.setAttribute("aria-expanded", "false");
  managedTimeout(() => {
    globalSearch.hidden = true;
    lastFocusedBeforeOverlay?.focus?.();
    lastFocusedBeforeOverlay = null;
  }, 180);
}

function runGlobalSearchResult(id) {
  const item = buildGlobalSearchIndex().find((entry) => entry.id === id) ?? filteredGlobalSearchItems()[activeGlobalSearchIndex];
  if (!item) return;
  closeGlobalSearch();
  item.action?.();
}

document.querySelector("[data-open-global-search]")?.addEventListener("click", openGlobalSearch);
document.querySelector("[data-close-global-search]")?.addEventListener("click", closeGlobalSearch);
globalSearchInput?.addEventListener("input", () => {
  activeGlobalSearchIndex = 0;
  renderGlobalSearchResults();
});
globalSearchFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-global-search-filter]");
  if (!button) return;
  activeGlobalSearchFilter = button.dataset.globalSearchFilter;
  activeGlobalSearchIndex = 0;
  renderGlobalSearchFilters();
  renderGlobalSearchResults();
});
globalSearchResults?.addEventListener("click", (event) => {
  const result = event.target.closest("[data-global-search-result]");
  if (result) runGlobalSearchResult(result.dataset.globalSearchResult);
});
globalSearch?.addEventListener("click", (event) => {
  if (event.target === globalSearch) closeGlobalSearch();
});
globalSearchInput?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const count = filteredGlobalSearchItems().length;
    if (!count) return;
    activeGlobalSearchIndex = (activeGlobalSearchIndex + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
    renderGlobalSearchResults();
    document.querySelector(".global-search-result.active")?.scrollIntoView({ block: "nearest" });
  }
  if (event.key === "Enter") {
    event.preventDefault();
    runGlobalSearchResult();
  }
});

function matchingAiCommands(query = "") {
  const term = query.trim().toLowerCase();
  if (!term) return AI_COMMANDS;
  return AI_COMMANDS.filter((item) => `${item.command} ${item.intent} ${item.tool}`.toLowerCase().includes(term));
}

function renderAiCommandBar() {
  if (!aiCommandSuggestions || !aiCommandPreview || !aiCommandHistory) return;
  const query = aiCommandInput?.value ?? "";
  const matches = matchingAiCommands(query);
  if (activeAiCommandIndex >= matches.length) activeAiCommandIndex = 0;
  aiCommandSuggestions.innerHTML = matches.map((item, index) => `
    <button class="${index === activeAiCommandIndex ? "active" : ""}" data-ai-command-suggestion="${escapeHtml(item.command)}">
      <span>${escapeHtml(item.intent)}</span>
      <strong>${escapeHtml(item.command)}</strong>
      <em>${escapeHtml(item.tool)}</em>
    </button>
  `).join("") || `
    <button class="active" data-ai-command-suggestion="${escapeHtml(query)}">
      <span>Custom instruction</span>
      <strong>${escapeHtml(query || "Describe the edit you want")}</strong>
      <em>Local edit plan</em>
    </button>
  `;
  const selected = matches[activeAiCommandIndex] ?? { command: query || "Custom instruction", intent: "Custom", tool: "Command Planner", result: "Prepared a local edit plan for this instruction." };
  aiCommandPreview.innerHTML = `
    <strong>${escapeHtml(selected.command)}</strong>
    <span>${escapeHtml(selected.result)}</span>
  `;
  aiCommandHistory.innerHTML = aiCommandHistoryItems.length ? `
    <div class="ai-command-history-head"><strong>Recent local commands</strong><span>${aiCommandHistoryItems.length} prepared</span></div>
    ${aiCommandHistoryItems.slice(0, 4).map((item) => `<article><strong>${escapeHtml(item.command)}</strong><span>${escapeHtml(item.tool)} - ${new Date(item.at).toLocaleTimeString()}</span></article>`).join("")}
  ` : '<div class="ai-command-empty">No commands prepared yet.</div>';
}

function openAiCommandBar(prefill = "") {
  if (!aiCommandBackdrop || !aiCommandInput) return;
  lastFocusedBeforeOverlay = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  aiCommandBackdrop.hidden = false;
  aiCommandBackdrop.classList.add("open");
  aiCommandBackdrop.setAttribute("aria-hidden", "false");
  document.querySelector("[data-open-ai-command-bar]")?.setAttribute("aria-expanded", "true");
  if (prefill) aiCommandInput.value = prefill;
  activeAiCommandIndex = 0;
  renderAiCommandBar();
  aiCommandInput.focus();
  aiCommandInput.select();
}

function closeAiCommandBar() {
  if (!aiCommandBackdrop) return;
  aiCommandBackdrop.classList.remove("open");
  aiCommandBackdrop.setAttribute("aria-hidden", "true");
  document.querySelector("[data-open-ai-command-bar]")?.setAttribute("aria-expanded", "false");
  aiCommandBackdrop.hidden = true;
  lastFocusedBeforeOverlay?.focus?.();
  lastFocusedBeforeOverlay = null;
}

function prepareAiCommand(commandText = "") {
  const query = commandText.trim();
  if (!query) return;
  const selected = matchingAiCommands(query)[activeAiCommandIndex] ?? AI_COMMANDS.find((item) => item.command.toLowerCase() === query.toLowerCase()) ?? {
    command: query,
    intent: "Custom instruction",
    tool: "Command Planner",
    result: "Prepared a local edit plan for this instruction.",
  };
  editor.setAiCommand(selected.command);
  const panelCommand = document.querySelector("[data-ai-command]");
  if (panelCommand) panelCommand.value = selected.command;
  aiCommandHistoryItems.unshift({ ...selected, at: new Date().toISOString() });
  aiCommandHistoryItems = aiCommandHistoryItems.slice(0, 8);
  previewStatus && (previewStatus.textContent = `${selected.tool} prepared`);
  showToast(`${selected.command} prepared locally`, { type: "info", title: "AI Command" });
  renderAiCommandBar();
}

document.querySelector("[data-open-ai-command-bar]")?.addEventListener("click", () => openAiCommandBar());
document.querySelector("[data-ai-command-close]")?.addEventListener("click", closeAiCommandBar);
document.querySelector("[data-ai-command-run]")?.addEventListener("click", () => prepareAiCommand(aiCommandInput?.value ?? ""));

aiCommandInput?.addEventListener("input", () => {
  activeAiCommandIndex = 0;
  renderAiCommandBar();
});

aiCommandInput?.addEventListener("keydown", (event) => {
  event.stopPropagation();
  const matches = matchingAiCommands(aiCommandInput.value);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const count = Math.max(1, matches.length);
    activeAiCommandIndex = (activeAiCommandIndex + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
    renderAiCommandBar();
    document.querySelector(".ai-command-suggestions button.active")?.scrollIntoView({ block: "nearest" });
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const selected = matches[activeAiCommandIndex];
    prepareAiCommand(selected?.command ?? aiCommandInput.value);
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeAiCommandBar();
  }
});

aiCommandSuggestions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-ai-command-suggestion]");
  if (!button) return;
  aiCommandInput.value = button.dataset.aiCommandSuggestion;
  prepareAiCommand(aiCommandInput.value);
});

aiCommandBackdrop?.addEventListener("click", (event) => {
  if (event.target === aiCommandBackdrop) closeAiCommandBar();
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openGlobalSearch();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "i") {
    event.preventDefault();
    openAiCommandBar();
    return;
  }
  if (event.key === "Escape") {
    if (document.activeElement?.isContentEditable) return;
    let modalWasOpen = false;
    if (!aiCommandBackdrop?.hidden) { closeAiCommandBar(); modalWasOpen = true; }
    if (!globalSearch?.hidden) { closeGlobalSearch(); modalWasOpen = true; }
    if (!document.querySelector("[data-export-modal]").hidden) { document.querySelector("[data-export-modal]").hidden = true; modalWasOpen = true; }
    if (!document.querySelector("[data-project-modal]").hidden) { document.querySelector("[data-project-modal]").hidden = true; modalWasOpen = true; }
    if (!document.querySelector("[data-shortcuts-modal]").hidden) { document.querySelector("[data-shortcuts-modal]").hidden = true; modalWasOpen = true; }
    if (!document.querySelector("[data-settings-modal]").hidden) { document.querySelector("[data-settings-modal]").hidden = true; modalWasOpen = true; }
    recordingShortcutAction = null;
    document.querySelector(".tool-panel").classList.remove("open");
    renderShortcutsModal();
    if (!modalWasOpen && !isTextEditing()) {
      editor.clearSelection();
      syncEditorToDom();
    }
    return;
  }
  if (handleShortcutEvent(event)) return;
  if ((event.key === "," || event.key === ".") && !isTextEditing()) {
    playback.configure({ fps: editor.state.fps, duration: editor.state.duration, time: editor.state.time, rate: playbackSpeed, canvasZoom: editor.state.canvasZoom });
    playback.step(event.key === "." ? 1 : -1);
    updateTimecode();
  }
});

document.addEventListener("click", (event) => {
  const dismiss = event.target.closest("[data-dismiss-notification]");
  if (dismiss) dismissNotification(dismiss.dataset.dismissNotification);
  if (!event.target.closest("[data-context-menu]")) closeContextMenu();
  if (!event.target.closest("[data-open-export]") && !event.target.closest("[data-export-dropdown]")) exportDropdown.hidden = true;
});

document.querySelector("[data-error-center]")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-error-center-close]")) {
    document.querySelector("[data-error-center]").hidden = true;
    return;
  }
  const dismiss = event.target.closest("[data-dismiss-error]");
  if (!dismiss) return;
  editor.clearErrorNotification(dismiss.dataset.dismissError);
  persistErrorState();
  renderErrorCenter();
});

window.addEventListener("error", (event) => {
  reportUiError(event.error ?? event.message, { source: "runtime", severity: "critical", userMessage: "A crash was contained. Recovery data was preserved." });
});

window.addEventListener("unhandledrejection", (event) => {
  reportUiError(event.reason ?? "Unhandled promise rejection", { source: "runtime", severity: "error", userMessage: "A background task failed safely." });
});

window.addEventListener("pagehide", () => {
  playing = false;
  playback.dispose();
  clearTransientTimers();
  editor.dispose?.();
  mediaThumbObserver?.disconnect();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  if (playing) {
    playback.pause();
    showToast("Preview paused");
  }
  stopMediaPreviewPlayback();
});

document.querySelectorAll(".asset-card").forEach((card) => {
  card.addEventListener("click", () => {
    setActiveWithin(".asset-card", card);
    document.querySelector(".scene-kicker").textContent = card.dataset.scene;
    document.querySelector(".meter-chip").textContent = `Source duration: ${card.dataset.duration}`;
    showToast(`${card.dataset.scene} highlighted`);
  });
});

document.querySelector('[aria-label="Undo"]')?.addEventListener("click", () => {
  editor.undo();
  updateTimecode();
});

document.querySelector('[aria-label="Redo"]')?.addEventListener("click", () => {
  editor.redo();
  updateTimecode();
});

document.querySelectorAll("[data-play-preview]").forEach((button) => button.addEventListener("click", togglePlayback));

document.querySelectorAll("[data-step]").forEach((button) => {
  button.addEventListener("click", () => {
    playback.configure({ fps: editor.state.fps, duration: editor.state.duration, time: editor.state.time, rate: playbackSpeed, canvasZoom: editor.state.canvasZoom });
    playback.step(Number(button.dataset.step));
    updateTimecode();
  });
});

document.querySelectorAll("[data-zoom]").forEach((button) => {
  button.addEventListener("click", () => {
    setTimelineZoom(timelineZoom + Number(button.dataset.zoom) * 0.15);
  });
});

document.querySelector("[data-zoom-fit]")?.addEventListener("click", () => {
  editor.zoomToFit();
  setTimelineZoom(editor.state.zoom);
  showToast("Zoomed to fit project");
});

document.querySelector("[data-zoom-selection]")?.addEventListener("click", () => {
  editor.zoomToSelection();
  setTimelineZoom(editor.state.zoom);
  showToast("Zoomed to selection");
});

timelineEditor?.addEventListener("scroll", () => {
  timelineRenderScheduler.request();
}, { passive: true });

timelineEditor?.addEventListener("wheel", (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.08 : 0.08;
  setTimelineZoom(timelineZoom + delta);
}, { passive: false });

(function initMarqueeSelection() {
  const canvas = document.querySelector(".timeline-canvas");
  const marquee = document.querySelector("[data-marquee]");
  if (!canvas || !marquee) return;
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  canvas.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".timeline-playhead, .snap-guide")) return;
    const lane = e.target.closest("[data-track-lane]");
    if (lane) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    marquee.hidden = false;
    marquee.style.left = `${startX}px`;
    marquee.style.top = `${startY}px`;
    marquee.style.width = "0px";
    marquee.style.height = "0px";
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    marquee.style.left = `${x}px`;
    marquee.style.top = `${y}px`;
    marquee.style.width = `${w}px`;
    marquee.style.height = `${h}px`;
    const marqueeRect = { left: x, top: y, right: x + w, bottom: y + h };
    document.querySelectorAll(".edit-clip, .caption-block").forEach((el) => {
      const clipRect = el.getBoundingClientRect();
      const overlaps = clipRect.left < marqueeRect.right && clipRect.right > marqueeRect.left && clipRect.top < marqueeRect.bottom && clipRect.bottom > marqueeRect.top;
      el.classList.toggle("marquee-selected", overlaps);
    });
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    marquee.hidden = true;
    const marqueeRect = { left: parseFloat(marquee.style.left), top: parseFloat(marquee.style.top), right: parseFloat(marquee.style.left) + parseFloat(marquee.style.width), bottom: parseFloat(marquee.style.top) + parseFloat(marquee.style.height) };
    const additive = e.ctrlKey || e.metaKey;
    if (!additive) editor.clearSelection();
    document.querySelectorAll(".edit-clip.marquee-selected, .caption-block.marquee-selected").forEach((el) => {
      editor.selectClip(el.dataset.clipId, { additive: true });
      el.classList.remove("marquee-selected");
    });
    syncEditorToDom();
    const count = editor.state.selectedClipIds.length;
    if (count > 0) showToast(`${count} clip${count === 1 ? "" : "s"} selected`);
  });
})();

(function initEnhancedSnap() {
  const origMagnetic = bindTimelineClip?.prototype?.magneticSnap;
  const markerSnapPoints = [];
  function getMarkerSnapPoints() {
    markerSnapPoints.length = 0;
    document.querySelectorAll(".tl-marker").forEach((m) => {
      const time = Number(m.dataset.time);
      if (!isNaN(time)) markerSnapPoints.push(time);
    });
    for (let i = 0; i <= editor.state.duration; i += 10) {
      markerSnapPoints.push(i);
    }
    return markerSnapPoints;
  }
  window.__getMarkerSnapPoints = getMarkerSnapPoints;
})();

(function initTrackReorder() {
  document.querySelectorAll(".timeline-track-head:not(.ruler-spacer)").forEach((head) => {
    head.addEventListener("dblclick", (e) => {
      const nameEl = head.querySelector("strong");
      if (!nameEl) return;
      const lane = head.nextElementSibling;
      const trackId = lane?.dataset.trackId;
      if (!trackId) return;
      const currentName = nameEl.textContent;
      const input = document.createElement("input");
      input.type = "text";
      input.value = currentName;
      input.className = "track-rename-input";
      input.style.cssText = "background:rgba(255,255,255,0.08);border:1px solid rgba(0,210,255,0.4);border-radius:4px;color:var(--ink);font:inherit;font-size:12px;font-weight:800;padding:2px 4px;width:100%;";
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const commit = () => {
        const newName = input.value.trim() || currentName;
        editor.renameTrack(trackId, newName);
        const newStrong = document.createElement("strong");
        newStrong.textContent = newName;
        input.replaceWith(newStrong);
        showToast(`Track renamed to "${newName}"`);
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") input.blur();
        if (ev.key === "Escape") { input.value = currentName; input.blur(); }
      });
    });
  });
})();

(function initTrackResize() {
  let resizing = false;
  let startY = 0;
  let startHeight = 0;
  let targetLane = null;
  document.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".track-resize-handle");
    if (!handle) return;
    const head = handle.closest(".timeline-track-head");
    targetLane = head?.nextElementSibling;
    if (!targetLane) return;
    resizing = true;
    startY = e.clientY;
    startHeight = targetLane.offsetHeight;
    document.body.classList.add("is-dragging");
    e.preventDefault();
  });
  document.addEventListener("pointermove", (e) => {
    if (!resizing || !targetLane) return;
    const delta = e.clientY - startY;
    const newHeight = Math.max(24, Math.min(200, startHeight + delta));
    targetLane.style.minHeight = `${newHeight}px`;
  });
  document.addEventListener("pointerup", () => {
    if (resizing) {
      resizing = false;
      targetLane = null;
      document.body.classList.remove("is-dragging");
    }
  });
})();

(function initAutoScrollPlayback() {
  let lastPlaying = false;
  function checkAutoScroll() {
    if (playing && !lastPlaying) {
      lastPlaying = true;
      startPlaybackAutoScroll();
    }
    if (!playing && lastPlaying) {
      lastPlaying = false;
      stopPlaybackAutoScroll();
    }
    requestAnimationFrame(checkAutoScroll);
  }
  let autoScrollRaf = null;
  function startPlaybackAutoScroll() {
    const scrollArea = document.querySelector("[data-timeline-scroll]");
    if (!scrollArea) return;
    function tick() {
      if (!playing) return;
      const playheadX = (playback.currentTime ?? 0) * clipUnit();
      const viewportLeft = scrollArea.scrollLeft;
      const viewportRight = viewportLeft + scrollArea.clientWidth;
      const margin = scrollArea.clientWidth * 0.15;
      if (playheadX > viewportRight - margin) {
        scrollArea.scrollLeft = playheadX - scrollArea.clientWidth * 0.3;
      } else if (playheadX < viewportLeft + margin) {
        scrollArea.scrollLeft = playheadX - scrollArea.clientWidth * 0.7;
      }
      autoScrollRaf = requestAnimationFrame(tick);
    }
    autoScrollRaf = requestAnimationFrame(tick);
  }
  function stopPlaybackAutoScroll() {
    if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf);
    autoScrollRaf = null;
  }
  requestAnimationFrame(checkAutoScroll);
})();

(function initSlipSlideEditing() {
  document.addEventListener("keydown", (e) => {
    if (isTextEditing()) return;
    const clip = editor.selectedClips[0];
    if (!clip) return;
    if (e.key === "j" && e.altKey) {
      e.preventDefault();
      editor.slipEdit(clip.id, -0.5);
      renderTimelineFromState();
      applyAnimatedPreviewFrame();
      showToast("Slip edit left");
    }
    if (e.key === "l" && e.altKey) {
      e.preventDefault();
      editor.slipEdit(clip.id, 0.5);
      renderTimelineFromState();
      applyAnimatedPreviewFrame();
      showToast("Slip edit right");
    }
    if (e.key === "j" && e.shiftKey && !e.altKey) {
      e.preventDefault();
      editor.slideEdit(clip.id, -0.5);
      renderTimelineFromState();
      applyAnimatedPreviewFrame();
      showToast("Slide edit left");
    }
    if (e.key === "l" && e.shiftKey && !e.altKey) {
      e.preventDefault();
      editor.slideEdit(clip.id, 0.5);
      renderTimelineFromState();
      applyAnimatedPreviewFrame();
      showToast("Slide edit right");
    }
  });
})();

(function initDisableClips() {
  document.addEventListener("keydown", (e) => {
    if (isTextEditing()) return;
    if (e.key === "d" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      editor.selectedClips.forEach((clip) => editor.toggleClipDisabled(clip.id));
      renderTimelineFromState();
      showToast("Clip visibility toggled");
    }
  });
})();

(function initSmoothTimelineScroll() {
  const scrollArea = document.querySelector("[data-timeline-scroll]");
  if (!scrollArea) return;
  let inertialRaf = null;
  let velocityX = 0;
  let lastWheelTime = 0;
  scrollArea.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      velocityX = e.deltaX;
    } else if (Math.abs(e.deltaY) > 2) {
      velocityX = e.deltaY * 0.5;
    } else {
      return;
    }
    lastWheelTime = performance.now();
    if (!inertialRaf) {
      function tick() {
        const elapsed = performance.now() - lastWheelTime;
        if (elapsed > 150) {
          velocityX *= 0.92;
        }
        if (Math.abs(velocityX) < 0.5) {
          inertialRaf = null;
          return;
        }
        scrollArea.scrollLeft += velocityX;
        inertialRaf = requestAnimationFrame(tick);
      }
      inertialRaf = requestAnimationFrame(tick);
    }
  }, { passive: true });
})();

document.querySelectorAll("[data-timeline-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.timelineAction;
    if (action === "undo") editor.undo();
    if (action === "redo") editor.redo();
    if (action === "split") editor.splitSelected(editor.state.time);
    if (action === "ripple-delete") editor.deleteSelected({ ripple: true });
    updateTimecode();
    showToast({
      undo: "Timeline undo",
      redo: "Timeline redo",
      split: "Split selected clips at playhead",
      "ripple-delete": "Ripple deleted selected clips",
    }[action]);
  });
});

document.querySelectorAll("[data-toggle-timeline]").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    button.setAttribute("aria-pressed", String(button.classList.contains("active")));
    editor.state[button.dataset.toggleTimeline] = button.classList.contains("active");
    const snap = document.querySelector('[data-toggle-timeline="snap"]').classList.contains("active") ? "Snap on" : "Snap off";
    const magnetic = document.querySelector('[data-toggle-timeline="magnetic"]').classList.contains("active") ? "Magnetic editing on" : "Magnetic editing off";
    document.querySelector("[data-timeline-status]").textContent = `${snap} - ${magnetic}`;
  });
});

document.querySelectorAll(".timeline-track-head").forEach((head) => {
  const lane = head.nextElementSibling;
  const track = trackForLane(lane);
  if (track?.type === "audio" && ![...head.querySelectorAll(".track-mini")].some((button) => (button.dataset.toast || "").includes("mute"))) {
    const actions = head.querySelector(".track-actions") || head;
    const mute = document.createElement("button");
    mute.className = "track-mini";
    mute.dataset.toast = "Mute toggled";
    mute.setAttribute("aria-pressed", "false");
    mute.title = "Toggle mute";
    mute.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>`;
    actions.appendChild(mute);
  }
});

document.querySelectorAll(".track-mini").forEach((button) => {
  button.addEventListener("click", () => {
    const head = button.closest(".timeline-track-head");
    const lane = head.nextElementSibling;
    const trackId = lane?.dataset.trackId;
    const toastText = (button.dataset.toast || "").toLowerCase();
    const isVisibility = toastText.includes("visibility");
    const isLock = toastText.includes("lock");
    const isMute = toastText.includes("mute");
    const isSolo = toastText.includes("solo");
    if (isVisibility) {
      head.classList.toggle("hidden-track");
      lane?.classList.toggle("hidden-track-lane", head.classList.contains("hidden-track"));
    }
    if (isLock) {
      button.classList.toggle("locked");
      head.classList.toggle("locked-track", button.classList.contains("locked"));
      lane?.classList.toggle("locked-track-lane", button.classList.contains("locked"));
    }
    if (isMute) button.classList.toggle("locked");
    if (isSolo) {
      editor.soloTrack(trackId);
      button.classList.toggle("active", editor.state.tracks.find((t) => t.id === trackId)?.solo);
      renderTimelineFromState();
    }
    if (!isMute && !isSolo) button.classList.toggle("active");
    button.setAttribute("aria-pressed", String(isMute ? button.classList.contains("locked") : button.classList.contains("active")));
    if (trackId && isVisibility) editor.setTrackState(trackId, { visible: !head.classList.contains("hidden-track") });
    if (trackId && isLock) editor.setTrackState(trackId, { locked: button.classList.contains("locked") });
    if (trackId && isMute) editor.setTrackAudio(trackId, { muted: button.classList.contains("locked") });
  });
});

document.querySelectorAll(".timeline-track-head strong").forEach((name) => {
  name.title = "Double-click to rename track";
  name.addEventListener("dblclick", () => {
    name.contentEditable = "true";
    name.focus();
    document.getSelection()?.selectAllChildren(name);
  });
  name.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      name.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      name.textContent = name.dataset.previousName || name.textContent;
      name.blur();
    }
  });
  name.addEventListener("focus", () => {
    name.dataset.previousName = name.textContent.trim();
  });
  name.addEventListener("blur", () => {
    name.contentEditable = "false";
    const nextName = name.textContent.trim() || name.dataset.previousName || "Track";
    name.textContent = nextName;
    const trackId = name.closest(".timeline-track-head")?.nextElementSibling?.dataset.trackId;
    if (trackId) editor.setTrackState(trackId, { name: nextName });
    showToast(`Track renamed to ${nextName}`);
  });
});

document.querySelectorAll(".track-collapse").forEach((button) => {
  button.addEventListener("click", () => {
    const head = button.closest(".timeline-track-head");
    const lane = head.nextElementSibling;
    head.classList.toggle("collapsed");
    button.textContent = head.classList.contains("collapsed") ? "+" : "-";
    if (lane?.classList.contains("track-lane") || lane?.dataset.trackId) {
      lane.style.display = head.classList.contains("collapsed") ? "none" : "";
    }
  });
});

/* ── Playhead scrubbing ────────────────────────────────────
   Drag the playhead head, or click/drag anywhere on the ruler.
   pointermove/pointerup live on window so the drag survives the
   cursor leaving the element. All position updates flow through
   playback.seek -> editor.state.time -> updateTimecode(), so state
   is the single source of truth; nothing writes .left directly. */
{
  const playhead = document.querySelector("[data-cursor]");
  let scrubbing = false;
  let resumeAfterScrub = false;

  function seekToPointer(event) {
    playback.configure({
      fps: editor.state.fps,
      duration: editor.state.duration,
      rate: playbackSpeed,
      canvasZoom: editor.state.canvasZoom,
    });
    playback.seek(timelineTimeFromPointer(event));
    updateTimecode();
  }

  function onPointerMove(event) {
    if (!scrubbing) return;
    event.preventDefault();
    seekToPointer(event);
  }

  function endScrub(event) {
    if (!scrubbing) return;
    scrubbing = false;
    document.body.classList.remove("is-scrubbing");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endScrub);
    window.removeEventListener("pointercancel", endScrub);
    const target = event?.currentTarget;
    if (target?.releasePointerCapture && event?.pointerId != null) {
      try { target.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    }
    if (resumeAfterScrub) {
      resumeAfterScrub = false;
      playback.play();
    }
  }

  function beginScrub(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    scrubbing = true;
    // Pause during the scrub so playback doesn't fight the drag.
    if (playing) {
      resumeAfterScrub = true;
      playback.pause();
    }
    document.body.classList.add("is-scrubbing");
    const el = event.currentTarget;
    if (el?.setPointerCapture) {
      try { el.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endScrub);
    window.addEventListener("pointercancel", endScrub);
    seekToPointer(event);
  }

  // Grab targets: the head, the widened invisible hit strip, and the ruler.
  playhead?.querySelector("button")?.addEventListener("pointerdown", beginScrub);
  playhead?.querySelector(".playhead-hit")?.addEventListener("pointerdown", beginScrub);
  timelineRulerEl()?.addEventListener("pointerdown", beginScrub);
}

/* Drag the grip at the top of the timeline to make it taller or shorter.
   Listeners go on window so the drag keeps tracking past the 8px handle. */
{
  const resizer = document.querySelector("[data-timeline-resizer]");
  const MIN_TIMELINE_H = 140;

  function onResizeMove(event) {
    const maxHeight = Math.round(window.innerHeight * 0.7);
    const next = Math.min(maxHeight, Math.max(MIN_TIMELINE_H, window.innerHeight - event.clientY - 14));
    document.documentElement.style.setProperty("--timeline-height", `${next}px`);
  }

  function endResize() {
    document.body.classList.remove("is-resizing-timeline");
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", endResize);
    window.removeEventListener("pointercancel", endResize);
    updateTimelineRuler();
    updateTimecode();
  }

  resizer?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    document.body.classList.add("is-resizing-timeline");
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
  });
}

/* Pixels-per-second for the timeline.

   `--unit` is a custom property holding `calc(16px * var(--zoom))`.
   getPropertyValue() returns that token stream verbatim, NOT a resolved
   length, so parseFloat() on it is NaN and every caller silently fell back
   to 16px — which is why the timeline ignored zoom. We resolve it properly
   by letting the browser compute a real length on a probe element. */
const TIMELINE_BASE_UNIT = 16; // px per second at zoom 1, matches --unit in CSS

function timelinePixelsPerSecond() {
  if (!timelineEditor) return TIMELINE_BASE_UNIT;
  // --zoom is a bare number, so unlike --unit (a calc() token stream) it
  // parses reliably. No cache: this is a couple of string reads.
  const raw = timelineEditor.style.getPropertyValue("--zoom")
    || getComputedStyle(timelineEditor).getPropertyValue("--zoom");
  const zoom = Number.parseFloat(raw);
  return TIMELINE_BASE_UNIT * (Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
}

function clipUnit() {
  return timelinePixelsPerSecond();
}

function setSnapGuide(time, visible = true) {
  if (!snapGuide) return;
  snapGuide.hidden = !visible;
  if (visible) snapGuide.style.left = `calc(${time.toFixed(2)} * var(--unit))`;
}

function showAlignmentGuides(clipStart, clipEnd, trackId) {
  const guidesContainer = document.querySelector("[data-alignment-guides]");
  if (!guidesContainer) return;
  guidesContainer.innerHTML = "";
  const SNAP_THRESHOLD = 0.15;
  editor.state.clips.forEach((otherClip) => {
    if (otherClip.trackId !== trackId) return;
    const otherStart = otherClip.timelineStart ?? otherClip.start;
    const otherEnd = otherStart + otherClip.duration;
    [otherStart, otherEnd].forEach((point) => {
      if (Math.abs(clipStart - point) < SNAP_THRESHOLD || Math.abs(clipEnd - point) < SNAP_THRESHOLD) {
        const guide = document.createElement("div");
        guide.className = "alignment-guide-line";
        guide.style.left = `calc(${point.toFixed(2)} * var(--unit))`;
        guidesContainer.appendChild(guide);
      }
    });
  });
}

function hideAlignmentGuides() {
  const guidesContainer = document.querySelector("[data-alignment-guides]");
  if (guidesContainer) guidesContainer.innerHTML = "";
}

function setDragPayload(event, payload) {
  dragSession = createDragSession(payload, performance.now());
  event.dataTransfer.effectAllowed = dragSession.effectAllowed;
  event.dataTransfer.setData("application/x-launchly-drag", JSON.stringify(dragSession));
  event.dataTransfer.setData("text/plain", payload.label ?? payload.type ?? "Launchly item");
}

function readDragPayload(event) {
  if (dragSession) return dragSession;
  const raw = event.dataTransfer?.getData("application/x-launchly-drag");
  if (!raw) return null;
  try {
    dragSession = normalizeDragPayload(JSON.parse(raw));
    return dragSession;
  } catch {
    return null;
  }
}

function clearDragState() {
  dragSession = null;
  dragLastEvent = null;
  setSnapGuide(0, false);
  document.body.classList.remove("is-dragging");
  document.querySelectorAll(".drop-ready, .drop-target, .drop-invalid").forEach((item) => item.classList.remove("drop-ready", "drop-target", "drop-invalid"));
  if (dragScrollRaf) cancelAnimationFrame(dragScrollRaf);
  dragScrollRaf = null;
}

function updateDropIndicator(event, lane) {
  const payload = readDragPayload(event);
  const track = trackForLane(lane);
  const time = editor.snapTime(timelineTimeFromPointer(event));
  const valid = canDropPayloadOnTrack(payload, track);
  document.querySelectorAll(".track-lane.drop-target, .track-lane.drop-invalid").forEach((item) => item.classList.remove("drop-target", "drop-invalid"));
  lane.classList.add(valid ? "drop-target" : "drop-invalid");
  lane.classList.add("drop-ready");
  setSnapGuide(time, valid);
  return { payload, track, time, valid };
}

function autoScrollTimeline(event) {
  dragLastEvent = event;
  if (dragScrollRaf) return;
  const tick = () => {
    dragScrollRaf = null;
    if (!dragLastEvent || !dragSession) return;
    const rect = timelineEditor.getBoundingClientRect();
    const edge = 72;
    let dx = 0;
    let dy = 0;
    if (dragLastEvent.clientX > rect.right - edge) dx = 18;
    if (dragLastEvent.clientX < rect.left + edge) dx = -18;
    if (dragLastEvent.clientY > rect.bottom - edge) dy = 10;
    if (dragLastEvent.clientY < rect.top + edge) dy = -10;
    if (dx || dy) {
      timelineEditor.scrollBy({ left: dx, top: dy, behavior: "auto" });
      timelineRenderScheduler.request();
      dragScrollRaf = requestAnimationFrame(tick);
    }
  };
  dragScrollRaf = requestAnimationFrame(tick);
}

function applyGlobalDrop(payload, lane, event) {
  if (!payload || !lane) return false;
  const track = trackForLane(lane);
  if (!track || track.locked) return false;
  if (!canDropPayloadOnTrack(payload, track)) return false;
  const time = editor.snapTime(timelineTimeFromPointer(event));
  if (payload.type === "media") {
    payload.items.forEach((item, index) => createTimelineClipFromPayload({ ...item, timelineStart: time + index * 0.25 }, lane, event));
    return true;
  }
  if (payload.type === "text") {
    return Boolean(createTimelineClipFromPayload({ name: payload.text ?? "Text Layer", type: "text", mediaType: "Text", duration: 5, originalDuration: 5, sourceStart: 0, sourceEnd: 5, timelineStart: time, textLayer: { text: payload.text ?? "Text Layer", kind: "title" } }, lane, event));
  }
  const targetClip = event.target.closest(".edit-clip, .caption-block");
  if (targetClip) editor.selectClip(targetClip.dataset.clipId);
  if (payload.type === "transition") {
    editor.addTransition("video", payload.duration ?? 0.6, payload.name ?? "Fade", payload.direction ?? "out");
    return true;
  }
  if (payload.type === "effect") {
    editor.addEffect(payload.effectType ?? "blur");
    return true;
  }
  if (payload.type === "clip") {
    payload.clipIds.forEach((clipId, index) => editor.moveClip(clipId, time + index * 0.25, { trackId: track.id }));
    return true;
  }
  return false;
}

function isClipTrackLocked(clip) {
  const trackId = clip.closest("[data-track-lane]")?.dataset.trackId;
  return trackId ? editor.isTrackLocked(trackId) : false;
}

function trackForLane(lane) {
  return editor.state.tracks.find((track) => track.id === lane?.dataset.trackId);
}

function mediaTypeToClipType(type) {
  return type === "Audio" ? "audio" : type === "Image" ? "image" : "video";
}

function clipClassForType(clip) {
  if (clip.type === "audio") return "clip-audio";
  if (clip.type === "image") return "clip-broll";
  if (clip.type === "text") return "clip-text";
  if (clip.type === "caption") return "caption-block";
  return "clip-video";
}

function createClipElement(clip) {
  const isCaption = clip.type === "caption";
  const element = document.createElement("button");
  element.type = "button";
  element.draggable = true;
  element.className = isCaption ? "caption-block" : `edit-clip ${clipClassForType(clip)}`;
  if (clip.hidden) element.classList.add("layer-hidden");
  element.dataset.clipId = clip.id;
  element.dataset.colorLabel = clip.colorLabel ?? "";
  element.style.setProperty("--start", (clip.timelineStart ?? clip.start).toFixed(2));
  element.style.setProperty("--length", clip.duration.toFixed(2));
  const title = clip.name || "Untitled clip";
  if (isCaption) {
    element.innerHTML = `<span>${escapeHtml(title)}</span>`;
  } else if (clip.type === "audio") {
    const waveformHtml = (clip.audio?.waveform ?? []).slice(0, 48).map((sample) => `<i style="--h:${Math.max(8, Math.round(sample * 100))}%"></i>`).join("");
    element.innerHTML = `<div class="clip-content"><span class="clip-name">${escapeHtml(title)}</span><span class="clip-meta">Audio · ${formatTimecode(clip.duration)}</span></div><span class="audio-wave">${waveformHtml}</span><b class="fade-handle left"></b><b class="fade-handle right"></b>`;
  } else if (clip.type === "video" || clip.type === "image") {
    element.innerHTML = `<span class="clip-thumb"></span><div class="clip-content"><span class="clip-name">${escapeHtml(title)}</span><span class="clip-meta">${formatTimecode(clip.duration)}</span></div><b class="trim-handle left"></b><b class="trim-handle right"></b>`;
    requestAnimationFrame(() => renderClipThumbnail(element, clip));
  } else {
    element.innerHTML = `<div class="clip-content"><span class="clip-name">${escapeHtml(title)}</span><span class="clip-meta">${formatTimecode(clip.duration)}</span></div><b class="trim-handle left"></b><b class="trim-handle right"></b>`;
  }
  renderClipKeyframes(element, clip);
  clipElementCache.set(clip.id, element);
  renderClipTransitions(element, clip);
  bindTimelineClip(element);
  return element;
}

function renderClipThumbnail(element, clip) {
  const thumb = element.querySelector(".clip-thumb");
  if (!thumb) return;
  const asset = editor.state.assetManager?.assets?.find((a) => a.id === clip.assetId);
  if (!asset?.url) {
    thumb.style.background = clip.type === "video"
      ? "linear-gradient(135deg, rgba(112,228,255,0.25), rgba(143,247,200,0.15))"
      : "linear-gradient(135deg, rgba(184,226,209,0.3), rgba(143,247,200,0.15))";
    return;
  }
  const canvas = document.createElement("canvas");
  const stripWidth = 5;
  const stripHeight = 18;
  canvas.width = stripWidth * 24;
  canvas.height = stripHeight;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.borderRadius = "3px";
  canvas.style.objectFit = "cover";
  thumb.innerHTML = "";
  thumb.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = asset.url;
  img.onload = () => {
    const cols = Math.min(stripWidth, Math.ceil(element.getBoundingClientRect().width / 24) || stripWidth);
    canvas.width = cols * 24;
    for (let i = 0; i < cols; i++) {
      const sx = (i / cols) * img.naturalWidth;
      const sw = img.naturalWidth / cols;
      ctx.drawImage(img, sx, 0, sw, img.naturalHeight, i * 24, 0, 24, stripHeight);
    }
  };
  img.onerror = () => {
    thumb.style.background = "linear-gradient(135deg, rgba(112,228,255,0.2), rgba(143,247,200,0.12))";
    canvas.remove();
  };
}

function renderClipTransitions(element, clip) {
  const handles = element.querySelector(".transition-handles");
  if (!handles) return;
  handles.innerHTML = "";
  (clip.transitions ?? []).forEach((transition) => {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = `transition-handle ${transition.direction === "in" ? "in" : "out"}`;
    handle.dataset.transitionId = transition.id;
    handle.dataset.transitionDir = transition.direction ?? "left";
    handle.title = `${transition.name} · ${transition.direction} · ${transition.easing} · ${transition.duration.toFixed(2)}s`;
    handle.style.setProperty("--transition-duration", `${transition.duration}s`);
    handle.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelector("[data-transition-name]").value = transition.name;
      document.querySelector("[data-transition-duration]").value = String(Math.round(transition.duration * 100));
      document.querySelector("[data-transition-duration-value]").textContent = `${transition.duration.toFixed(2)}s`;
      document.querySelector("[data-transition-easing]").value = transition.easing ?? "ease-in-out";
      const dirBtns = document.querySelectorAll(".transition-dir-btn");
      dirBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.dir === (transition.direction ?? "left")));
      editor.state.selectedTransitionId = transition.id;
      renderTransitionPanel();
    });
    handle.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("dragging");
      const startX = event.clientX;
      const origDuration = transition.duration;
      const move = (moveEvent) => {
        const delta = (moveEvent.clientX - startX) / 100;
        const newDuration = Math.max(0.05, Math.min(3, origDuration + delta));
        editor.updateTransition(transition.id, { duration: newDuration });
        document.querySelector("[data-transition-duration]").value = String(Math.round(newDuration * 100));
        document.querySelector("[data-transition-duration-value]").textContent = `${newDuration.toFixed(2)}s`;
        renderTimelineFromState();
      };
      const cleanup = () => {
        handle.classList.remove("dragging");
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", cleanup);
        handle.removeEventListener("pointercancel", cleanup);
        renderTransitionPanel();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", cleanup);
      handle.addEventListener("pointercancel", cleanup);
    });
    handles.appendChild(handle);
    const indicator = document.createElement("span");
    indicator.className = "transition-indicator";
    indicator.title = transition.name;
    handles.appendChild(indicator);
  });
}

function renderClipKeyframes(element, clip) {
  const markerLayer = element.querySelector(".keyframe-markers");
  if (!markerLayer) return;
  markerLayer.innerHTML = "";
  (clip.keyframes ?? []).forEach((keyframe) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `keyframe-marker${editor.state.selectedKeyframeIds.includes(keyframe.id) ? " selected" : ""}`;
    marker.dataset.keyframeId = keyframe.id;
    marker.style.left = `${Math.max(0, Math.min(100, (keyframe.time / clip.duration) * 100))}%`;
    marker.title = `${keyframe.property} ${keyframe.easing} ${keyframe.time.toFixed(2)}s`;
    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      editor.selectKeyframe(keyframe.id, { additive: event.shiftKey || event.ctrlKey || event.metaKey });
      renderTimelineFromState();
      renderKeyframePanel();
    });
    marker.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      marker.setPointerCapture(event.pointerId);
      editor.selectKeyframe(keyframe.id, { additive: event.shiftKey || event.ctrlKey || event.metaKey });
      marker.classList.add("dragging");
      const move = (moveEvent) => {
        const rect = markerLayer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
        const nextLocalTime = percent * clip.duration;
        const nextTimelineTime = (clip.timelineStart ?? clip.start) + nextLocalTime;
        editor.moveKeyframeToTime(keyframe.id, nextLocalTime);
        marker.style.left = `${percent * 100}%`;
        playback.configure({ fps: editor.state.fps, duration: editor.state.duration, time: nextTimelineTime, rate: playbackSpeed, canvasZoom: editor.state.canvasZoom });
        playback.seek(nextTimelineTime);
        applyAnimatedPreviewFrame();
      };
      const up = () => {
        marker.classList.remove("dragging");
        marker.removeEventListener("pointermove", move);
        marker.removeEventListener("pointerup", up);
        marker.removeEventListener("pointercancel", up);
        renderTimelineFromState();
        renderKeyframePanel();
        persistTimelineEdit("keyframe:move");
      };
      marker.addEventListener("pointermove", move);
      marker.addEventListener("pointerup", up, { once: true });
      marker.addEventListener("pointercancel", up, { once: true });
    });
    markerLayer.appendChild(marker);
  });
}

function currentTimelineWindow() {
  return timelineViewportWindow({
    scrollLeft: timelineEditor.scrollLeft,
    clientWidth: timelineEditor.clientWidth,
    unit: clipUnit(),
    bufferSeconds: 18,
  });
}

function renderTimelineFromState() {
  const visibleWindow = currentTimelineWindow();
  let mountedClips = 0;
  let virtualizedClips = 0;
  editor.state.tracks.forEach(ensureTimelineTrackDom);
  document.querySelectorAll("[data-track-lane]").forEach((lane) => {
    const trackId = lane.dataset.trackId;
    const existingClips = lane.querySelectorAll(".edit-clip, .caption-block");
    const existingIds = new Set();
    existingClips.forEach((el) => existingIds.add(el.dataset.clipId));
    const visibleClips = editor.state.clips
      .filter((clip) => clip.trackId === trackId)
      .filter((clip) => {
        const visible = isClipInWindow(clip, visibleWindow) || editor.state.selectedClipIds.includes(clip.id);
        if (!visible) virtualizedClips += 1;
        return visible;
      })
      .sort((a, b) => (a.timelineStart ?? a.start) - (b.timelineStart ?? b.start));
    const neededIds = new Set(visibleClips.map((c) => c.id));
    existingClips.forEach((el) => { if (!neededIds.has(el.dataset.clipId)) { clipElementCache.delete(el.dataset.clipId); el.remove(); } });
    const fragment = document.createDocumentFragment();
    visibleClips.forEach((clip) => {
      if (existingIds.has(clip.id)) return;
      fragment.appendChild(createClipElement(clip));
    });
    lane.appendChild(fragment);
    mountedClips += visibleClips.length;
  });
  timelineEditor.dataset.mountedClips = String(mountedClips);
  timelineEditor.dataset.virtualizedClips = String(virtualizedClips);
  const timelineEmpty = document.querySelector("[data-timeline-empty-state]");
  if (timelineEmpty) timelineEmpty.hidden = editor.state.clips.length > 0;
  const status = document.querySelector("[data-timeline-status]");
  if (status) {
    const snap = document.querySelector('[data-toggle-timeline="snap"]')?.classList.contains("active") ? "Snap on" : "Snap off";
    const magnetic = document.querySelector('[data-toggle-timeline="magnetic"]')?.classList.contains("active") ? "Magnetic editing on" : "Magnetic editing off";
    status.textContent = `${snap} - ${magnetic} - ${mountedClips} clips active`;
  }
  syncEditorToDom();
}

function ensureTimelineTrackDom(track) {
  if (document.querySelector(`[data-track-lane="${track.id}"], [data-track-lane][data-track-id="${track.id}"]`)) return;
  const editorEl = document.querySelector(".timeline-editor");
  const firstAudioHead = [...document.querySelectorAll(".timeline-track-head")].find((head) => head.querySelector("span")?.textContent?.startsWith("A"));
  const head = document.createElement("div");
  head.className = "timeline-track-head";
  head.style.setProperty("--track-color", "#ffd47a");
  head.innerHTML = `<button class="track-collapse" aria-label="Collapse ${escapeHtml(track.name)}">-</button><span class="track-color-dot"></span><strong>${escapeHtml(track.name)}</strong><span class="track-id">C${document.querySelectorAll(".captions-lane").length + 1}</span><div class="track-actions"><button class="track-mini active" data-toast="${escapeHtml(track.name)} visibility toggled" aria-pressed="true" title="Toggle visibility"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button><button class="track-mini" data-toast="${escapeHtml(track.name)} lock toggled" aria-pressed="false" title="Toggle lock"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button><button class="track-mini" data-toast="${escapeHtml(track.name)} solo toggled" aria-pressed="false" title="Solo track"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-5.07l-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14l2.83 2.83m4.48 4.48l2.83 2.83"/></svg></button></div>`;
  const lane = document.createElement("div");
  lane.className = "track-lane captions-lane";
  lane.dataset.trackLane = "";
  lane.dataset.trackId = track.id;
  head.querySelector(".track-collapse").addEventListener("click", () => {
    head.classList.toggle("collapsed");
    head.querySelector(".track-collapse").textContent = head.classList.contains("collapsed") ? "+" : "-";
  });
  head.querySelectorAll(".track-mini").forEach((button) => {
    button.addEventListener("click", () => {
      const toastText = (button.dataset.toast || "").toLowerCase();
      const isVisibility = toastText.includes("visibility");
      const isLock = toastText.includes("lock");
      const isSolo = toastText.includes("solo");
      if (isVisibility) {
        head.classList.toggle("hidden-track");
        lane.classList.toggle("hidden-track-lane", head.classList.contains("hidden-track"));
        editor.setTrackState(track.id, { visible: !head.classList.contains("hidden-track") });
      }
      if (isLock) {
        button.classList.toggle("locked");
        head.classList.toggle("locked-track", button.classList.contains("locked"));
        lane.classList.toggle("locked-track-lane", button.classList.contains("locked"));
        editor.setTrackState(track.id, { locked: button.classList.contains("locked") });
      }
      if (isSolo) {
        editor.soloTrack(track.id);
        head.querySelectorAll(".track-mini").forEach((btn) => {
          const btnToast = (btn.dataset.toast || "").toLowerCase();
          if (btnToast.includes("solo")) btn.classList.toggle("active", editor.state.tracks.find((t) => t.id === track.id)?.solo);
        });
        renderTimelineFromState();
      }
      if (!isSolo) button.classList.toggle("active");
    });
  });
  const name = head.querySelector("strong");
  name.title = "Double-click to rename track";
  name.addEventListener("dblclick", () => {
    name.contentEditable = "true";
    name.focus();
    document.getSelection()?.selectAllChildren(name);
  });
  name.addEventListener("blur", () => {
    name.contentEditable = "false";
    const nextName = name.textContent.trim() || track.name;
    name.textContent = nextName;
    editor.setTrackState(track.id, { name: nextName });
  });
  if (firstAudioHead) editorEl.insertBefore(lane, firstAudioHead), editorEl.insertBefore(head, lane);
  else editorEl.append(head, lane);
}

function bindTimelineClip(clip) {
  let mode = "move";
  let startX = 0;
  let start = Number(clip.style.getPropertyValue("--start")) || 0;
  let length = Number(clip.style.getPropertyValue("--length")) || 10;
  let targetTrackId = clip.closest("[data-track-lane]")?.dataset.trackId ?? null;
  let liveStart = start;
  let liveLength = length;
  let raf = null;
  let isRipple = false;
  let multiDragOffsets = [];
  const tooltip = document.querySelector("[data-clip-edit-tooltip]");
  const tooltipAction = document.querySelector("[data-clip-edit-tooltip-action]");
  const tooltipTime = document.querySelector("[data-clip-edit-tooltip-time]");
  const tooltipDelta = document.querySelector("[data-clip-edit-tooltip-delta]");

  function showEditTooltip(action, time, delta) {
    if (!tooltip) return;
    tooltip.hidden = false;
    tooltipAction.textContent = action;
    tooltipTime.textContent = formatTimecode(Math.max(0, time));
    if (delta !== undefined && delta !== 0) {
      tooltipDelta.textContent = delta > 0 ? `+${formatTimecode(delta)}` : `-${formatTimecode(Math.abs(delta))}`;
      tooltipDelta.className = `clip-edit-tooltip-delta${delta < 0 ? " negative" : ""}`;
      tooltipDelta.hidden = false;
    } else {
      tooltipDelta.hidden = true;
    }
  }

  function hideEditTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  function positionEditTooltip(clientX, clientY) {
    if (!tooltip) return;
    tooltip.style.left = `${clientX}px`;
    tooltip.style.top = `${clientY}px`;
  }

  const paint = () => {
    clip.style.setProperty("--start", liveStart.toFixed(2));
    clip.style.setProperty("--length", liveLength.toFixed(2));
    const snapTarget = mode === "trim-right" ? liveStart + liveLength : liveStart;
    setSnapGuide(snapTarget);
    raf = null;
  };

  const schedulePaint = () => {
    if (!raf) raf = requestAnimationFrame(paint);
  };

  function magneticSnap(time, clipId) {
    const SNAP_THRESHOLD = 0.15;
    let best = time;
    let bestDist = SNAP_THRESHOLD;
    const playheadTime = playback.currentTime ?? 0;
    const candidates = [0, playheadTime];
    editor.state.clips.forEach((c) => {
      if (c.id === clipId) return;
      const s = c.timelineStart ?? c.start;
      candidates.push(s, s + c.duration);
    });
    if (window.__getMarkerSnapPoints) {
      window.__getMarkerSnapPoints().forEach((p) => candidates.push(p));
    }
    const rulerStep = editor.state.zoom >= 1.8 ? 2 : editor.state.zoom >= 1.4 ? 5 : editor.state.zoom >= 0.85 ? 10 : 20;
    for (let t = 0; t <= editor.state.duration; t += rulerStep) {
      candidates.push(t);
    }
    for (const candidate of candidates) {
      const dist = Math.abs(time - candidate);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    return best;
  }

  function getSelectedClipData() {
    const selectedIds = editor.state.selectedClipIds;
    if (selectedIds.length <= 1) return [];
    return editor.state.clips
      .filter((c) => selectedIds.includes(c.id) && c.id !== clip.dataset.clipId)
      .map((c) => ({
        id: c.id,
        origStart: c.timelineStart ?? c.start,
        origTrackId: c.trackId,
        origDuration: c.duration,
        element: clipElementCache.get(c.id),
      }));
  }

  function previewMultiDragCSS(delta) {
    multiDragOffsets.forEach((entry) => {
      if (!entry.element) return;
      const newStart = Math.max(0, entry.origStart + delta);
      entry.element.style.setProperty("--start", newStart.toFixed(2));
    });
  }

  function revertMultiDragCSS() {
    multiDragOffsets.forEach((entry) => {
      if (!entry.element) return;
      entry.element.style.setProperty("--start", entry.origStart.toFixed(2));
    });
  }

  clip.addEventListener("click", (event) => {
    editor.selectClip(clip.dataset.clipId, { additive: event.ctrlKey || event.metaKey, range: event.shiftKey });
    syncEditorToDom();
    const clipName = clip.querySelector(".clip-name")?.textContent || clip.textContent;
    const selCount = editor.state.selectedClipIds.length;
    showToast(selCount > 1 ? `${selCount} clips selected` : `${clipName.trim()} selected`);
  });

  clip.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (isClipTrackLocked(clip)) {
      showToast("Track is locked");
      return;
    }
    const trim = event.target.closest(".trim-handle");
    mode = trim?.classList.contains("left") ? "trim-left" : trim?.classList.contains("right") ? "trim-right" : "move";
    isRipple = event.altKey;
    startX = event.clientX;
    start = Number(clip.style.getPropertyValue("--start")) || 0;
    length = Number(clip.style.getPropertyValue("--length")) || 10;
    targetTrackId = clip.closest("[data-track-lane]")?.dataset.trackId ?? null;
    liveStart = start;
    liveLength = length;
    editor.selectClip(clip.dataset.clipId, { additive: event.ctrlKey || event.metaKey, range: event.shiftKey });
    clip.classList.add(mode === "move" ? "dragging" : "trimming");
    if (mode === "move" && editor.state.selectedClipIds.length > 1) {
      multiDragOffsets = getSelectedClipData();
      clip.classList.add("multi-drag-primary");
    } else {
      multiDragOffsets = [];
    }
    clip.setPointerCapture(event.pointerId);
    document.body.classList.add("is-dragging");
    if (isRipple) {
      document.querySelectorAll(".track-lane").forEach((lane) => {
        if (lane.dataset.trackId === targetTrackId) lane.classList.add("ripple-active");
      });
    }
  });

  clip.addEventListener("pointermove", (event) => {
    if (!clip.hasPointerCapture(event.pointerId)) return;
    const delta = (event.clientX - startX) / clipUnit(clip);
    if (mode === "move") {
      const lane = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-track-lane]");
      if (lane) {
        const track = trackForLane(lane);
        const selected = editor.state.clips.find((item) => item.id === clip.dataset.clipId);
        if (track && selected && editor.isClipCompatibleWithTrack(selected, track) && !track.locked) {
          targetTrackId = lane.dataset.trackId;
          lane.classList.add("drop-ready");
        }
      }
      const rawStart = Math.max(0, start + delta);
      liveStart = magneticSnap(rawStart, clip.dataset.clipId);
      const drift = liveStart - start;
      if (multiDragOffsets.length) {
        previewMultiDragCSS(drift);
      }
      positionEditTooltip(event.clientX, event.clientY);
      const clipData = editor.state.clips.find((c) => c.id === clip.dataset.clipId);
      const movedDuration = clipData ? clipData.duration : length;
      showEditTooltip("Move", liveStart, drift);
      showAlignmentGuides(liveStart, liveStart + length, targetTrackId);
    }
    if (mode === "trim-left") {
      const nextStart = Math.max(0, Math.min(start + length - 0.5, start + delta));
      liveStart = magneticSnap(nextStart, clip.dataset.clipId);
      liveLength = Math.max(0.5, start + length - liveStart);
      positionEditTooltip(event.clientX, event.clientY);
      showEditTooltip(isRipple ? "Ripple Trim" : "Trim", liveStart, liveStart - start);
    }
    if (mode === "trim-right") {
      const rawEnd = Math.max(start + 0.5, start + length + delta);
      const snappedEnd = magneticSnap(rawEnd, clip.dataset.clipId);
      liveLength = Math.max(0.5, snappedEnd - start);
      positionEditTooltip(event.clientX, event.clientY);
      showEditTooltip(isRipple ? "Ripple Trim" : "Trim", liveStart + liveLength, liveLength - length);
    }
    withTimelineDraft(clip.dataset.clipId, { timelineStart: liveStart, start: liveStart, duration: liveLength, trackId: targetTrackId }, () => {
      syncPlaybackDom();
      applyAnimatedPreviewFrame();
    });
    schedulePaint();
  });

  clip.addEventListener("pointerup", (event) => {
    if (raf) {
      cancelAnimationFrame(raf);
      paint();
    }
    hideEditTooltip();
    document.body.classList.remove("is-dragging");
    document.querySelectorAll(".track-lane.ripple-active").forEach((lane) => lane.classList.remove("ripple-active"));
    const rippleOpt = isRipple ? { ripple: true } : {};
    if (mode === "move") {
      if (multiDragOffsets.length) {
        const drift = liveStart - start;
        multiDragOffsets.forEach((entry) => {
          editor.moveClip(entry.id, entry.origStart + drift, { trackId: targetTrackId, ...rippleOpt });
        });
      }
      editor.moveClip(clip.dataset.clipId, liveStart, { trackId: targetTrackId, ...rippleOpt });
    }
    if (mode === "trim-left") editor.trimClipStart(clip.dataset.clipId, liveStart, rippleOpt);
    if (mode === "trim-right") editor.trimClipEnd(clip.dataset.clipId, liveLength, rippleOpt);
    clip.classList.remove("dragging", "trimming", "multi-drag-primary");
    document.querySelectorAll(".track-lane.drop-ready").forEach((lane) => lane.classList.remove("drop-ready"));
    setSnapGuide(0, false);
    hideAlignmentGuides();
    if (clip.hasPointerCapture(event.pointerId)) clip.releasePointerCapture(event.pointerId);
    renderTimelineFromState();
    const actionLabel = mode === "move" ? "Moved" : isRipple ? "Ripple trimmed" : "Trimmed";
    showToast(`${actionLabel} clip`);
  });

  clip.addEventListener("pointercancel", (event) => {
    liveStart = start;
    liveLength = length;
    clip.style.setProperty("--start", start.toFixed(2));
    clip.style.setProperty("--length", length.toFixed(2));
    clip.classList.remove("dragging", "trimming", "multi-drag-primary");
    document.querySelectorAll(".track-lane.drop-ready").forEach((lane) => lane.classList.remove("drop-ready"));
    document.querySelectorAll(".track-lane.ripple-active").forEach((lane) => lane.classList.remove("ripple-active"));
    document.body.classList.remove("is-dragging");
    setSnapGuide(0, false);
    hideAlignmentGuides();
    hideEditTooltip();
    revertMultiDragCSS();
    if (clip.hasPointerCapture(event.pointerId)) clip.releasePointerCapture(event.pointerId);
  });
}

document.querySelectorAll(".edit-clip, .caption-block").forEach(bindTimelineClip);

document.querySelectorAll("[data-clip-prop]").forEach((control) => {
  const handler = () => {
    const selected = editor.selectedClips;
    if (!selected.length) return showToast("Select a clip first");
    const prop = control.dataset.clipProp;
    const value = control.value;
    const numberValue = Number(value);
    if (prop === "speed") {
      editor.setSpeed(numberValue / 100);
      updateClipValue(prop, `${(numberValue / 100).toFixed(2)}x`);
    }
    if (prop === "opacity") {
      editor.setOpacity(numberValue / 100);
      updateClipValue(prop, `${numberValue}%`);
    }
    if (prop === "rotate") {
      editor.transformSelected({ rotate: numberValue });
      updateClipValue(prop, `${numberValue} deg`);
    }
    if (prop === "scale") {
      editor.transformSelected({ scale: numberValue / 100 });
      updateClipValue(prop, `${numberValue}%`);
    }
    if (prop === "positionX") {
      editor.transformSelected({ x: numberValue });
      updateClipValue(prop, String(numberValue));
    }
    if (prop === "positionY") {
      editor.transformSelected({ y: numberValue });
      updateClipValue(prop, String(numberValue));
    }
    if (prop === "anchorX") {
      editor.setMotionControls({ anchorX: numberValue / 100 });
      updateClipValue(prop, `${numberValue}%`);
    }
    if (prop === "anchorY") {
      editor.setMotionControls({ anchorY: numberValue / 100 });
      updateClipValue(prop, `${numberValue}%`);
    }
    if (prop === "motionBlur") {
      editor.setMotionControls({ motionBlur: numberValue });
      updateClipValue(prop, `${numberValue}%`);
    }
    if (prop === "easingPreset") {
      editor.setMotionControls({ easingPreset: value });
      updateClipValue(prop, value);
    }
    if (prop === "volume") {
      editor.setAudio({ volume: numberValue / 100 });
      updateClipValue(prop, `${numberValue}%`);
    }
    if (prop === "fadeIn") {
      editor.setAudio({ fadeIn: numberValue / 100 });
      updateClipValue(prop, `${(numberValue / 100).toFixed(1)}s`);
    }
    if (prop === "fadeOut") {
      editor.setAudio({ fadeOut: numberValue / 100 });
      updateClipValue(prop, `${(numberValue / 100).toFixed(1)}s`);
    }
    if (prop === "crop") {
      editor.transformSelected({ crop: { x: numberValue / 200, y: numberValue / 200, width: 1 - numberValue / 100, height: 1 - numberValue / 100 } });
      updateClipValue(prop, `${numberValue}%`);
    }
    if (prop === "blur") {
      editor.setEffect("blur", { radius: numberValue });
      updateClipValue(prop, `${numberValue}px`);
    }
    if (prop === "shadow") {
      editor.setEffect("shadow", { opacity: numberValue });
      updateClipValue(prop, `${numberValue}%`);
    }
    if (prop === "border") {
      editor.selectedClips.forEach((clip) => editor.setClipProperties(clip.id, { border: numberValue }));
      updateClipValue(prop, `${numberValue}px`);
    }
    if (prop === "color") {
      editor.selectedClips.forEach((clip) => editor.setClipProperties(clip.id, { colorTemperature: numberValue }));
      updateClipValue(prop, numberValue > 58 ? "Warm" : numberValue < 42 ? "Cool" : "Neutral");
    }
    if (prop === "blendMode") editor.setBlendMode(value);
    applyClipPreviewStyles(prop, prop === "blendMode" || prop === "easingPreset" ? value : numberValue);
    showToast(`${prop} updated`);
  };
  control.addEventListener(control.tagName === "SELECT" ? "change" : "input", handler);
});

document.querySelectorAll("[data-prop-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!editor.selectedClips.length) return showToast("Select a clip first");
    const action = button.dataset.propAction;
    if (action === "flipX") editor.transformSelected({ flipX: true });
    if (action === "flipY") editor.transformSelected({ flipY: true });
    if (action === "reverse") {
      editor.reverseSelected();
      videoFrame.classList.toggle("preview-reversed");
      previewStatus.textContent = videoFrame.classList.contains("preview-reversed") ? "Reverse preview" : "GPU smooth";
    }
    if (action === "crop") editor.transformSelected({ crop: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 } });
    if (action === "keyframe") {
      editor.addKeyframe("position", { x: 12, y: -8 });
      editor.addKeyframe("scale", editor.selectedClips[0].transform.scale);
      editor.addKeyframe("rotation", editor.selectedClips[0].transform.rotate);
      editor.addKeyframe("opacity", editor.selectedClips[0].opacity);
    }
    if (action === "videoTransition") editor.addTransition("video", Number(document.querySelector("[data-transition-duration]").value) / 100, document.querySelector("[data-transition-name]").value, "out");
    if (action === "audioFade") editor.setAudio({ volume: 0.85, fadeIn: 0.5, fadeOut: 0.5 });
    showToast(`${button.textContent} applied`);
  });
});

function renderKeyframePanel() {
  const list = document.querySelector("[data-keyframe-list]");
  const count = document.querySelector("[data-keyframe-count]");
  if (!list || !count) return;
  const clip = editor.selectedClips[0];
  const keyframes = [...(clip?.keyframes ?? [])].sort((a, b) => a.time - b.time);
  count.textContent = `${keyframes.length}`;
  list.innerHTML = "";
  if (!clip) {
    list.innerHTML = '<div class="keyframe-row">Select a clip to edit keyframes</div>';
    return;
  }
  keyframes.forEach((keyframe) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `keyframe-row${editor.state.selectedKeyframeIds.includes(keyframe.id) ? " selected" : ""}`;
    row.innerHTML = `<span>${escapeHtml(keyframe.property)} - ${escapeHtml(keyframe.easing)}</span><b>${keyframe.time.toFixed(2)}s</b>`;
    row.addEventListener("click", (event) => {
      editor.selectKeyframe(keyframe.id, { additive: event.shiftKey || event.ctrlKey || event.metaKey });
      renderTimelineFromState();
      renderKeyframePanel();
    });
    list.appendChild(row);
  });
}

document.querySelectorAll("[data-keyframe-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!editor.selectedClips.length) return showToast("Select a clip first");
    const action = button.dataset.keyframeAction;
    const property = document.querySelector("[data-keyframe-property]").value;
    const easing = document.querySelector("[data-keyframe-easing]").value;
    if (action === "add") editor.addKeyframe(property, undefined, editor.state.time, easing);
    if (action === "delete") editor.deleteSelectedKeyframes();
    if (action === "copy") editor.copySelectedKeyframes();
    if (action === "paste") editor.pasteKeyframes(editor.state.time);
    if (action === "left") editor.moveSelectedKeyframes(-1 / editor.state.fps);
    if (action === "right") editor.moveSelectedKeyframes(1 / editor.state.fps);
    renderTimelineFromState();
    renderKeyframePanel();
    updateTimecode();
    applyAnimatedPreviewFrame();
    showToast(`Keyframe ${action}`);
  });
});

document.querySelector("[data-keyframe-easing]")?.addEventListener("change", (event) => {
  if (!editor.state.selectedKeyframeIds.length) return;
  editor.updateSelectedKeyframes({ easing: event.target.value });
  renderTimelineFromState();
  renderKeyframePanel();
  applyAnimatedPreviewFrame();
});

document.querySelector("[data-keyframe-property]")?.addEventListener("change", (event) => {
  if (!editor.state.selectedKeyframeIds.length) return;
  editor.updateSelectedKeyframes({ property: event.target.value });
  renderTimelineFromState();
  renderKeyframePanel();
  applyAnimatedPreviewFrame();
});

function selectedTransition() {
  const selectedClip = editor.selectedClips[0];
  if (!selectedClip) return null;
  return (selectedClip.transitions ?? []).find((transition) => transition.id === editor.state.selectedTransitionId) ?? selectedClip.transitions?.[0] ?? null;
}

function renderTransitionPanel() {
  const list = document.querySelector("[data-transition-list]");
  const count = document.querySelector("[data-transition-count]");
  const previewBox = document.querySelector("[data-transition-preview-box]");
  if (!list || !count) return;
  const clip = editor.selectedClips[0];
  const transitions = clip?.transitions ?? [];
  count.textContent = `${transitions.length}`;
  list.innerHTML = "";
  if (!clip || !transitions.length) {
    list.innerHTML = '<div class="transition-row">No transitions on selected clip</div>';
    if (previewBox) previewBox.innerHTML = "";
    return;
  }
  const active = selectedTransition();
  const dirBtns = document.querySelectorAll(".transition-dir-btn");
  if (active) {
    dirBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.dir === (active.direction ?? "left")));
    document.querySelector("[data-transition-easing]").value = active.easing ?? "ease-in-out";
  }
  transitions.forEach((transition) => {
    const row = document.createElement("button");
    row.type = "button";
    row.draggable = true;
    row.className = `transition-row${active?.id === transition.id ? " selected" : ""}`;
    row.dataset.transitionId = transition.id;
    row.dataset.transitionName = transition.name;
    row.innerHTML = `<span class="transition-row-name">${escapeHtml(transition.name)}</span><span class="transition-row-dir">${escapeHtml(transition.direction)}</span><span class="transition-row-easing">${escapeHtml(transition.easing)}</span><b>${transition.duration.toFixed(2)}s</b>`;
    row.addEventListener("click", () => {
      editor.state.selectedTransitionId = transition.id;
      document.querySelector("[data-transition-name]").value = transition.name;
      document.querySelector("[data-transition-duration]").value = String(Math.round(transition.duration * 100));
      document.querySelector("[data-transition-duration-value]").textContent = `${transition.duration.toFixed(2)}s`;
      document.querySelector("[data-transition-easing]").value = transition.easing ?? "ease-in-out";
      const dirButtons = document.querySelectorAll(".transition-dir-btn");
      dirButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.dir === (transition.direction ?? "left")));
      renderTimelineFromState();
      renderTransitionPanel();
    });
    list.appendChild(row);
  });
  renderTransitionPreview(active, previewBox);
}

function renderTransitionPreview(transition, container) {
  if (!container) return;
  container.innerHTML = "";
  if (!transition) return;
  const thumb = document.createElement("div");
  thumb.className = "transition-preview-animation";
  thumb.dataset.previewType = transition.name;
  thumb.dataset.previewDir = transition.direction;
  const box = document.createElement("div");
  box.className = "preview-box-a";
  const box2 = document.createElement("div");
  box2.className = "preview-box-b";
  thumb.appendChild(box);
  thumb.appendChild(box2);
  container.appendChild(thumb);
  thumb.animate([
    { transform: "translateX(0) scale(1) rotate(0deg)", filter: "blur(0px)", opacity: 1, clipPath: "inset(0)" },
    ...getPreviewKeyframes(transition),
  ], { duration: Math.min(2000, transition.duration * 1000), iterations: Infinity, easing: transition.easing });
}

function getPreviewKeyframes(transition) {
  const t = transition.name;
  const d = transition.direction ?? "left";
  if (t === "fade" || t === "cross-dissolve") return [{ opacity: 0 }, { opacity: 1 }];
  if (t === "dip-black" || t === "dip-white") return [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }];
  if (t === "slide") {
    if (d === "left") return [{ transform: "translateX(-100%)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }];
    if (d === "right") return [{ transform: "translateX(100%)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }];
    if (d === "up") return [{ transform: "translateY(-100%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }];
    return [{ transform: "translateY(100%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }];
  }
  if (t === "push") {
    if (d === "left") return [{ transform: "translateX(100%) scale(1.05)" }, { transform: "translateX(0) scale(1)" }];
    if (d === "right") return [{ transform: "translateX(-100%) scale(1.05)" }, { transform: "translateX(0) scale(1)" }];
    if (d === "up") return [{ transform: "translateY(100%) scale(1.05)" }, { transform: "translateY(0) scale(1)" }];
    return [{ transform: "translateY(-100%) scale(1.05)" }, { transform: "translateY(0) scale(1)" }];
  }
  if (t === "zoom") {
    if (d === "in") return [{ transform: "scale(0.5)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }];
    return [{ transform: "scale(1.5)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }];
  }
  if (t === "wipe") {
    if (d === "right") return [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }];
    if (d === "left") return [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0)" }];
    if (d === "down") return [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }];
    return [{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }];
  }
  if (t === "blur") return [{ filter: "blur(20px)", opacity: 0 }, { filter: "blur(0px)", opacity: 1 }];
  if (t === "spin") {
    if (d === "counter-clockwise") return [{ transform: "rotate(-180deg) scale(0.8)", opacity: 0 }, { transform: "rotate(0deg) scale(1)", opacity: 1 }];
    return [{ transform: "rotate(180deg) scale(0.8)", opacity: 0 }, { transform: "rotate(0deg) scale(1)", opacity: 1 }];
  }
  return [{ opacity: 0 }, { opacity: 1 }];
}

let _transitionDurationRaf = null;
document.querySelector("[data-transition-duration]")?.addEventListener("input", (event) => {
  const duration = Number(event.target.value) / 100;
  document.querySelector("[data-transition-duration-value]").textContent = `${duration.toFixed(2)}s`;
  const transition = selectedTransition();
  if (transition) {
    editor.updateTransition(transition.id, { duration });
    if (_transitionDurationRaf) return;
    _transitionDurationRaf = requestAnimationFrame(() => { _transitionDurationRaf = null; renderTimelineFromState(); updateTimecode(); });
  }
});

document.querySelectorAll("[data-transition-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!editor.selectedClips.length) return showToast("Select a clip first");
    const action = button.dataset.transitionAction;
    const transition = selectedTransition();
    const activeDir = document.querySelector(".transition-dir-btn.active")?.dataset?.dir ?? "left";
    if (action === "add") {
      editor.addTransition("video", Number(document.querySelector("[data-transition-duration]").value) / 100, document.querySelector("[data-transition-name]").value, activeDir, document.querySelector("[data-transition-easing]")?.value ?? "ease-in-out");
    }
    if (action === "remove" && transition) editor.removeTransition(transition.id);
    if (action === "duplicate" && transition) editor.duplicateTransition(transition.id);
    renderTimelineFromState();
    renderTransitionPanel();
    updateTimecode();
    showToast(`Transition ${action}`);
  });
});

document.querySelectorAll(".transition-dir-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".transition-dir-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const transition = selectedTransition();
    if (transition) {
      editor.updateTransition(transition.id, { direction: btn.dataset.dir });
      renderTimelineFromState();
      renderTransitionPanel();
    }
  });
});

document.querySelector("[data-transition-easing]")?.addEventListener("change", (event) => {
  const transition = selectedTransition();
  if (transition) {
    editor.updateTransition(transition.id, { easing: event.target.value });
    renderTimelineFromState();
    renderTransitionPanel();
  }
});

document.querySelector("[data-transition-name]")?.addEventListener("change", (event) => {
  const transition = selectedTransition();
  if (transition) {
    editor.updateTransition(transition.id, { name: event.target.value });
    renderTimelineFromState();
    renderTransitionPanel();
  }
});

document.querySelectorAll("[data-transition-preset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!editor.selectedClips.length) return showToast("Select a clip first");
    editor.addTransitionPreset(btn.dataset.transitionPreset);
    renderTimelineFromState();
    renderTransitionPanel();
    updateTimecode();
    showToast(`Preset applied: ${btn.textContent}`);
  });
});

function selectedEffect() {
  const clip = editor.selectedClips[0];
  if (!clip) return null;
  return (clip.effects ?? []).find((effect) => effect.id === editor.state.selectedEffectId) ?? clip.effects?.[0] ?? null;
}

function primaryEffectParameter(effect) {
  if (!effect) return "amount";
  if (effect.type === "blur") return "radius";
  if (effect.type === "shadow") return "opacity";
  if (effect.type === "glow" || effect.type === "bloom" || effect.type === "lut") return "intensity";
  if (effect.type === "sharpen" || effect.type === "vignette" || effect.type === "noise" || effect.type === "film-grain" || effect.type === "rgb-split" || effect.type === "chromatic-aberration") return "amount";
  return "amount";
}

function effectParameterRange(effect, parameter) {
  const ranges = {
    blur: { radius: [0, 80] },
    sharpen: { amount: [0, 100] },
    glow: { intensity: [0, 100], radius: [0, 80] },
    shadow: { opacity: [0, 100], distance: [0, 120], blur: [0, 120] },
    vignette: { amount: [0, 100], softness: [0, 100] },
    noise: { amount: [0, 100] },
    "film-grain": { amount: [0, 100], size: [1, 100] },
    bloom: { intensity: [0, 100], threshold: [0, 100] },
    lut: { intensity: [0, 100] },
    "rgb-split": { amount: [0, 50] },
    "chromatic-aberration": { amount: [0, 50] },
  };
  return ranges[effect?.type]?.[parameter] ?? [0, 100];
}

function syncEffectControls(effect) {
  const param = document.querySelector("[data-effect-param]");
  const value = document.querySelector("[data-effect-param-value]");
  const lutControl = document.querySelector("[data-effect-lut-control]");
  const lut = document.querySelector("[data-effect-lut]");
  if (!effect || !param || !value) return;
  const parameter = primaryEffectParameter(effect);
  const [min, max] = effectParameterRange(effect, parameter);
  param.dataset.effectParam = parameter;
  param.min = String(min);
  param.max = String(max);
  param.value = String(Number(effect.parameters?.[parameter] ?? 0));
  value.textContent = String(effect.parameters?.[parameter] ?? 0);
  if (lutControl && lut) {
    lutControl.hidden = effect.type !== "lut";
    lut.value = effect.parameters?.lut ?? "Cinematic Cool";
  }
}

function renderEffectsPanel() {
  const list = document.querySelector("[data-effects-list]");
  const count = document.querySelector("[data-effects-count]");
  if (!list || !count) return;
  const clip = editor.selectedClips[0];
  const effects = [...(clip?.effects ?? [])].sort((a, b) => a.order - b.order);
  count.textContent = `${effects.length}`;
  list.innerHTML = "";
  if (!clip || !effects.length) {
    list.innerHTML = '<div class="effect-row">No effects on selected clip</div>';
    return;
  }
  effects.forEach((effect) => {
    const row = document.createElement("button");
    row.type = "button";
    row.draggable = true;
    row.className = `effect-row${editor.state.selectedEffectId === effect.id ? " selected" : ""}`;
    row.dataset.effectType = effect.type;
    row.innerHTML = `<span>${escapeHtml(effect.type)} · ${effect.enabled ? "Enabled" : "Disabled"}</span><b>${effect.order + 1}</b>`;
    row.addEventListener("click", () => {
      editor.state.selectedEffectId = effect.id;
      document.querySelector("[data-effect-type]").value = effect.type;
      syncEffectControls(effect);
      renderEffectsPanel();
    });
    list.appendChild(row);
  });
}

let _effectParamRaf = null;
document.querySelector("[data-effect-param]")?.addEventListener("input", (event) => {
  const effect = selectedEffect();
  if (!effect) return;
  const parameter = event.target.dataset.effectParam || primaryEffectParameter(effect);
  const value = Number(event.target.value);
  document.querySelector("[data-effect-param-value]").textContent = String(value);
  editor.updateEffect(effect.id, { parameters: { [parameter]: value } });
  if (_effectParamRaf) return;
  _effectParamRaf = requestAnimationFrame(() => { _effectParamRaf = null; renderEffectsPanel(); updateTimecode(); });
});

document.querySelector("[data-effect-lut]")?.addEventListener("change", (event) => {
  const effect = selectedEffect();
  if (!effect || effect.type !== "lut") return;
  editor.updateEffect(effect.id, { parameters: { lut: event.target.value } });
  renderEffectsPanel();
  updateTimecode();
  applyAnimatedPreviewFrame();
});

document.querySelectorAll("[data-effect-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!editor.selectedClips.length) return showToast("Select a clip first");
    const action = button.dataset.effectAction;
    const effect = selectedEffect();
    if (action === "add") {
      const added = editor.addEffect(document.querySelector("[data-effect-type]").value);
      editor.state.selectedEffectId = added?.[0]?.id ?? editor.selectedClips[0]?.effects?.at(-1)?.id;
      syncEffectControls(selectedEffect());
    }
    if (action === "toggle" && effect) editor.setEffectEnabled(effect.id, !effect.enabled);
    if (action === "up" && effect) editor.reorderEffect(effect.id, -1);
    if (action === "down" && effect) editor.reorderEffect(effect.id, 1);
    if (action === "duplicate" && effect) editor.duplicateEffect(effect.id);
    if (action === "remove" && effect) editor.removeEffect(effect.id);
    if (action === "keyframe" && effect) {
      const parameter = document.querySelector("[data-effect-param]").dataset.effectParam || primaryEffectParameter(effect);
      editor.addEffectKeyframe(effect.id, parameter, Number(document.querySelector("[data-effect-param]").value), editor.state.time, "ease-out");
    }
    renderTimelineFromState();
    renderEffectsPanel();
    updateTimecode();
    showToast(`Effect ${action}`);
  });
});

function colorControlValue(control) {
  return control.dataset.colorGrade === "gamma" ? Number(control.value) / 100 : Number(control.value);
}

function setColorControl(parameter, value) {
  const control = document.querySelector(`[data-color-grade="${parameter}"]`);
  if (!control) return;
  control.value = parameter === "gamma" ? String(Math.round(value * 100)) : String(value);
  document.querySelector(`[data-color-value="${parameter}"]`).textContent = parameter === "gamma" ? Number(value).toFixed(2) : String(value);
}

function syncColorPanelFromClip() {
  const grade = editor.selectedClips[0]?.colorGrade;
  if (!grade) return;
  Object.entries(grade).forEach(([parameter, value]) => setColorControl(parameter, value));
}

function selectedTextClip() {
  return editor.selectedClips.find((clip) => clip.type === "text" || clip.type === "caption");
}

function selectedCaptionClip() {
  return editor.selectedClips.find((clip) => clip.type === "caption");
}

function selectedAudioClip() {
  return editor.selectedClips.find((clip) => clip.type === "audio" || editor.state.tracks.find((track) => track.id === clip.trackId)?.type === "audio");
}

function textStyleValue(parameter, rawValue, control) {
  if (parameter === "letterSpacing") return Number(rawValue) / 10;
  if (parameter === "lineHeight") return Number(rawValue) / 100;
  if (parameter === "color" || parameter === "strokeColor" || parameter === "backgroundColor") return rawValue;
  if (["fontWeight", "fontSize", "strokeWidth", "shadow", "glow", "backgroundOpacity", "paragraphSpacing", "posX", "posY", "scale", "rotation"].includes(parameter)) return Number(rawValue);
  if (parameter === "backgroundEnabled") return Boolean(rawValue);
  return rawValue;
}

function setTextStyleControl(parameter, value) {
  const control = document.querySelector(`[data-text-style="${parameter}"]`);
  if (!control) return;
  const displayValue = parameter === "letterSpacing" ? Number(value) * 10 : parameter === "lineHeight" ? Math.round(Number(value) * 100) : value;
  control.value = String(displayValue);
  const label = document.querySelector(`[data-text-value="${parameter}"]`);
  if (label) {
    if (parameter === "fontSize") label.textContent = `${Math.round(value)}px`;
    if (parameter === "letterSpacing") label.textContent = `${Number(value).toFixed(1)}px`;
    if (parameter === "lineHeight") label.textContent = `${Number(value).toFixed(1)}`;
    if (parameter === "paragraphSpacing") label.textContent = `${Math.round(value)}px`;
    if (parameter === "strokeWidth") label.textContent = `${Math.round(value)}px`;
    if (parameter === "posX") label.textContent = `${Math.round(value)}%`;
    if (parameter === "posY") label.textContent = `${Math.round(value)}%`;
    if (parameter === "scale") label.textContent = `${Math.round(value)}%`;
    if (parameter === "rotation") label.textContent = `${Math.round(value)}°`;
    if (["shadow", "glow", "backgroundOpacity"].includes(parameter)) label.textContent = `${Math.round(value)}%`;
  }
}

function syncTextPanelFromClip() {
  const clip = selectedTextClip();
  const panel = document.querySelector("[data-text-editor]");
  if (!panel) return;
  panel.classList.toggle("is-empty", !clip);
  if (!clip?.textLayer) return;
  document.querySelector("[data-text-content]").value = clip.textLayer.text ?? clip.name;
  document.querySelector("[data-text-kind]").value = clip.textLayer.kind ?? "title";
  document.querySelector("[data-text-animation]").value = clip.textLayer.animation ?? "none";
  document.querySelector("[data-text-template]").value = clip.textLayer.templateId ?? "editorial";
  Object.entries(clip.textLayer.style ?? {}).forEach(([parameter, value]) => setTextStyleControl(parameter, value));
  document.querySelectorAll("[data-text-align]").forEach((button) => {
    button.classList.toggle("active", button.dataset.textAlign === clip.textLayer.style?.align);
  });
  const count = clip.textLayer.keyframes?.length ?? 0;
  document.querySelector("[data-text-keyframe-count]").textContent = `${count} keyframe${count === 1 ? "" : "s"}`;
  const textCount = editor.state.clips.filter((c) => c.type === "text").length;
  document.querySelector("[data-text-clip-count]").textContent = `${textCount} text layer${textCount === 1 ? "" : "s"}`;
}

function syncCaptionTrackOptions() {
  const select = document.querySelector("[data-caption-track]");
  if (!select) return;
  const captionTracks = editor.state.tracks.filter((track) => track.name.toLowerCase().includes("caption") || editor.state.clips.some((clip) => clip.type === "caption" && clip.trackId === track.id));
  select.innerHTML = captionTracks.map((track) => `<option value="${track.id}">${escapeHtml(track.name)}</option>`).join("");
}

function syncCaptionPanelFromClip() {
  const clip = selectedCaptionClip();
  const panel = document.querySelector("[data-caption-editor]");
  if (!panel) return;
  syncCaptionTrackOptions();
  const captions = editor.state.clips.filter((item) => item.type === "caption");
  document.querySelector("[data-caption-status]").textContent = `${captions.length} caption${captions.length === 1 ? "" : "s"}`;
  panel.classList.toggle("is-empty", !clip);
  if (!clip?.captionLayer) return;
  const layer = clip.captionLayer;
  document.querySelector("[data-caption-mode]").value = layer.mode;
  document.querySelector("[data-caption-animation]").value = layer.animation;
  document.querySelector("[data-caption-template]").value = layer.templateId;
  document.querySelector("[data-caption-speaker]").value = layer.speaker;
  document.querySelector("[data-caption-track]").value = clip.trackId;
  document.querySelector("[data-caption-timing=\"start\"]").value = String(clip.timelineStart ?? clip.start);
  document.querySelector("[data-caption-timing=\"duration\"]").value = String(clip.duration);
  document.querySelector("[data-caption-value=\"start\"]").textContent = `${(clip.timelineStart ?? clip.start).toFixed(2)}s`;
  document.querySelector("[data-caption-value=\"duration\"]").textContent = `${clip.duration.toFixed(2)}s`;
  document.querySelector("[data-caption-action=\"safe-zone\"]").classList.toggle("active", layer.safeZone);
  renderCaptionWords(layer);
}

function renderCaptionWords(layer) {
  const list = document.querySelector("[data-caption-words]");
  if (!list) return;
  list.innerHTML = "";
  (layer.words ?? []).forEach((word) => {
    const row = document.createElement("div");
    row.className = "caption-word-row";
    row.innerHTML = `
      <input data-caption-word-text="${word.id}" value="${word.text}" aria-label="Caption word" />
      <input data-caption-word-start="${word.id}" type="number" step="0.03" min="0" value="${word.start.toFixed(2)}" aria-label="Word start" />
      <input data-caption-word-end="${word.id}" type="number" step="0.03" min="0" value="${word.end.toFixed(2)}" aria-label="Word end" />
    `;
    list.appendChild(row);
  });
}

function audioControlValue(parameter, rawValue) {
  const value = Number(rawValue);
  if (parameter === "volume") return value / 100;
  if (parameter === "pan") return value / 100;
  if (parameter === "fadeIn" || parameter === "fadeOut") return value / 100;
  return value;
}

function setAudioControl(parameter, value) {
  const control = document.querySelector(`[data-audio-param="${parameter}"]`);
  if (control) {
    const display = ["volume", "pan", "fadeIn", "fadeOut"].includes(parameter) ? value * 100 : value;
    control.value = String(Math.round(display));
  }
  const label = document.querySelector(`[data-audio-value="${parameter}"]`);
  if (!label) return;
  if (parameter === "volume") label.textContent = `${Math.round(value * 100)}%`;
  if (parameter === "pan") label.textContent = value === 0 ? "C" : `${value < 0 ? "L" : "R"}${Math.abs(Math.round(value * 100))}`;
  if (parameter === "fadeIn" || parameter === "fadeOut") label.textContent = `${value.toFixed(1)}s`;
  if (parameter === "noiseReduction" || parameter === "voiceEnhance") label.textContent = `${Math.round(value)}%`;
}

function setAudioEqControl(band, value) {
  const control = document.querySelector(`[data-audio-eq="${band}"]`);
  if (control) control.value = String(Math.round(value));
  const label = document.querySelector(`[data-audio-value="eq.${band}"]`);
  if (label) label.textContent = `${value > 0 ? "+" : ""}${Math.round(value)} dB`;
}

function renderAudioWaveform(audio) {
  const preview = document.querySelector("[data-audio-waveform-preview]");
  if (!preview) return;
  const samples = audio?.waveform?.length ? audio.waveform : Array.from({ length: 48 }, (_, index) => 0.2 + Math.abs(Math.sin(index * 0.31)) * 0.7);
  preview.innerHTML = samples.slice(0, 64).map((sample) => `<span style="--h:${Math.max(8, Math.round(sample * 100))}%"></span>`).join("");
}

function syncAudioPanelFromClip() {
  const clip = selectedAudioClip();
  const panel = document.querySelector("[data-audio-editor]");
  if (!panel) return;
  panel.classList.toggle("is-empty", !clip);
  if (!clip?.audio) return;
  const audio = clip.audio;
  ["volume", "pan", "fadeIn", "fadeOut", "noiseReduction", "voiceEnhance"].forEach((parameter) => setAudioControl(parameter, audio[parameter] ?? 0));
  ["low", "mid", "high"].forEach((band) => setAudioEqControl(band, audio.eq?.[band] ?? 0));
  document.querySelector("[data-audio-toggle=\"compressor\"]").classList.toggle("active", Boolean(audio.compressor?.enabled));
  document.querySelector("[data-audio-toggle=\"limiter\"]").classList.toggle("active", Boolean(audio.limiter?.enabled));
  document.querySelector("[data-audio-action=\"mute\"]").classList.toggle("active", Boolean(audio.muted));
  document.querySelector("[data-audio-action=\"solo\"]").classList.toggle("active", Boolean(audio.solo));
  document.querySelector("[data-audio-status]").textContent = `${audio.keyframes?.length ?? 0} keyframes`;
  renderAudioWaveform(audio);
}

function applyAudioPreview(mix) {
  if (!mix) return;
  const level = Math.round(Math.min(100, mix.masterGain * 58 + mix.peak * 32));
  document.querySelector("[data-audio-meter]")?.style.setProperty("--level", `${level}%`);
  const db = mix.peak > 0 ? (20 * Math.log10(Math.min(1, mix.peak))).toFixed(1) : "-inf";
  const peak = document.querySelector("[data-audio-peak]");
  if (peak) peak.textContent = mix.clipping ? "CLIP" : `${db} dB`;
}

document.querySelectorAll("[data-color-grade]").forEach((control) => {
  control.addEventListener("input", () => {
    if (!editor.selectedClips.length) return showToast("Select a clip first");
    const parameter = control.dataset.colorGrade;
    const value = colorControlValue(control);
    document.querySelector(`[data-color-value="${parameter}"]`).textContent = parameter === "gamma" ? value.toFixed(2) : String(value);
    editor.setColorGrade(parameter, value);
    updateTimecode();
  });
});

document.querySelector("[data-color-preset]")?.addEventListener("change", (event) => {
  if (!editor.selectedClips.length) return showToast("Select a clip first");
  editor.applyColorPreset(event.target.value);
  syncColorPanelFromClip();
  updateTimecode();
  showToast(`${event.target.options[event.target.selectedIndex].text} preset applied`);
});

document.querySelectorAll("[data-color-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!editor.selectedClips.length) return showToast("Select a clip first");
    const action = button.dataset.colorAction;
    if (action === "reset") editor.resetColorGrade();
    if (action === "copy") editor.copyColorGrade();
    if (action === "paste") editor.pasteColorGrade();
    if (action === "keyframe") {
      document.querySelectorAll("[data-color-grade]").forEach((control) => {
        editor.addColorGradeKeyframe(control.dataset.colorGrade, colorControlValue(control), editor.state.time, "ease-out");
      });
    }
    syncColorPanelFromClip();
    updateTimecode();
    showToast(`Color grade ${action}`);
  });
});

document.querySelector("[data-text-content]")?.addEventListener("input", (event) => {
  if (!selectedTextClip()) return showToast("Select a text or caption clip first");
  editor.setTextLayer({ text: event.target.value });
  applyAnimatedPreviewFrame();
  updateTimecode();
});

document.querySelector("[data-text-kind]")?.addEventListener("change", (event) => {
  if (!selectedTextClip()) return showToast("Select a text or caption clip first");
  editor.setTextKind(event.target.value);
  syncTextPanelFromClip();
  updateTimecode();
});

document.querySelector("[data-text-animation]")?.addEventListener("change", (event) => {
  if (!selectedTextClip()) return showToast("Select a text or caption clip first");
  editor.setTextAnimation(event.target.value);
  syncTextPanelFromClip();
  updateTimecode();
});

document.querySelectorAll("[data-text-style]").forEach((control) => {
  const eventName = control.tagName === "SELECT" ? "change" : "input";
  control.addEventListener(eventName, () => {
    if (!selectedTextClip()) return showToast("Select a text or caption clip first");
    const parameter = control.dataset.textStyle;
    const value = textStyleValue(parameter, control.value, control);
    editor.setTextStyle(parameter, value);
    setTextStyleControl(parameter, value);
    applyAnimatedPreviewFrame();
    updateTimecode();
  });
});

document.querySelectorAll("[data-text-align]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!selectedTextClip()) return showToast("Select a text or caption clip first");
    editor.setTextStyle("align", button.dataset.textAlign);
    syncTextPanelFromClip();
    applyAnimatedPreviewFrame();
    updateTimecode();
  });
});

document.querySelectorAll("[data-text-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const clip = selectedTextClip();
    if (!clip) return showToast("Select a text or caption clip first");
    const action = button.dataset.textAction;
    if (action === "template") editor.applyTextTemplate(document.querySelector("[data-text-template]").value);
    if (action === "background") {
      const enabled = !clip.textLayer?.style?.backgroundEnabled;
      editor.setTextLayer({ style: { backgroundEnabled: enabled, backgroundOpacity: enabled ? Math.max(34, clip.textLayer?.style?.backgroundOpacity ?? 0) : 0 } });
    }
    if (action === "keyframe") {
      const layer = selectedTextClip().textLayer;
      ["fontSize", "letterSpacing", "strokeWidth", "shadow", "glow", "backgroundOpacity"].forEach((parameter) => {
        editor.addTextKeyframe(parameter, layer.style[parameter], editor.state.time, "ease-out");
      });
    }
    syncTextPanelFromClip();
    applyAnimatedPreviewFrame();
    updateTimecode();
    showToast(`Text ${action} applied`);
  });
});

document.querySelector("[data-text-add]")?.addEventListener("click", () => {
  const text = document.querySelector("[data-text-content]")?.value || "New Text";
  const animation = document.querySelector("[data-text-animation]")?.value || "fade";
  editor.addTextLayer({ text, animation });
  renderTimelineFromState();
  syncTextPanelFromClip();
  applyAnimatedPreviewFrame();
  updateTimecode();
  showToast("Text layer added");
});

document.querySelector("[data-text-delete]")?.addEventListener("click", () => {
  const clip = selectedTextClip();
  if (!clip) return showToast("Select a text layer first");
  editor.deleteClip(clip.id);
  renderTimelineFromState();
  syncTextPanelFromClip();
  applyAnimatedPreviewFrame();
  updateTimecode();
  showToast("Text layer deleted");
});

document.querySelector("[data-caption-mode]")?.addEventListener("change", (event) => {
  if (!selectedCaptionClip()) return showToast("Select a caption clip first");
  editor.setCaptionLayer({ mode: event.target.value });
  syncCaptionPanelFromClip();
  applyAnimatedPreviewFrame();
  updateTimecode();
});

document.querySelector("[data-caption-animation]")?.addEventListener("change", (event) => {
  if (!selectedCaptionClip()) return showToast("Select a caption clip first");
  editor.setCaptionLayer({ animation: event.target.value });
  editor.setTextAnimation(event.target.value === "rise" ? "slide-up" : event.target.value === "pop" ? "scale-in" : event.target.value);
  syncCaptionPanelFromClip();
  applyAnimatedPreviewFrame();
  updateTimecode();
});

document.querySelector("[data-caption-speaker]")?.addEventListener("change", (event) => {
  if (!selectedCaptionClip()) return showToast("Select a caption clip first");
  const color = event.target.selectedOptions[0]?.dataset.color ?? "#bfeeff";
  editor.setCaptionLayer({ speaker: event.target.value, speakerColor: color });
  applyAnimatedPreviewFrame();
  updateTimecode();
});

document.querySelector("[data-caption-track]")?.addEventListener("change", (event) => {
  const clip = selectedCaptionClip();
  if (!clip) return showToast("Select a caption clip first");
  editor.moveClipToTrack(clip.id, event.target.value, clip.timelineStart ?? clip.start);
  renderTimelineFromState();
  showToast("Caption moved to track");
});

document.querySelectorAll("[data-caption-timing]").forEach((control) => {
  control.addEventListener("input", () => {
    const clip = selectedCaptionClip();
    if (!clip) return showToast("Select a caption clip first");
    const start = Number(document.querySelector("[data-caption-timing=\"start\"]").value);
    const duration = Number(document.querySelector("[data-caption-timing=\"duration\"]").value);
    editor.setCaptionTiming(start, duration);
    syncCaptionPanelFromClip();
    renderTimelineFromState();
    updateTimecode();
  });
});

document.querySelector("[data-caption-words]")?.addEventListener("change", (event) => {
  const clip = selectedCaptionClip();
  if (!clip) return showToast("Select a caption clip first");
  const target = event.target;
  const textId = target.dataset.captionWordText;
  const startId = target.dataset.captionWordStart;
  const endId = target.dataset.captionWordEnd;
  const id = textId || startId || endId;
  if (!id) return;
  const patch = {};
  if (textId) patch.text = target.value;
  if (startId) patch.start = Number(target.value);
  if (endId) patch.end = Number(target.value);
  editor.updateCaptionWord(id, patch);
  syncCaptionPanelFromClip();
  renderTimelineFromState();
  applyAnimatedPreviewFrame();
  updateTimecode();
});

document.querySelector("[data-caption-search]")?.addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll(".caption-block").forEach((block) => {
    block.classList.toggle("search-match", Boolean(query && block.textContent.toLowerCase().includes(query)));
  });
});

document.querySelectorAll("[data-caption-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.captionAction;
    if (action === "replace") {
      editor.replaceCaptions(document.querySelector("[data-caption-search]").value, document.querySelector("[data-caption-replace]").value);
      renderTimelineFromState();
      showToast("Captions replaced");
      return;
    }
    if (action === "new-track") {
      const track = editor.addCaptionTrack(`Captions ${editor.state.tracks.filter((item) => item.name.toLowerCase().includes("caption")).length + 1}`);
      showToast(`${track.name} created in engine`);
      syncCaptionPanelFromClip();
      return;
    }
    if (action === "add") {
      editor.addCaptionLayer("New caption", 3);
      renderTimelineFromState();
      syncCaptionPanelFromClip();
      applyAnimatedPreviewFrame();
      updateTimecode();
      showToast("Caption segment added");
      return;
    }
    const clip = selectedCaptionClip();
    if (!clip) return showToast("Select a caption clip first");
    if (action === "safe-zone") {
      editor.setCaptionLayer({ safeZone: !clip.captionLayer?.safeZone });
    }
    if (action === "template") {
      editor.applyCaptionTemplate(document.querySelector("[data-caption-template]").value);
    }
    if (action === "split") {
      const splitPoint = Number(document.querySelector("[data-caption-timing='duration']")?.value || 0);
      if (splitPoint > 0) {
        const result = editor.splitCaption(clip.id, (clip.timelineStart ?? clip.start) + splitPoint);
        if (result) showToast("Caption split");
        else showToast("Cannot split at this point");
      } else {
        showToast("Set split duration first");
      }
    }
    if (action === "merge") {
      const captionIds = editor.state.clips.filter((c) => c.type === "caption" && c.trackId === clip.trackId).map((c) => c.id);
      if (captionIds.length > 1) {
        editor.mergeCaptions(captionIds);
        showToast("Captions merged");
      } else {
        showToast("Need 2+ captions to merge");
      }
    }
    if (action === "export") {
      const format = document.querySelector("[data-caption-export-format]").value;
      const output = editor.exportCaptions(format);
      const preview = document.querySelector("[data-caption-export-preview]");
      preview.hidden = false;
      preview.textContent = output.slice(0, 900);
      const blob = new Blob([output], { type: format === "json" ? "application/json" : "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), { href: url, download: `launchly-captions.${format}` });
      link.click();
      URL.revokeObjectURL(url);
    }
    syncCaptionPanelFromClip();
    applyAnimatedPreviewFrame();
    updateTimecode();
    showToast(`Caption ${action} applied`);
  });
});

document.querySelector("[data-caption-import-btn]")?.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".srt,.vtt,.txt";
  input.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const format = file.name.endsWith(".vtt") ? "vtt" : "srt";
      const imported = editor.importCaptions(format, reader.result);
      if (imported.length) {
        renderTimelineFromState();
        syncCaptionPanelFromClip();
        showToast(`${imported.length} captions imported`);
      } else {
        showToast("No captions found in file");
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

document.querySelector("[data-caption-generate-btn]")?.addEventListener("click", () => {
  showToast("Speech-to-text generation requires AI backend (coming soon)");
});

document.querySelector("[data-caption-global-style]")?.addEventListener("change", (event) => {
  const style = {};
  const param = event.target.dataset.captionGlobalStyle;
  const value = param === "fontSize" ? Number(event.target.value) : event.target.value;
  style[param] = value;
  editor.setCaptionGlobalStyle(style);
  applyAnimatedPreviewFrame();
  updateTimecode();
  showToast("Global caption style updated");
});

document.querySelectorAll("[data-audio-param]").forEach((control) => {
  control.addEventListener("input", () => {
    if (!selectedAudioClip()) return showToast("Select an audio clip first");
    const parameter = control.dataset.audioParam;
    const value = audioControlValue(parameter, control.value);
    editor.setAudio({ [parameter]: value });
    setAudioControl(parameter, value);
    updateTimecode();
  });
});

document.querySelectorAll("[data-audio-eq]").forEach((control) => {
  control.addEventListener("input", () => {
    if (!selectedAudioClip()) return showToast("Select an audio clip first");
    const band = control.dataset.audioEq;
    const value = Number(control.value);
    editor.setAudioEQ(band, value);
    setAudioEqControl(band, value);
    updateTimecode();
  });
});

document.querySelectorAll("[data-audio-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!selectedAudioClip()) return showToast("Select an audio clip first");
    const type = button.dataset.audioToggle;
    const active = !button.classList.contains("active");
    button.classList.toggle("active", active);
    if (type === "compressor") editor.setAudioCompressor({ enabled: active });
    if (type === "limiter") editor.setAudioLimiter({ enabled: active });
    syncAudioPanelFromClip();
    updateTimecode();
  });
});

document.querySelectorAll("[data-audio-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const clip = selectedAudioClip();
    if (!clip) return showToast("Select an audio clip first");
    const action = button.dataset.audioAction;
    if (action === "mute") editor.setMute(!clip.audio?.muted);
    if (action === "solo") editor.setSolo(!clip.audio?.solo);
    if (action === "reset") editor.setAudio({ volume: 1, pan: 0, fadeIn: 0, fadeOut: 0, noiseReduction: 0, voiceEnhance: 0, eq: { low: 0, mid: 0, high: 0 }, compressor: { enabled: false }, limiter: { enabled: false }, keyframes: [] });
    if (action === "keyframe") {
      const audio = selectedAudioClip().audio;
      ["volume", "pan", "noiseReduction", "voiceEnhance"].forEach((parameter) => editor.addAudioKeyframe(parameter, audio[parameter], editor.state.time, "ease-out"));
      ["low", "mid", "high"].forEach((band) => editor.addAudioKeyframe(`eq.${band}`, audio.eq?.[band] ?? 0, editor.state.time, "ease-out"));
    }
    syncAudioPanelFromClip();
    updateTimecode();
    showToast(`Audio ${action} applied`);
  });
});

document.querySelectorAll("[data-control]").forEach((control) => {
  control.addEventListener("input", () => {
    const value = Number(control.value);
    const name = control.dataset.control;
    const label = document.querySelector(`[data-value-for="${name}"]`);
    if (!label) return;
    if (name === "exposure") label.textContent = `${((value - 50) / 22).toFixed(1)}`;
    if (["contrast", "saturation", "highlights", "motion", "stability", "tracking", "noise"].includes(name)) label.textContent = `${value}%`;
    if (name === "temperature") label.textContent = value > 58 ? "Warm" : value < 42 ? "Cool" : "Neutral";
    if (name === "reframing" || name === "ducking") label.textContent = value > 50 ? "On" : "Off";
    if (name === "voice") label.textContent = value > 70 ? "Studio" : value > 40 ? "Warm" : "Natural";
    if (name === "music") label.textContent = `${Math.round((value - 60) / 2)} dB`;
    const nextScore = Math.min(99, Math.max(72, Math.round((value + 124) / 2.1)));
    score.textContent = String(nextScore);
    document.querySelector(".score-ring").style.setProperty("--score", nextScore);
  });
});

document.querySelector("[data-reset-controls]")?.addEventListener("click", () => {
  const defaults = { exposure: 68, contrast: 42, saturation: 56, temperature: 62, highlights: 31, motion: 34, stability: 72, reframing: 88, tracking: 92, voice: 78, noise: 64, music: 44, ducking: 76 };
  Object.entries(defaults).forEach(([name, value]) => {
    const control = document.querySelector(`[data-control="${name}"]`);
    if (!control) return;
    control.value = value;
    control.dispatchEvent(new Event("input"));
  });
  score.textContent = "96";
  document.querySelector(".score-ring").style.setProperty("--score", 96);
  showToast("Controls reset");
});

document.querySelectorAll(".mini-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const active = !button.classList.contains("active");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
});

document.querySelectorAll(".precision-layer-list button").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveWithin(".precision-layer-list button", button);
    document.querySelector(".layer-identity strong").textContent = button.dataset.layerName;
    document.querySelector(".layer-identity span").textContent = button.dataset.layerType;
    const match = editor.state.clips.find((clip) => clip.name === button.dataset.layerName);
    if (match) {
      editor.selectClip(match.id);
      syncEditorToDom();
    }
    showToast(`${button.dataset.layerName} layer selected`);
  });
});

document.querySelector("[data-layer-manager]")?.addEventListener("click", (event) => {
  const row = event.target.closest("[data-layer-id]");
  if (!row) return;
  const clip = editor.state.clips.find((item) => item.id === row.dataset.layerId);
  if (!clip) return;
  editor.selectClip(clip.id, { additive: event.shiftKey || event.ctrlKey || event.metaKey });
  syncEditorToDom();
  showToast(`${clip.name} layer selected`);
});

document.querySelector("[data-layer-manager]")?.addEventListener("dblclick", (event) => {
  const row = event.target.closest("[data-layer-id]");
  const clip = editor.state.clips.find((item) => item.id === row?.dataset.layerId);
  if (row && clip) renameSelectedLayerInline(row, clip);
});

document.querySelector("[data-layer-manager]")?.addEventListener("dragstart", (event) => {
  const row = event.target.closest("[data-layer-id]");
  if (!row) return;
  event.dataTransfer.setData("application/x-launchly-layer", row.dataset.layerId);
  row.classList.add("dragging");
});

document.querySelector("[data-layer-manager]")?.addEventListener("dragend", (event) => {
  event.target.closest("[data-layer-id]")?.classList.remove("dragging");
});

document.querySelector("[data-layer-manager]")?.addEventListener("dragover", (event) => {
  if (event.dataTransfer.types.includes("application/x-launchly-layer") && event.target.closest("[data-layer-id]")) event.preventDefault();
});

document.querySelector("[data-layer-manager]")?.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-layer-id]");
  const sourceId = event.dataTransfer.getData("application/x-launchly-layer");
  if (!target || !sourceId || sourceId === target.dataset.layerId) return;
  event.preventDefault();
  const source = editor.state.clips.find((clip) => clip.id === sourceId);
  const targetClip = editor.state.clips.find((clip) => clip.id === target.dataset.layerId);
  if (!source || !targetClip || source.locked) return;
  editor.setLayerOrder(source.id, (targetClip.layer ?? 0) + 0.01);
  normalizeLayerOrder();
  refreshLayerLiveUpdate("Layer order updated");
});

function normalizeLayerOrder() {
  sortedLayerClips().reverse().forEach((clip, index) => editor.setClipProperties(clip.id, { layer: index }));
}

document.querySelector(".selected-layer-card")?.addEventListener("click", (event) => {
  const action = event.target.closest("[data-layer-action]")?.dataset.layerAction;
  const color = event.target.closest("[data-layer-color]")?.dataset.layerColor;
  if (!action && !color) return;
  const selected = editor.selectedClips;
  if (!selected.length) return showToast("Select a layer first");
  if (color) {
    selected.forEach((clip) => editor.setClipProperties(clip.id, { colorLabel: color }));
    return refreshLayerLiveUpdate(`${color} layer color applied`);
  }
  if (action === "hide") {
    editor.commit("clip:properties", () => {
      selected.forEach((clip) => { clip.hidden = !clip.hidden; });
      return selected;
    });
  }
  if (action === "lock") {
    editor.commit("clip:properties", () => {
      selected.forEach((clip) => { clip.locked = !clip.locked; });
      return selected;
    });
  }
  if (action === "solo") {
    const next = !selected[0].solo;
    editor.commit("clip:properties", () => {
      editor.state.clips.forEach((clip) => { clip.solo = false; });
      selected.forEach((clip) => { clip.solo = next; });
      return selected;
    });
  }
  if (action === "duplicate") editor.duplicateSelected(0.5);
  if (action === "delete") editor.deleteSelected();
  if (action === "group") {
    const groupId = editor.groupSelected();
    editor.selectedClips.forEach((clip) => editor.setClipProperties(clip.id, { groupName: `Group ${String(groupId).slice(-4)}` }));
  }
  if (action === "ungroup") editor.ungroupSelected();
  if (action === "move-up" || action === "move-down") {
    selected.forEach((clip) => editor.setLayerOrder(clip.id, (clip.layer ?? 0) + (action === "move-up" ? 1 : -1)));
    normalizeLayerOrder();
  }
  refreshLayerLiveUpdate(`Layer ${action}`);
});

document.querySelectorAll("[data-toast]").forEach((item) => {
  item.addEventListener("click", () => showToast(item.dataset.toast));
});

function mediaItems() {
  return [...document.querySelectorAll(".media-item")];
}

function assetPayload(asset) {
  return {
    assetId: asset.id,
    mediaId: asset.id,
    name: asset.name,
    mediaType: asset.type,
    type: mediaTypeToClipType(asset.type),
    duration: asset.duration || (asset.type === "Image" ? 5 : 8),
    originalDuration: asset.duration || (asset.type === "Image" ? 5 : 8),
    sourceStart: 0,
    sourceEnd: asset.duration || (asset.type === "Image" ? 5 : 8),
  };
}

function assetThumbClass(asset) {
  if (asset.type === "Audio") return "audio-media";
  if (asset.source === "generated" || asset.folder === "AI Generated") return "generated-media";
  if (asset.type === "Image") return asset.name.toLowerCase().includes("logo") ? "logo-media" : asset.name.toLowerCase().includes("texture") ? "texture" : "image";
  return asset.name.toLowerCase().includes("product") ? "product-media" : "video";
}

function deterministicNumber(seed, min, max) {
  const text = String(seed);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) % 9973;
  return min + (hash % (max - min + 1));
}

function defaultAssetMetadata(asset) {
  if (!asset) return {};
  if (asset.type === "Audio") {
    const duration = Math.max(1, Number(asset.duration || 72));
    return {
      resolution: "Audio only",
      codec: asset.codec ?? "AAC",
      fps: "N/A",
      aspectRatio: "Waveform",
      fileSize: asset.fileSize || Math.round(duration * 0.32 * 10) / 10,
      sampleRate: asset.sampleRate ?? "48 kHz",
      channels: asset.channels ?? "Stereo"
    };
  }
  if (asset.type === "Image") {
    const wide = asset.name.toLowerCase().includes("logo") ? "2048 x 2048" : deterministicNumber(asset.name, 2400, 4200) + " x " + deterministicNumber(`${asset.name}:h`, 1350, 2600);
    return {
      resolution: asset.resolution ?? wide,
      codec: asset.codec ?? (asset.name.toLowerCase().includes("logo") ? "PNG" : "JPEG"),
      fps: "N/A",
      aspectRatio: asset.aspectRatio ?? (asset.name.toLowerCase().includes("logo") ? "1:1" : "16:9"),
      fileSize: asset.fileSize || Math.round(deterministicNumber(asset.name, 18, 96) / 10),
      sampleRate: null,
      channels: null
    };
  }
  const isVertical = asset.name.toLowerCase().includes("reel") || asset.name.toLowerCase().includes("story") || asset.tags?.includes("vertical");
  return {
    resolution: asset.resolution ?? (isVertical ? "1080 x 1920" : "3840 x 2160"),
    codec: asset.codec ?? asset.proxy?.codec ?? "H.264",
    fps: asset.fps ?? (deterministicNumber(asset.name, 0, 1) ? 30 : 24),
    aspectRatio: asset.aspectRatio ?? (isVertical ? "9:16" : "16:9"),
    fileSize: asset.fileSize || Math.round(Math.max(1, asset.duration || 8) * deterministicNumber(asset.name, 42, 92) / 10),
    sampleRate: null,
    channels: null
  };
}

function formatFileSize(size) {
  const value = Number(size || 0);
  if (!value) return "Unknown";
  return value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${value.toFixed(value < 10 ? 1 : 0)} MB`;
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes || 0);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function mediaPreviewAsset(item) {
  return editor.state.assetManager.assets.find((asset) => asset.id === item?.dataset.assetId)
    ?? {
      id: item?.dataset.assetId ?? item?.dataset.mediaName,
      name: item?.dataset.mediaName,
      type: item?.dataset.mediaType,
      duration: Number(item?.dataset.mediaDuration) || 0,
      folder: item?.closest(".media-section")?.querySelector("h3")?.textContent ?? "Project Media",
      tags: []
    };
}

function updateMediaPreviewProgress(progress) {
  if (!mediaPreview || mediaPreview.hidden) return;
  const asset = editor.state.assetManager.assets.find((item) => item.id === mediaPreviewState.assetId);
  const duration = Math.max(0, Number(asset?.duration ?? 0));
  mediaPreviewState.progress = Math.max(0, Math.min(100, Number(progress) || 0));
  mediaPreview.style.setProperty("--preview-progress", `${mediaPreviewState.progress}%`);
  const time = duration ? (duration * mediaPreviewState.progress) / 100 : 0;
  mediaPreview.querySelector("[data-media-preview-time]").textContent = asset?.type === "Image" ? `${Math.round(mediaPreviewState.imageZoom * 100)}%` : formatDuration(time);
  const scrub = mediaPreview.querySelector("[data-media-preview-scrub]");
  if (scrub) scrub.value = String(Math.round(mediaPreviewState.progress));
}

function stopMediaPreviewPlayback() {
  clearManagedInterval(mediaPreviewTimer);
  mediaPreviewTimer = null;
  mediaPreviewState.playing = false;
  mediaPreview?.classList.remove("is-playing");
  mediaPreview?.querySelector("[data-media-preview-play]") && (mediaPreview.querySelector("[data-media-preview-play]").textContent = "Play");
}

function startMediaPreviewPlayback() {
  if (!mediaPreviewState.assetId || mediaPreviewTimer) return;
  mediaPreviewState.playing = true;
  mediaPreview?.classList.add("is-playing");
  mediaPreview.querySelector("[data-media-preview-play]").textContent = "Pause";
  mediaPreviewTimer = managedInterval(() => {
    const next = mediaPreviewState.progress >= 100 ? 0 : mediaPreviewState.progress + 2.4;
    updateMediaPreviewProgress(next);
  }, 120);
}

function renderMediaPreview(item, event) {
  if (!mediaPreview || !item) return;
  const asset = mediaPreviewAsset(item);
  const metadata = defaultAssetMetadata(asset);
  mediaPreviewState = { assetId: asset.id, progress: 0, playing: asset.type !== "Image", imageZoom: 1 };
  const thumb = mediaPreview.querySelector("[data-media-preview-thumb]");
  thumb.className = `media-hover-thumb ${asset.type.toLowerCase()}-preview`;
  thumb.style.setProperty("--preview-tone", getComputedStyle(item.querySelector(".media-thumb")).backgroundImage);
  thumb.style.setProperty("--image-zoom", "1");
  mediaPreview.querySelector("[data-media-preview-title]").textContent = asset.name;
  mediaPreview.querySelector("[data-media-preview-subtitle]").textContent = `${asset.type} - ${asset.folder ?? "Project Media"} - ${asset.usageCount ?? 0} uses`;
  const zoom = mediaPreview.querySelector("[data-media-preview-zoom]");
  zoom.hidden = asset.type !== "Image";
  const audio = mediaPreview.querySelector("[data-media-preview-audio]");
  audio.hidden = asset.type === "Image";
  audio.classList.toggle("audio-only", asset.type === "Audio");
  mediaPreview.querySelector("[data-media-preview-meta]").innerHTML = [
    ["Duration", asset.type === "Image" ? "Still image" : formatDuration(Number(asset.duration || 0))],
    ["Resolution", metadata.resolution],
    ["Codec", metadata.codec],
    ["FPS", metadata.fps],
    ["Aspect", metadata.aspectRatio],
    ["Size", formatFileSize(metadata.fileSize)],
    ...(asset.type === "Audio" ? [["Sample rate", metadata.sampleRate], ["Channels", metadata.channels]] : [])
  ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "Unknown")}</strong></div>`).join("");
  updateMediaPreviewProgress(0);
  positionMediaPreview(event);
  mediaPreview.hidden = false;
  requestAnimationFrame(() => mediaPreview.classList.add("open"));
  if (asset.type !== "Image") startMediaPreviewPlayback();
}

function positionMediaPreview(event) {
  if (!mediaPreview || mediaPreview.hidden) return;
  mediaPreview.style.left = `${Math.min(window.innerWidth - 342, event.clientX + 16)}px`;
  mediaPreview.style.top = `${Math.min(window.innerHeight - 430, event.clientY + 16)}px`;
}

function renderAssetControls() {
  const manager = editor.state.assetManager;
  const folderTree = document.querySelector("[data-am-folders]");
  const tagCloud = document.querySelector("[data-am-tags]");
  if (folderTree) {
    const folders = ["all", ...(manager.folders ?? [])];
    folderTree.innerHTML = folders.map((f) => {
      const isActive = f === "all" ? !manager.filter.folder || manager.filter.folder === "All" : manager.filter.folder === f;
      const label = f === "all" ? "All Folders" : f;
      return `<button class="am-folder${isActive ? " active" : ""}" data-am-folder="${f}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>${escapeHtml(label)}</span></button>`;
    }).join("");
    folderTree.querySelectorAll(".am-folder").forEach((btn) => {
      btn.addEventListener("click", () => {
        folderTree.querySelectorAll(".am-folder").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        editor.setAssetFilter({ folder: btn.dataset.amFolder === "all" ? "All" : btn.dataset.amFolder });
        applyMediaFilters();
      });
    });
  }
  if (tagCloud) {
    const tags = [...new Set(manager.assets.flatMap((asset) => asset.tags ?? []))].sort();
    tagCloud.innerHTML = tags.map((t) => `<button class="am-tag${manager.filter.tag === t ? " active" : ""}" data-am-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("");
    tagCloud.querySelectorAll(".am-tag").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        const activeTags = [...tagCloud.querySelectorAll(".am-tag.active")].map((t) => t.dataset.amTag);
        editor.setAssetFilter({ tag: activeTags.length === 1 ? activeTags[0] : "All" });
        applyMediaFilters();
      });
    });
  }
  const allAssets = manager.assets ?? [];
  const counts = { all: allAssets.length, video: 0, image: 0, audio: 0, brand: 0, ai: 0, favorites: 0 };
  allAssets.forEach((a) => {
    const t = (a.type ?? "").toLowerCase();
    if (t === "video") counts.video++;
    else if (t === "image") counts.image++;
    else if (t === "audio") counts.audio++;
    if (a.folder === "Brand Assets") counts.brand++;
    if (a.folder === "AI Generated") counts.ai++;
    if (a.favorite) counts.favorites++;
  });
  Object.entries(counts).forEach(([key, val]) => {
    const el = document.querySelector(`[data-am-count="${key}"]`);
    if (el) el.textContent = val;
  });
}

/* Left box of the duo shows the first imported image; the right stays an
   empty slot. Falls back to a label when nothing has been imported yet. */
function renderMediaDuo() {
  const box = document.querySelector("[data-media-duo-primary]");
  if (!box) return;
  const assets = editor.state.assetManager.assets ?? [];
  const firstImage = assets.find((asset) => asset.type === "image") ?? assets[0];
  const src = firstImage?.previewUrl ?? firstImage?.url ?? firstImage?.src;
  const existing = box.querySelector("img");

  if (!src) {
    existing?.remove();
    return;
  }
  const img = existing ?? document.createElement("img");
  img.alt = firstImage.name ?? "Imported media";
  if (img.getAttribute("src") !== src) img.src = src;
  if (!existing) box.appendChild(img);
}

function renderAssetManager() {
  const target = document.querySelector("[data-asset-sections]");
  if (!target) return;
  renderAssetControls();
  renderMediaDuo();
  document.querySelectorAll(".media-library > .media-section").forEach((section) => { section.hidden = true; });
  const assets = editor.filteredAssets();
  const folders = [...new Set(assets.map((asset) => asset.folder))];
  target.innerHTML = folders.map((folder) => {
    const group = assets.filter((asset) => asset.folder === folder);
    return `<section class="media-section"><h3>${folder}</h3><div class="media-grid">${group.map((asset) => `
      <article class="media-item${editor.state.assetManager.selectedAssetIds.includes(asset.id) ? " selected" : ""}${asset.favorite ? " favorite" : ""}" draggable="true" data-asset-id="${asset.id}" data-media-name="${asset.name}" data-media-type="${asset.type}" data-media-date="${asset.updatedAt.slice(0, 10)}" data-media-duration="${asset.duration}" data-media-recent="${asset.recent}">
        <div class="media-thumb ${assetThumbClass(asset)}" data-preview-url="${escapeHtml(assetPreviewUrls.get(asset.id) ?? "")}" data-preview-kind="${escapeHtml(asset.type ?? "")}"></div>
        <div><strong>${asset.name}</strong><span>${formatDuration(asset.duration)} · ${asset.type} · Used ${asset.usageCount}x</span></div>
        <button data-asset-menu="${asset.id}" aria-label="Asset actions">...</button>
      </article>`).join("")}</div></section>`;
  }).join("");
  mediaLibrary.classList.toggle("empty", assets.length === 0);
  scheduleLazyMediaHydration();
}

let mediaThumbObserver = null;

/* Object URLs for imported files, keyed by asset id, so the library can show
   the actual picture/frame rather than a two-letter placeholder. */
const assetPreviewUrls = new Map();

function hydrateMediaThumb(thumb) {
  if (!thumb || thumb.dataset.thumbReady) return;
  thumb.dataset.thumbReady = "true";

  const url = thumb.dataset.previewUrl;
  const kind = (thumb.dataset.previewKind ?? "").toLowerCase();

  if (url && kind === "image") {
    const img = document.createElement("img");
    // Not loading="lazy": these are created only for files the user just
    // imported, and lazy defers the decode so the thumbnail stays blank.
    img.decoding = "async";
    img.alt = thumb.closest(".media-item")?.dataset.mediaName ?? "";
    img.src = url;
    thumb.replaceChildren(img);
    thumb.classList.add("thumb-ready", "has-preview");
    return;
  }

  if (url && kind === "video") {
    // muted+preload=metadata paints the first frame without playing anything.
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    thumb.replaceChildren(video);
    thumb.classList.add("thumb-ready", "has-preview");
    return;
  }

  runWhenIdle(() => {
    thumb.classList.add("thumb-ready");
    if (!thumb.querySelector("em")) {
      const item = thumb.closest(".media-item");
      const label = document.createElement("em");
      label.textContent = (item?.dataset.mediaName ?? "").slice(0, 2).toUpperCase();
      thumb.appendChild(label);
    }
  }, 450);
}

function scheduleLazyMediaHydration() {
  const thumbs = [...document.querySelectorAll(".media-thumb:not([data-thumb-ready])")];
  if (!thumbs.length) return;
  // Thumbs backed by a real uploaded file are hydrated immediately: the user
  // just imported them and must see them straight away. Only the placeholder
  // initials are left to the lazy observer.
  thumbs.filter((thumb) => thumb.dataset.previewUrl).forEach(hydrateMediaThumb);
  const remaining = thumbs.filter((thumb) => !thumb.dataset.thumbReady);
  if (!remaining.length) return;
  if ("IntersectionObserver" in window) {
    mediaThumbObserver?.disconnect();
    mediaThumbObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        hydrateMediaThumb(entry.target);
        mediaThumbObserver.unobserve(entry.target);
      });
    }, { root: mediaLibrary, rootMargin: "160px" });
    remaining.forEach((thumb) => mediaThumbObserver.observe(thumb));
    return;
  }
  remaining.slice(0, 18).forEach(hydrateMediaThumb);
}

function formatDuration(seconds) {
  if (!seconds) return "Still";
  const s = Math.max(0, Number(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function formatRulerTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/* Pick the smallest "nice" step whose labels are at least MIN_LABEL_PX apart,
   so timestamps never collide into unreadable runs when zoomed out. */
const RULER_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
const MIN_LABEL_PX = 56;
const MIN_TICK_PX = 8;

function rulerStepForUnit(unit) {
  return RULER_STEPS.find((step) => step * unit >= MIN_LABEL_PX) ?? RULER_STEPS[RULER_STEPS.length - 1];
}

function updateTimelineRuler() {
  const ruler = timelineRulerEl();
  if (!ruler) return;
  timelineEditor.style.setProperty("--timeline-duration", String(editor.state.duration));
  const unit = timelinePixelsPerSecond();
  const duration = editor.state.duration;
  const step = rulerStepForUnit(unit);
  // Width is left to CSS (calc(var(--unit) * var(--timeline-duration))) so the
  // ruler rescales with zoom exactly like the track lanes do. An inline width
  // here would freeze it at whatever zoom was active when it last rendered.
  ruler.style.removeProperty("width");
  ruler.style.removeProperty("min-width");

  const frag = document.createDocumentFragment();

  // Minor ticks subdivide the major step, but only while they stay legible.
  const subdivisions = 4;
  const minorStep = step / subdivisions;
  const drawMinor = minorStep * unit >= MIN_TICK_PX;

  for (let time = 0; time <= duration + 1e-6; time += step) {
    const major = document.createElement("span");
    major.className = "ruler-tick major";
    major.style.left = `${time * unit}px`;
    const bar = document.createElement("i");
    const label = document.createElement("b");
    label.textContent = formatRulerTime(time);
    major.append(bar, label);
    frag.appendChild(major);

    if (!drawMinor) continue;
    for (let sub = time + minorStep; sub < time + step - 1e-6 && sub <= duration; sub += minorStep) {
      const minor = document.createElement("span");
      minor.className = "ruler-tick minor";
      minor.style.left = `${sub * unit}px`;
      minor.appendChild(document.createElement("i"));
      frag.appendChild(minor);
    }
  }

  ruler.replaceChildren(frag);
  // Zoom changes the pixels-per-second, so the playhead has to be re-placed
  // from state whenever the ruler is rebuilt.
  renderPlayhead();
}

function mediaPayloadFromItem(item) {
  const asset = editor.state.assetManager.assets.find((entry) => entry.id === item.dataset.assetId);
  if (asset) return assetPayload(asset);
  return {
    name: item.dataset.mediaName,
    mediaType: item.dataset.mediaType,
    type: mediaTypeToClipType(item.dataset.mediaType),
    duration: Number(item.dataset.mediaDuration) || (item.dataset.mediaType === "Image" ? 5 : 8),
    originalDuration: Number(item.dataset.mediaDuration) || (item.dataset.mediaType === "Image" ? 5 : 8),
    sourceStart: 0,
    sourceEnd: Number(item.dataset.mediaDuration) || (item.dataset.mediaType === "Image" ? 5 : 8),
  };
}

/* Single geometry source for the timeline: the ruler defines the time origin
   (t=0 at its left edge) and clipUnit() defines pixels-per-second. Everything
   that maps between pixels and time goes through these two helpers. */
function timelineRulerEl() {
  return document.querySelector("[data-timeline-ruler], .timeline-ruler");
}

/* Pixels-per-second as the ruler is ACTUALLY laid out right now. Deriving it
   from the ruler's own box (rather than from --unit independently) guarantees
   the playhead and the pointer mapping can never drift apart from the tick
   labels, even if a zoom change hasn't been re-rendered yet. */
function rulerPixelsPerSecond() {
  const ruler = timelineRulerEl();
  const duration = editor.state.duration;
  if (ruler && duration > 0) {
    const width = ruler.getBoundingClientRect().width;
    if (width > 0) return width / duration;
  }
  return timelinePixelsPerSecond();
}

function timelineTimeFromPointer(event) {
  const ruler = timelineRulerEl();
  if (!ruler) return 0;
  const rect = ruler.getBoundingClientRect();
  const time = (event.clientX - rect.left) / rulerPixelsPerSecond();
  return Math.min(editor.state.duration, Math.max(0, time));
}

function createTimelineClipFromPayload(payload, lane, event) {
  const track = trackForLane(lane);
  if (!track) return undefined;
  const dropTime = payload.timelineStart ?? timelineTimeFromPointer(event);
  const clipData = { ...payload, trackId: track.id, timelineStart: editor.snapTime(dropTime), start: editor.snapTime(dropTime) };
  if (!editor.isClipCompatibleWithTrack(clipData, track)) {
    showToast(`${payload.mediaType || payload.type} cannot be placed on ${track.name}`);
    return undefined;
  }
  const clip = editor.addClip(clipData);
  if (!clip) showToast("Clip placement blocked by overlap or locked track");
  return clip;
}

function applyMediaFilters() {
  const input = document.querySelector("[data-am-search]");
  const sortEl = document.querySelector("[data-media-sort]");
  const query = input?.value?.trim().toLowerCase() ?? "";
  const sort = sortEl?.value ?? "recent";
  editor.setAssetFilter({ query, sort });
  renderAssetManager();
}

function simulateUpload(files) {
  const progress = document.querySelector("[data-upload-progress]");
  const percent = document.querySelector("[data-upload-percent]");
  const uploadNotificationId = notify({ id: "upload-progress", title: "Upload Progress", message: `Uploading ${files.length} file${files.length === 1 ? "" : "s"}`, type: "progress", progress: 0, duration: Infinity });
  if (progress) {
    progress.hidden = false;
    progress.style.setProperty("--upload-progress", "0%");
  }
  if (percent) percent.textContent = "0%";
  let value = 0;
  let tick = 0;
  const timer = managedInterval(() => {
    tick += 1;
    value += 10 + (tick % 4) * 3;
    value = Math.min(100, value);
    progress?.style.setProperty("--upload-progress", `${value}%`);
    if (percent) percent.textContent = `${value}%`;
    notify({ id: uploadNotificationId, title: "Upload Progress", message: `Indexing local media - ${value}%`, type: "progress", progress: value, duration: Infinity });
    if (value === 100) {
      clearManagedInterval(timer);
      importUploadedMediaItems(files);
      managedTimeout(() => { if (progress) progress.hidden = true; }, 650);
      notify({ id: uploadNotificationId, title: "Upload Complete", message: `${files.length} file${files.length === 1 ? "" : "s"} added locally`, type: "success", progress: 100, duration: 4200 });
    }
  }, 120);
}

function importUploadedMediaItems(files) {
  syncMediaEngineFromEditor();
  const fileList = [...files];
  const assets = mediaEngine.importFiles(fileList, { folder: "Recent Uploads", tags: ["local"], generateProxy: true });
  // The engine only records metadata, so hold an object URL per asset here to
  // give the library a real thumbnail of what was just imported.
  assets.forEach((asset, index) => {
    const file = fileList[index];
    if (!file || assetPreviewUrls.has(asset.id)) return;
    try {
      assetPreviewUrls.set(asset.id, URL.createObjectURL(file));
    } catch { /* non-File input (e.g. synthetic drops): fall back to initials */ }
  });
  commitMediaEngineToEditor(`${assets.length} media asset${assets.length === 1 ? "" : "s"} indexed locally`);
  if (pendingReplaceClipId && assets[0]) {
    const replacement = editor.replaceClipMedia(pendingReplaceClipId, assetPayload(assets[0]));
    if (replacement) {
      renderTimelineFromState();
      syncEditorToDom();
      persistTimelineEdit("clip:replace-media");
      showToast(`${replacement.name} replaced on timeline`, { type: "success", title: "Replace Media" });
    }
    pendingReplaceClipId = null;
  }
  applyMediaFilters();
}

let contextAssetId = null;
let contextMenuState = { target: "media", clipId: null, trackId: null, assetId: null, textLayer: false };

function menuShortcut(action) {
  return ({
    cut: "Ctrl+X",
    copy: shortcuts.copy,
    paste: shortcuts.paste,
    duplicate: shortcuts.duplicate,
    delete: shortcuts.delete,
    split: shortcuts.split,
    "ripple-delete": "Shift+Delete",
    group: shortcuts.group,
    lock: shortcuts.lock,
    speed: "Ctrl+R",
    properties: "Enter",
  })[action] ?? "";
}

function menuItem(action, label, { danger = false, disabled = false } = {}) {
  const shortcut = menuShortcut(action);
  return `<button type="button" class="${danger ? "danger" : ""}" data-menu-action="${action}" ${disabled ? "disabled" : ""}><span>${label}</span>${shortcut ? `<kbd>${shortcut}</kbd>` : ""}</button>`;
}

function menuSection(items) {
  return `<div class="context-menu-section">${items.join("")}</div>`;
}

function contextMenuItems(target) {
  const hasClip = Boolean(contextMenuState.clipId);
  const hasAsset = Boolean(contextMenuState.assetId);
  const hasTrack = Boolean(contextMenuState.trackId);
  const selectedCount = editor.state.selectedClipIds.length;
  if (target === "clip" || target === "text") {
    return [
      menuSection([menuItem("cut", "Cut"), menuItem("copy", "Copy"), menuItem("paste", "Paste"), menuItem("duplicate", "Duplicate")]),
      menuSection([menuItem("split", "Split at Playhead"), menuItem("ripple-delete", "Ripple Delete", { danger: true }), menuItem("replace-media", "Replace Media"), menuItem("speed", "Speed"), menuItem("color-label", "Color Label")]),
      menuSection([menuItem("lock", "Lock Track"), menuItem("hide", "Hide Track"), menuItem("solo", "Solo Track"), menuItem("reveal-media", "Reveal in Media"), menuItem("properties", "Properties")]),
      menuSection([menuItem("group", "Group", { disabled: selectedCount < 2 }), menuItem("ungroup", "Ungroup", { disabled: !hasClip })]),
      menuSection([menuItem("rename", "Rename"), menuItem("delete", "Delete", { danger: true })]),
    ].join("");
  }
  if (target === "track") {
    return [
      menuSection([menuItem("paste", "Paste"), menuItem("rename", "Rename Track"), menuItem("duplicate", "Duplicate Selected Clips")]),
      menuSection([menuItem("lock", "Lock Track"), menuItem("hide", "Hide Track"), menuItem("solo", "Solo Track"), menuItem("properties", "Track Properties")]),
      menuSection([menuItem("delete", "Delete Selected Clips", { danger: true })]),
    ].join("");
  }
  if (target === "media" || target === "asset" || target === "folder") {
    return [
      menuSection([menuItem("copy", "Copy"), menuItem("paste", "Paste to Timeline"), menuItem("duplicate", "Duplicate Asset"), menuItem("rename", "Rename")]),
      menuSection([menuItem("reveal-media", "Reveal in Media"), menuItem("color-label", "Color Label"), menuItem("properties", "Properties")]),
      menuSection([menuItem("favorite", "Toggle Favorite"), menuItem("tag", "Add Campaign Tag"), menuItem("move-folder", "Move to Project Media")]),
      menuSection([menuItem("delete", "Delete", { danger: true, disabled: !hasAsset && !hasTrack })]),
    ].join("");
  }
  return [
    menuSection([menuItem("paste", "Paste"), menuItem("split", "Split"), menuItem("properties", "Canvas Properties")]),
    menuSection([menuItem("hide", "Toggle Guides"), menuItem("color-label", "Canvas Label")]),
  ].join("");
}

function openContextMenu(x, y, state = {}) {
  contextMenuState = { target: "media", clipId: null, trackId: null, assetId: null, textLayer: false, ...state };
  contextMenu.innerHTML = contextMenuItems(contextMenuState.target);
  contextMenu.dataset.menuTarget = contextMenuState.target;
  contextMenu.hidden = false;
  const rect = contextMenu.getBoundingClientRect();
  contextMenu.style.left = `${Math.min(window.innerWidth - rect.width - 12, x)}px`;
  contextMenu.style.top = `${Math.min(window.innerHeight - rect.height - 12, y)}px`;
  requestAnimationFrame(() => contextMenu.classList.add("open"));
}

function closeContextMenu() {
  contextMenu.classList.remove("open");
  contextMenu.hidden = true;
}

function selectedTrackForContext() {
  if (contextMenuState.trackId) return editor.state.tracks.find((track) => track.id === contextMenuState.trackId);
  const clip = contextMenuState.clipId ? editor.state.clips.find((item) => item.id === contextMenuState.clipId) : editor.selectedClips[0];
  return clip ? editor.state.tracks.find((track) => track.id === clip.trackId) : null;
}

function renameContextTarget() {
  if (contextMenuState.clipId) {
    const element = clipElement(contextMenuState.clipId);
    const clip = editor.state.clips.find((item) => item.id === contextMenuState.clipId);
    if (!element || !clip) return;
    const nextName = `${clip.name} Edit`;
    editor.setClipProperties(clip.id, { name: nextName });
    element.querySelector("strong") && (element.querySelector("strong").textContent = nextName);
    showToast("Clip renamed");
    return;
  }
  const track = selectedTrackForContext();
  if (track) {
    editor.setTrackState(track.id, { name: `${track.name} Edit` });
    renderTimelineFromState();
    showToast("Track renamed");
    return;
  }
  if (contextMenuState.assetId) {
    const asset = editor.state.assetManager.assets.find((item) => item.id === contextMenuState.assetId);
    if (asset) editor.updateAsset(asset.id, { name: `${asset.name} Edit` });
    renderAssetManager();
    showToast("Asset renamed");
  }
}

function applyContextAction(action) {
  const track = selectedTrackForContext();
  const selectedAssets = editor.state.assetManager.selectedAssetIds.length ? editor.state.assetManager.selectedAssetIds : contextMenuState.assetId ? [contextMenuState.assetId] : [];
  if (contextMenuState.clipId && !editor.state.selectedClipIds.includes(contextMenuState.clipId)) editor.selectClip(contextMenuState.clipId);
  const activeClip = contextMenuState.clipId ? editor.state.clips.find((item) => item.id === contextMenuState.clipId) : editor.selectedClips[0];
  if (action === "cut") { editor.copySelected(); editor.deleteSelected(); renderTimelineFromState(); showToast("Cut selected clips"); }
  if (action === "copy") {
    if (contextMenuState.assetId) showToast("Asset reference copied");
    else { editor.copySelected(); showToast("Selected clips copied"); }
  }
  if (action === "paste") { editor.paste(editor.state.time); renderTimelineFromState(); showToast("Pasted at playhead"); }
  if (action === "duplicate") {
    if (contextMenuState.assetId) selectedAssets.forEach((id) => {
      const asset = editor.state.assetManager.assets.find((item) => item.id === id);
      if (asset) editor.addAsset({ ...asset, id: undefined, name: `${asset.name} Copy` });
    });
    else editor.duplicateSelected();
    renderTimelineFromState();
    renderAssetManager();
    showToast("Duplicate created");
  }
  if (action === "rename") renameContextTarget();
  if (action === "delete") {
    if (contextMenuState.assetId) editor.deleteAssets(selectedAssets);
    else editor.deleteSelected();
    renderTimelineFromState();
    renderAssetManager();
    showToast("Deleted");
  }
  if (action === "ripple-delete") { editor.deleteSelected({ ripple: true }); renderTimelineFromState(); showToast("Ripple deleted selected clips"); }
  if (action === "split") { editor.splitSelected(editor.state.time); renderTimelineFromState(); showToast("Split at playhead"); }
  if (action === "replace-media") {
    pendingReplaceClipId = activeClip?.id ?? null;
    document.querySelector("[data-media-upload]")?.click();
    showToast("Choose replacement media");
  }
  if (action === "speed") { editor.setSpeed(1.25); syncEditorToDom(); showToast("Speed set to 1.25x"); }
  if (action === "color-label") { editor.selectedClips.forEach((clip) => editor.setClipProperties(clip.id, { colorLabel: "Ice" })); showToast("Color label applied"); }
  if (action === "lock" && track) { editor.setTrackState(track.id, { locked: !track.locked }); renderTimelineFromState(); showToast(track.locked ? "Track unlocked" : "Track locked"); }
  if (action === "hide" && track) { editor.setTrackState(track.id, { visible: !track.visible }); renderTimelineFromState(); showToast(track.visible ? "Track hidden" : "Track visible"); }
  if (action === "solo" && track) { editor.soloTrack(track.id); renderTimelineFromState(); showToast(track.solo ? `${track.name} soloed` : "Solo off"); }
  if (action === "reveal-media") { document.querySelector('[data-label="Media"]')?.click(); showToast("Revealed in Media panel"); }
  if (action === "group") { editor.groupSelected(); showToast("Selected clips grouped"); }
  if (action === "ungroup") { editor.ungroupSelected(); showToast("Selected clips ungrouped"); }
  if (action === "properties") { document.querySelector("[data-label='Properties']")?.click(); showToast("Properties shown"); }
  if (action === "favorite") { editor.toggleAssetFavorite(selectedAssets); renderAssetManager(); showToast("Favorite updated"); }
  if (action === "tag") { editor.tagAssets(selectedAssets, "campaign"); renderAssetManager(); showToast("Campaign tag applied"); }
  if (action === "move-folder") { editor.moveAssetsToFolder(selectedAssets, "Project Media"); renderAssetManager(); showToast("Moved to Project Media"); }
}

mediaLibrary?.addEventListener("click", (event) => {
  const item = event.target.closest(".media-item");
  if (!item) return;
  if (event.target.closest("[data-asset-menu]")) {
    contextAssetId = item.dataset.assetId;
    editor.selectAsset(contextAssetId, { additive: true });
    renderAssetManager();
    const rect = event.target.getBoundingClientRect();
    openContextMenu(rect.left, rect.bottom + 6, { target: "asset", assetId: contextAssetId });
    return;
  }
  editor.selectAsset(item.dataset.assetId, { additive: event.ctrlKey || event.metaKey, range: event.shiftKey });
  renderAssetManager();
});

mediaLibrary?.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".media-item");
  if (!item) return;
  item.classList.add("dragging");
  const selectedIds = editor.state.assetManager.selectedAssetIds.includes(item.dataset.assetId) ? editor.state.assetManager.selectedAssetIds : [item.dataset.assetId];
  const payload = selectedIds.map((id) => assetPayload(editor.state.assetManager.assets.find((asset) => asset.id === id))).filter(Boolean);
  setDragPayload(event, { type: "media", items: payload, clipType: payload[0]?.type, label: payload.map((media) => `${media.name} - ${media.mediaType}`).join(", ") });
  document.body.classList.add("is-dragging");
});

mediaLibrary?.addEventListener("dragend", (event) => {
  event.target.closest(".media-item")?.classList.remove("dragging");
  clearDragState();
});

mediaLibrary?.addEventListener("mouseover", (event) => {
  const item = event.target.closest(".media-item");
  if (!item || item.classList.contains("previewing")) return;
  item.classList.add("previewing");
  renderMediaPreview(item, event);
});

mediaLibrary?.addEventListener("mousemove", (event) => {
  positionMediaPreview(event);
});

mediaLibrary?.addEventListener("mouseout", (event) => {
  const item = event.target.closest(".media-item");
  if (!item || item.contains(event.relatedTarget)) return;
  if (mediaPreview?.contains(event.relatedTarget)) return;
  item.classList.remove("previewing");
  stopMediaPreviewPlayback();
  mediaPreview.classList.remove("open");
  mediaPreview.hidden = true;
});

mediaPreview?.addEventListener("mouseleave", () => {
  document.querySelectorAll(".media-item.previewing").forEach((item) => item.classList.remove("previewing"));
  stopMediaPreviewPlayback();
  mediaPreview.classList.remove("open");
  mediaPreview.hidden = true;
});

mediaPreview?.addEventListener("input", (event) => {
  const scrub = event.target.closest("[data-media-preview-scrub]");
  if (!scrub) return;
  stopMediaPreviewPlayback();
  updateMediaPreviewProgress(Number(scrub.value));
});

mediaPreview?.addEventListener("click", (event) => {
  const play = event.target.closest("[data-media-preview-play]");
  const zoom = event.target.closest("[data-image-zoom]");
  if (play) {
    mediaPreviewState.playing ? stopMediaPreviewPlayback() : startMediaPreviewPlayback();
  }
  if (zoom) {
    mediaPreviewState.imageZoom = Math.max(1, Math.min(2.4, mediaPreviewState.imageZoom + Number(zoom.dataset.imageZoom) * 0.2));
    mediaPreview.querySelector("[data-media-preview-thumb]").style.setProperty("--image-zoom", String(mediaPreviewState.imageZoom));
    mediaPreview.querySelector("[data-image-zoom-value]").textContent = `${Math.round(mediaPreviewState.imageZoom * 100)}%`;
    updateMediaPreviewProgress(mediaPreviewState.progress);
  }
});

mediaLibrary?.addEventListener("contextmenu", (event) => {
  const item = event.target.closest(".media-item");
  const section = event.target.closest(".media-section");
  if (!item && !section) return;
  event.preventDefault();
  if (item) {
    contextAssetId = item.dataset.assetId;
    editor.selectAsset(contextAssetId, { additive: true });
    renderAssetManager();
    openContextMenu(event.clientX, event.clientY, { target: "asset", assetId: contextAssetId });
    return;
  }
  openContextMenu(event.clientX, event.clientY, { target: "folder" });
});

contextMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-menu-action]");
  if (!button) return;
  applyContextAction(button.dataset.menuAction);
  closeContextMenu();
});

timelineEditor?.addEventListener("contextmenu", (event) => {
  const clip = event.target.closest(".edit-clip, .caption-block");
  const head = event.target.closest(".timeline-track-head");
  const lane = event.target.closest("[data-track-lane]");
  if (!clip && !head && !lane) return;
  event.preventDefault();
  if (clip) {
    editor.selectClip(clip.dataset.clipId, { additive: event.shiftKey || event.ctrlKey || event.metaKey });
    syncEditorToDom();
    const selected = editor.state.clips.find((item) => item.id === clip.dataset.clipId);
    openContextMenu(event.clientX, event.clientY, { target: selected?.type === "text" || selected?.type === "caption" ? "text" : "clip", clipId: clip.dataset.clipId, trackId: selected?.trackId ?? lane?.dataset.trackId ?? null, textLayer: selected?.type === "text" || selected?.type === "caption" });
    return;
  }
  const trackId = head?.nextElementSibling?.dataset.trackId ?? lane?.dataset.trackId ?? null;
  openContextMenu(event.clientX, event.clientY, { target: "track", trackId });
});

timelineEditor?.addEventListener("dragstart", (event) => {
  const clip = event.target.closest(".edit-clip, .caption-block");
  if (!clip) return;
  const selectedIds = editor.state.selectedClipIds.includes(clip.dataset.clipId) ? editor.state.selectedClipIds : [clip.dataset.clipId];
  setDragPayload(event, { type: "clip", clipIds: selectedIds, label: `${selectedIds.length} timeline clip${selectedIds.length === 1 ? "" : "s"}`, effectAllowed: "move" });
  clip.classList.add("dragging");
  document.body.classList.add("is-dragging");
});

timelineEditor?.addEventListener("dragend", (event) => {
  event.target.closest(".edit-clip, .caption-block")?.classList.remove("dragging");
  clearDragState();
});

videoFrame?.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const selected = editor.selectedClips[0];
  openContextMenu(event.clientX, event.clientY, { target: selected?.type === "text" || selected?.type === "caption" ? "text" : "canvas", clipId: selected?.id ?? null, trackId: selected?.trackId ?? null, textLayer: selected?.type === "text" || selected?.type === "caption" });
});

document.querySelector(".precision-layer-list")?.addEventListener("contextmenu", (event) => {
  const layer = event.target.closest("button");
  if (!layer) return;
  event.preventDefault();
  const match = editor.state.clips.find((clip) => clip.name === layer.dataset.layerName);
  if (match) editor.selectClip(match.id);
  openContextMenu(event.clientX, event.clientY, { target: "text", clipId: match?.id ?? null, trackId: match?.trackId ?? null, textLayer: true });
});

document.querySelector("[data-transition-editor]")?.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".transition-row");
  const selector = event.target.closest("[data-transition-name]");
  if (!row && !selector) return;
  setDragPayload(event, { type: "transition", name: row?.dataset.transitionName ?? document.querySelector("[data-transition-name]")?.value ?? "Fade", duration: Number(document.querySelector("[data-transition-duration]")?.value ?? 60) / 100, label: "Transition" });
  document.body.classList.add("is-dragging");
});

document.querySelector("[data-effects-editor]")?.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".effect-row");
  const selector = event.target.closest("[data-effect-type]");
  if (!row && !selector) return;
  setDragPayload(event, { type: "effect", effectType: row?.dataset.effectType ?? document.querySelector("[data-effect-type]")?.value ?? "blur", label: "Effect" });
  document.body.classList.add("is-dragging");
});

document.querySelector("[data-text-editor]")?.addEventListener("dragstart", (event) => {
  const source = event.target.closest("[data-text-template], [data-text-content]");
  if (!source) return;
  setDragPayload(event, { type: "text", text: document.querySelector("[data-text-content]")?.value || "Text Layer", clipType: "text", label: "Text Layer" });
  document.body.classList.add("is-dragging");
});

document.querySelectorAll("[data-upload-trigger]").forEach((trigger) => {
  trigger.addEventListener("click", () => document.querySelector("[data-media-upload]")?.click());
});

document.querySelectorAll("[data-media-subtab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-media-subtab]").forEach((other) => {
      const active = other === tab;
      other.classList.toggle("active", active);
      other.setAttribute("aria-selected", String(active));
    });
  });
});
document.querySelector("[data-media-upload]")?.addEventListener("change", (event) => {
  if (event.target.files.length) simulateUpload(event.target.files);
  event.target.value = "";
});

document.querySelector(".media-dropzone")?.addEventListener("dragover", (event) => event.preventDefault());
document.querySelector(".media-dropzone")?.addEventListener("drop", (event) => {
  event.preventDefault();
  if (event.dataTransfer.files.length) simulateUpload(event.dataTransfer.files);
});

document.querySelectorAll(".am-section-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".am-section-item").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    const section = button.dataset.amSection;
    const filterMap = { all: "All", video: "Video", image: "Image", audio: "Audio", favorites: "All", recent: "All", templates: "All", brand: "All", ai: "All" };
    const typeFilter = filterMap[section] ?? "All";
    const favoritesOnly = section === "favorites";
    editor.setAssetFilter({ type: typeFilter, favoritesOnly });
    applyMediaFilters();
    showToast(`${button.querySelector("span")?.textContent ?? section} selected`);
  });
});

document.querySelectorAll(".am-filter-pill").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveWithin(".am-filter-pill", button);
    const filter = button.dataset.amFilter;
    const typeMap = { all: "All", video: "Video", image: "Image", audio: "Audio" };
    editor.setAssetFilter({ type: typeMap[filter] ?? "All" });
    applyMediaFilters();
  });
});

document.querySelectorAll(".am-folder").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".am-folder").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    editor.setAssetFilter({ folder: button.dataset.amFolder ?? "All" });
    applyMediaFilters();
  });
});

document.querySelectorAll(".am-tag").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    const activeTags = [...document.querySelectorAll(".am-tag.active")].map((t) => t.dataset.amTag);
    editor.setAssetFilter({ tag: activeTags.length === 1 ? activeTags[0] : "All" });
    applyMediaFilters();
  });
});

document.querySelector("[data-am-search]")?.addEventListener("input", () => {
  mediaLibrary.classList.add("loading");
  clearManagedTimeout(mediaLibrary.searchTimer);
  mediaLibrary.searchTimer = managedTimeout(() => {
    mediaLibrary.classList.remove("loading");
    applyMediaFilters();
  }, 220);
});

document.querySelectorAll(".am-view-toggle button").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveWithin(".am-view-toggle button", button);
    mediaLibrary.classList.toggle("list", button.dataset.mediaView === "list");
  });
});

document.querySelector("[data-media-sort]")?.addEventListener("change", applyMediaFilters);

document.querySelector("[data-am-add-folder]")?.addEventListener("click", () => {
  const name = prompt("New folder name:");
  if (!name?.trim()) return;
  const manager = editor.state.assetManager;
  if (!manager.folders.includes(name.trim())) {
    manager.folders.push(name.trim());
    renderAssetControls();
    showToast(`Folder "${name.trim()}" created`);
  }
});

document.addEventListener("dragend", clearDragState);
document.addEventListener("drop", (event) => {
  if (!event.target.closest("[data-track-lane], .media-dropzone, .video-frame, [data-timeline-empty-state]")) clearDragState();
});

(function initPreviewDropTarget() {
  const vf = document.querySelector(".video-frame");
  if (!vf) return;
  const ewDropzone = vf.querySelector(".ew-dropzone");
  vf.addEventListener("dragover", (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    vf.classList.add("drag-over");
    if (ewDropzone) ewDropzone.classList.add("drag-over");
  });
  vf.addEventListener("dragleave", () => {
    vf.classList.remove("drag-over");
    if (ewDropzone) ewDropzone.classList.remove("drag-over");
  });
  vf.addEventListener("drop", (e) => {
    e.preventDefault();
    vf.classList.remove("drag-over");
    if (ewDropzone) ewDropzone.classList.remove("drag-over");
    if (e.dataTransfer.files.length) {
      simulateUpload(e.dataTransfer.files);
      managedTimeout(() => activateMediaPreview(), 1200);
    }
  });
})();

(function initTimelineEmptyDropTarget() {
  const emptyState = document.querySelector("[data-timeline-empty-state]");
  if (!emptyState) return;
  emptyState.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    emptyState.classList.add("drag-over");
  });
  emptyState.addEventListener("dragleave", () => emptyState.classList.remove("drag-over"));
  emptyState.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    emptyState.classList.remove("drag-over");
    if (e.dataTransfer.files.length) {
      simulateUpload(e.dataTransfer.files);
      managedTimeout(() => activateMediaPreview(), 1200);
    }
  });
})();

let activeAiCategory = "All";

function aiIcon(toolId) {
  const paths = {
    "auto-captions": '<path d="M5 6h14v9H9l-4 3z"/><path d="M8 10h8"/><path d="M8 13h5"/>',
    "remove-silence": '<path d="M5 12h3"/><path d="M16 12h3"/><path d="M10 8v8"/><path d="M14 6v12"/>',
    "auto-cut": '<path d="m6 5 12 14"/><path d="m18 5-5 6"/><path d="m11 13-5 6"/>',
    "scene-detection": '<path d="M4 6h16v12H4z"/><path d="M8 6v12"/><path d="M16 6v12"/>',
    "object-tracking": '<path d="M7 7h10v10H7z"/><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/>',
    "smart-crop": '<path d="M7 3v14h14"/><path d="M3 7h14v14"/><path d="M9 9h6v6H9z"/>',
    "auto-reframe": '<path d="M6 5h12v14H6z"/><path d="M9 8h6v8H9z"/>',
    "voice-enhancement": '<path d="M8 11a4 4 0 0 1 8 0v2a4 4 0 0 1-8 0z"/><path d="M12 17v4"/>',
    "eye-contact": '<path d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5z"/><circle cx="12" cy="12" r="2"/>',
    "background-removal": '<path d="M4 18 18 4"/><path d="M7 7h10v10H7z"/>',
    "hook-generator": '<path d="M7 4v16"/><path d="M7 6h9l-2 4 2 4H7"/>',
    "title-generator": '<path d="M5 6h14"/><path d="M12 6v12"/><path d="M8 18h8"/>',
    "description-generator": '<path d="M6 4h12v16H6z"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    "thumbnail-suggestions": '<path d="M4 6h16v12H4z"/><path d="m8 15 3-3 2 2 3-4 4 5"/>',
  };
  return `<svg viewBox="0 0 24 24">${paths[toolId] ?? '<path d="M12 4v16"/><path d="M4 12h16"/>'}</svg>`;
}

function renderAiPanel() {
  const grid = document.querySelector("[data-ai-tool-grid]");
  const categories = document.querySelector("[data-ai-categories]");
  if (!grid || !categories) return;
  const tools = editor.state.aiTools?.length ? editor.state.aiTools : AI_TOOL_REGISTRY;
  const categoryNames = ["All", ...new Set(tools.map((tool) => tool.category))];
  categories.innerHTML = categoryNames.map((category) => `<button class="${category === activeAiCategory ? "active" : ""}" data-ai-category="${category}">${category}</button>`).join("");
  grid.innerHTML = tools
    .filter((tool) => activeAiCategory === "All" || tool.category === activeAiCategory)
    .map((tool) => {
      const status = tool.status.toLowerCase();
      const progress = tool.progress ?? 0;
      return `
        <article class="ai-action-card${status === "processing" ? " is-processing" : ""}" data-ai-tool-id="${tool.id}" data-ai-tool="${tool.name}">
          <i>${aiIcon(tool.id)}</i>
          <div>
            <strong>${tool.name}</strong>
            <p>${tool.description}</p>
            <span class="badge ${status === "done" ? "done" : status === "new" ? "new" : status === "processing" ? "processing" : "ready"}">${tool.status}</span>
            <div class="ai-progress${status === "processing" ? " active" : ""}"><span style="--progress: ${progress}%"></span></div>
          </div>
          <button class="settings" data-ai-settings-for="${tool.id}">Settings</button>
          <button data-ai-run="${tool.id}" ${status === "processing" ? "disabled" : ""}>Run</button>
        </article>
      `;
    }).join("");
  renderAiQueue();
}

function renderAiQueue() {
  const panel = document.querySelector("[data-ai-queue]");
  if (!panel) return;
  const queue = editor.state.aiQueue ?? [];
  panel.innerHTML = `<div class="ai-queue-head"><strong>Local Run Queue</strong><button data-ai-clear-queue>Clear</button></div>${queue.length ? queue.map((item) => `<article><strong>${escapeHtml(item.name)}</strong><span>${item.status} · ${new Date(item.at).toLocaleTimeString()}</span><p>${escapeHtml(item.result?.summary ?? "")}</p></article>`).join("") : '<p class="ai-empty">No local AI runs yet.</p>'}`;
}

function renderAiSettings(toolId) {
  const panel = document.querySelector("[data-ai-settings]");
  const tool = editor.state.aiTools.find((item) => item.id === toolId);
  if (!panel || !tool) return;
  panel.hidden = false;
  panel.innerHTML = `<div class="ai-settings-head"><strong>${escapeHtml(tool.name)} Settings</strong><button data-ai-close-settings>Close</button></div>${Object.entries(tool.settings ?? {}).map(([key, value]) => `<label>${escapeHtml(key)}<input data-ai-setting="${escapeHtml(key)}" data-ai-setting-tool="${escapeHtml(tool.id)}" value="${escapeHtml(value)}" /></label>`).join("")}<p>${escapeHtml(tool.result?.summary ?? "Local settings only. No APIs are connected.")}</p>`;
}

document.querySelectorAll("[data-track-lane]").forEach((lane) => {
  lane.addEventListener("dragover", (event) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = readDragPayload(event)?.type === "clip" ? "move" : "copy";
    updateDropIndicator(event, lane);
    autoScrollTimeline(event);
  });
  lane.addEventListener("dragleave", () => {
    lane.classList.remove("drop-ready", "drop-target", "drop-invalid");
    setSnapGuide(0, false);
  });
  lane.addEventListener("drop", (event) => {
    event.stopPropagation();
    event.preventDefault();
    const payload = readDragPayload(event);
    lane.classList.remove("drop-ready", "drop-target", "drop-invalid");
    if (event.dataTransfer.files?.length) {
      [...event.dataTransfer.files].forEach((file) => {
        const type = file.type.startsWith("audio") ? "Audio" : file.type.startsWith("image") ? "Image" : "Video";
        const payload = {
          name: file.name.replace(/\.[^.]+$/, ""),
          mediaType: type,
          type: mediaTypeToClipType(type),
          duration: type === "Image" ? 5 : 30,
          originalDuration: type === "Image" ? 5 : 30,
          sourceStart: 0,
          sourceEnd: type === "Image" ? 5 : 30,
        };
        createTimelineClipFromPayload(payload, lane, event);
      });
      renderTimelineFromState();
      showToast("Local file placed on timeline");
      clearDragState();
      return;
    }
    const applied = applyGlobalDrop(payload, lane, event);
    renderTimelineFromState();
    renderTransitionPanel();
    renderEffectsPanel();
    showToast(applied ? `${payload?.label ?? "Item"} placed on timeline` : "Drop blocked");
    clearDragState();
  });
});

timelineEditor?.addEventListener("dragover", (event) => {
  const lane = event.target.closest("[data-track-lane]");
  if (!lane) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = readDragPayload(event)?.type === "clip" ? "move" : "copy";
  updateDropIndicator(event, lane);
  autoScrollTimeline(event);
});

timelineEditor?.addEventListener("drop", (event) => {
  const lane = event.target.closest("[data-track-lane]");
  if (!lane) return;
  event.preventDefault();
  const payload = readDragPayload(event);
  const applied = applyGlobalDrop(payload, lane, event);
  renderTimelineFromState();
  renderTransitionPanel();
  renderEffectsPanel();
  showToast(applied ? `${payload?.label ?? "Item"} placed on timeline` : "Drop blocked");
  clearDragState();
});

document.querySelector("[data-ai-categories]")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-ai-category]");
  if (!button) return;
  activeAiCategory = button.dataset.aiCategory;
  renderAiPanel();
});

document.querySelector("[data-ai-tool-grid]")?.addEventListener("click", (event) => {
  const settings = event.target.closest("[data-ai-settings-for]");
  const run = event.target.closest("[data-ai-run]");
  if (settings) {
    renderAiSettings(settings.dataset.aiSettingsFor);
    return;
  }
  if (!run) return;
  const toolId = run.dataset.aiRun;
  const tool = editor.state.aiTools.find((item) => item.id === toolId);
  if (!tool) return;
  let value = 0;
  clearManagedInterval(aiToolTimers.get(toolId));
  aiToolTimers.delete(toolId);
  editor.setAiToolProcessing(toolId, 0);
  renderAiPanel();
  const timer = managedInterval(() => {
    value = Math.min(100, value + 10 + Math.round(Math.random() * 16));
    editor.setAiToolProcessing(toolId, value);
    renderAiPanel();
    if (value >= 100) {
      clearManagedInterval(timer);
      aiToolTimers.delete(toolId);
      editor.runAiTool(toolId, document.querySelector("[data-ai-command]")?.value ?? "");
      renderAiPanel();
      document.querySelector("[data-preview-status]").textContent = `${tool.name} ready`;
      showToast(`${tool.name} completed locally`);
    }
  }, 180);
  aiToolTimers.set(toolId, timer);
  showToast(`${tool.name} running locally`);
});

document.querySelector("[data-ai-settings]")?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-ai-setting]");
  if (!input) return;
  editor.updateAiTool(input.dataset.aiSettingTool, { settings: { [input.dataset.aiSetting]: input.value } });
});

document.querySelector("[data-ai-settings]")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-ai-close-settings]")) event.currentTarget.hidden = true;
});

document.querySelector("[data-ai-apply-command]")?.addEventListener("click", () => {
  editor.setAiCommand(document.querySelector("[data-ai-command]").value);
  showToast("Local AI instruction saved");
});

document.querySelector("[data-ai-queue-toggle]")?.addEventListener("click", () => {
  const queue = document.querySelector("[data-ai-queue]");
  queue.hidden = !queue.hidden;
  renderAiQueue();
});

document.querySelector("[data-ai-queue]")?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-ai-clear-queue]")) return;
  editor.clearAiQueue();
  renderAiQueue();
});

document.querySelector("[data-open-project-manager]")?.addEventListener("click", () => {
  document.querySelector("[data-project-modal]").hidden = false;
  renderProjectManager();
});

document.querySelector("[data-close-project]")?.addEventListener("click", () => {
  document.querySelector("[data-project-modal]").hidden = true;
});

document.querySelector("[data-project-name]")?.addEventListener("change", (event) => {
  const project = currentProject();
  if (!project) return;
  project.name = event.target.value.trim() || "Untitled Campaign";
  project.thumbnail = createProjectThumbnailFromDom(project.name);
  project.updatedAt = new Date().toISOString();
  editor.setProjectMetadata({ name: project.name, thumbnail: project.thumbnail });
  persistProjectLibrary();
  syncProjectHeader();
  renderProjectManager();
  showToast("Project renamed");
});

document.querySelectorAll("[data-project-setting]").forEach((control) => {
  control.addEventListener("change", () => {
    const project = currentProject();
    if (!project) return;
    if (control.dataset.projectSetting === "fps") project.settings.fps = Number(control.value);
    if (control.dataset.projectSetting === "colorSpace") project.settings.colorSpace = control.value;
    if (control.dataset.projectSetting === "resolution") {
      const [width, height] = control.value.split("x").map(Number);
      project.settings.width = width;
      project.settings.height = height;
    }
    project.updatedAt = new Date().toISOString();
    editor.setProjectMetadata({ settings: project.settings });
    persistProjectLibrary();
    renderProjectManager();
    showToast("Project settings updated");
  });
});

document.querySelector("[data-project-grid]")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-card-action]");
  const folderButton = event.target.closest("[data-folder-card-action]");
  const folderCard = event.target.closest("[data-project-folder-id]");
  if (folderButton && folderCard) {
    const folder = projectFolders.find((item) => item.id === folderCard.dataset.projectFolderId);
    if (!folder) return;
    const action = folderButton.dataset.folderCardAction;
    if (action === "open") activeProjectFolderId = folder.id;
    if (action === "rename") return startInlineProjectRename(folderCard, folder, "folder");
    if (action === "delete") {
      folder.deletedAt = new Date().toISOString();
      projectLibrary.forEach((project) => { if (project.folderId === folder.id) project.folderId = "root"; });
      activeProjectFolderId = "root";
      showToast("Folder moved to recycle");
    }
    persistProjectLibrary();
    renderProjectManager();
    return;
  }
  const card = event.target.closest("[data-project-id]");
  if (!button || !card) return;
  const project = projectLibrary.find((item) => item.id === card.dataset.projectId);
  if (!project) return;
  const action = button.dataset.projectCardAction;
  if (action === "open") openProject(project.id);
  if (action === "favorite") {
    project.favorite = !project.favorite;
    project.updatedAt = new Date().toISOString();
    persistProjectLibrary();
    renderProjectManager();
    showToast(project.favorite ? "Project added to favorites" : "Project removed from favorites");
  }
  if (action === "rename") {
    return startInlineProjectRename(card, project, "project");
  }
  if (action === "duplicate") {
    const duplicate = duplicateProjectRecord(project);
    duplicate.folderId = project.folderId ?? activeProjectFolderId;
    duplicate.favorite = false;
    duplicate.versions = [];
    projectLibrary.unshift(duplicate);
    persistProjectLibrary();
    renderProjectManager();
    showToast("Project duplicated");
  }
  if (action === "delete") {
    project.deletedAt = new Date().toISOString();
    if (project.id === activeProjectId) {
      const next = projectLibrary.find((item) => !item.deletedAt);
      if (next) openProject(next.id);
    }
    persistProjectLibrary();
    renderProjectManager();
    showToast("Project deleted locally");
  }
  if (action === "restore") {
    project.deletedAt = null;
    project.folderId = project.folderId ?? "root";
    project.updatedAt = new Date().toISOString();
    persistProjectLibrary();
    renderProjectManager();
    showToast("Project restored");
  }
});

document.querySelector("[data-project-action=\"create\"]")?.addEventListener("click", () => {
  const project = createProjectRecord({ name: "Untitled Campaign", state: editor.serialize() });
  project.folderId = activeProjectFolderId;
  project.favorite = false;
  project.versions = [];
  projectLibrary.unshift(project);
  activeProjectId = project.id;
  editor.setProjectMetadata({ id: project.id, name: project.name, settings: project.settings, thumbnail: project.thumbnail });
  persistProjectLibrary();
  syncProjectHeader();
  renderProjectManager();
  showToast("Project created");
});

document.querySelector("[data-project-folder-action=\"create\"]")?.addEventListener("click", () => {
  const now = new Date().toISOString();
  const count = projectFolders.filter((folder) => folder.parentId === activeProjectFolderId).length + 1;
  projectFolders.push({ id: `folder-${Date.now()}`, name: `New Folder ${count}`, parentId: activeProjectFolderId, expanded: true, favorite: false, createdAt: now, deletedAt: null });
  persistProjectLibrary();
  renderProjectManager();
  showToast("Folder created");
});

let _projectSearchTimer = null;
document.querySelector("[data-project-search]")?.addEventListener("input", (event) => {
  projectSearchQuery = event.target.value.trim().toLowerCase();
  clearManagedTimeout(_projectSearchTimer);
  _projectSearchTimer = managedTimeout(renderProjectManager, 200);
});

document.querySelector("[data-project-sort]")?.addEventListener("change", (event) => {
  projectSortMode = event.target.value;
  renderProjectManager();
});

document.querySelectorAll("[data-project-view]").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveWithin("[data-project-view]", button);
    projectViewMode = button.dataset.projectView;
    renderProjectManager();
  });
});

document.querySelector("[data-project-folder-tree]")?.addEventListener("click", (event) => {
  const folder = event.target.closest("[data-project-folder]");
  if (!folder) return;
  activeProjectFolderId = folder.dataset.projectFolder;
  projectViewMode = "all";
  setActiveWithin("[data-project-view]", document.querySelector("[data-project-view=\"all\"]"));
  renderProjectManager();
});

document.querySelector("[data-project-breadcrumbs]")?.addEventListener("click", (event) => {
  const crumb = event.target.closest("[data-project-breadcrumb]");
  if (!crumb) return;
  activeProjectFolderId = crumb.dataset.projectBreadcrumb;
  renderProjectManager();
});

document.querySelector("[data-project-grid]")?.addEventListener("dragstart", (event) => {
  const projectCard = event.target.closest("[data-project-id]");
  const folderCard = event.target.closest("[data-project-folder-id]");
  if (projectCard) event.dataTransfer.setData("application/x-launchly-project", projectCard.dataset.projectId);
  if (folderCard) event.dataTransfer.setData("application/x-launchly-folder", folderCard.dataset.projectFolderId);
});

function moveProjectToFolder(projectId, folderId) {
  const project = projectLibrary.find((item) => item.id === projectId);
  if (!project || project.deletedAt) return;
  project.folderId = folderId;
  project.updatedAt = new Date().toISOString();
  persistProjectLibrary();
  renderProjectManager();
  showToast(`Moved to ${folderName(folderId)}`);
}

document.querySelector("[data-project-folder-tree]")?.addEventListener("dragover", (event) => {
  if (event.dataTransfer.types.includes("application/x-launchly-project")) event.preventDefault();
});

document.querySelector("[data-project-folder-tree]")?.addEventListener("drop", (event) => {
  const folderButton = event.target.closest("[data-project-folder]");
  const projectId = event.dataTransfer.getData("application/x-launchly-project");
  if (!folderButton || !projectId) return;
  event.preventDefault();
  moveProjectToFolder(projectId, folderButton.dataset.projectFolder);
});

document.querySelector("[data-project-grid]")?.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-project-folder-id]") && event.dataTransfer.types.includes("application/x-launchly-project")) event.preventDefault();
});

document.querySelector("[data-project-grid]")?.addEventListener("drop", (event) => {
  const folderCard = event.target.closest("[data-project-folder-id]");
  const projectId = event.dataTransfer.getData("application/x-launchly-project");
  if (!folderCard || !projectId) return;
  event.preventDefault();
  moveProjectToFolder(projectId, folderCard.dataset.projectFolderId);
});

document.querySelector("[data-recent-projects]")?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-project-id]");
  if (item) openProject(item.dataset.projectId);
});

document.querySelector("[data-project-recycle]")?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-project-id]");
  const restore = event.target.closest("[data-project-card-action=\"restore\"]");
  if (!item || !restore) return;
  const project = projectLibrary.find((entry) => entry.id === item.dataset.projectId);
  if (!project) return;
  project.deletedAt = null;
  project.folderId = project.folderId ?? "root";
  project.updatedAt = new Date().toISOString();
  persistProjectLibrary();
  renderProjectManager();
  showToast("Project restored");
});

document.querySelector("[data-project-action=\"manual-save\"]")?.addEventListener("click", () => manualSaveProject());
document.querySelector("[data-project-action=\"save-as\"]")?.addEventListener("click", () => manualSaveProject({ saveAs: true }));

document.querySelector("[data-version-action=\"manual\"]")?.addEventListener("click", () => {
  const input = document.querySelector("[data-version-comment]");
  const version = createProjectVersion({ type: "manual", comment: input?.value ?? "" });
  if (input) input.value = "";
  renderProjectManager();
  showToast(version ? "Manual checkpoint created" : "Checkpoint skipped");
});

document.querySelector("[data-version-history]")?.addEventListener("click", (event) => {
  const restore = event.target.closest("[data-version-restore]");
  if (!restore) return;
  restoreProjectVersion(restore.dataset.versionRestore);
});

document.querySelector("[data-project-action=\"export\"]")?.addEventListener("click", () => {
  const project = currentProject();
  if (!project) return;
  project.state = editor.serialize();
  const blob = new Blob([serializeProjectPackage(project)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: `${project.name.replace(/\s+/g, "_")}.launchly.json` });
  link.click();
  URL.revokeObjectURL(url);
  showToast("Project exported locally");
});

document.querySelector("[data-project-import]")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = parseProjectPackage(await file.text());
    const existingIds = new Set(projectLibrary.map((p) => p.id));
    if (existingIds.has(imported.id)) {
      imported.id = `project-${Date.now()}-${Math.round(Math.random() * 1000)}`;
      if (imported.state?.clips) imported.state.clips.forEach((clip) => { clip.id = `clip-${Date.now()}-${Math.round(Math.random() * 10000)}`; });
    }
    imported.folderId = activeProjectFolderId;
    imported.favorite = false;
    imported.versions = Array.isArray(imported.versions) ? imported.versions : [];
    projectLibrary.unshift(imported);
    activeProjectId = imported.id;
    persistProjectLibrary();
    openProject(imported.id);
    showToast("Project imported");
  } catch (error) {
    reportUiError(error, { source: "import", severity: "error", userMessage: "Project import failed safely." });
  } finally {
    event.target.value = "";
  }
});

document.querySelector("[data-recovery-list]")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-recovery-restore]");
  if (!button) return;
  const recovery = recoverySnapshots.find((item) => item.id === button.dataset.recoveryRestore);
  if (!recovery) return;
  const project = projectLibrary.find((item) => item.id === recovery.projectId) ?? createProjectRecord({ name: "Recovered Project" });
  if (!projectLibrary.includes(project)) projectLibrary.unshift(project);
  project.state = recovery.state;
  project.updatedAt = new Date().toISOString();
  activeProjectId = project.id;
  persistProjectLibrary();
  openProject(project.id);
  showToast("Recovery snapshot restored");
});

function openExportModal() {
  document.querySelector("[data-export-modal]").hidden = false;
  updateExportEstimate();
}

function selectedExportResolution() {
  return Number(document.querySelector("[data-export-resolution] .active")?.dataset.resolution || 1080);
}

function exportSettings() {
  return {
    format: document.querySelector("[data-export-format]")?.value || "MP4",
    resolution: selectedExportResolution(),
    fps: Number(document.querySelector("[data-export-fps]")?.value || 30),
    codec: document.querySelector("[data-export-codec]")?.value || "H.264",
    bitrate: Number(document.querySelector("[data-export-bitrate]")?.value || 18),
    duration: editor.state.duration,
  };
}

function resolutionLabel(resolution) {
  return resolution === 2160 ? "4K" : `${resolution}p`;
}

function supportedCodecsForFormat(format) {
  return { MP4: ["H.264", "HEVC", "AV1"], MOV: ["H.264", "HEVC", "ProRes"], WEBM: ["VP9", "AV1"] }[format] ?? ["H.264"];
}

function syncExportCodecOptions() {
  const format = document.querySelector("[data-export-format]")?.value || "MP4";
  const codec = document.querySelector("[data-export-codec]");
  if (!codec) return;
  const supported = supportedCodecsForFormat(format);
  [...codec.options].forEach((option) => { option.disabled = !supported.includes(option.value); });
  if (!supported.includes(codec.value)) codec.value = supported[0];
}

function exportValidationMessage(settings) {
  const estimate = editor.estimateExport(settings);
  return estimate.validation.errors[0] ?? "";
}

function updateExportEstimate() {
  syncExportCodecOptions();
  const settings = exportSettings();
  const estimate = editor.estimateExport(settings);
  const size = estimate.sizeEstimateMb;
  const error = document.querySelector("[data-export-error]");
  document.querySelector("[data-export-bitrate-value]").textContent = `${settings.bitrate} Mbps`;
  document.querySelector("[data-export-format-label]").textContent = `${estimate.settings.format} · ${estimate.settings.codec}`;
  document.querySelector("[data-file-size-estimate]").textContent = `${size} MB`;
  document.querySelector("[data-export-duration]").textContent = formatClock(settings.duration).slice(3);
  const message = exportValidationMessage(settings);
  error.hidden = !message;
  error.textContent = message;
}

function renderExportPanels() {
  const queue = document.querySelector("[data-export-queue]");
  const recent = document.querySelector("[data-recent-exports]");
  const history = document.querySelector("[data-render-history]");
  if (!queue || !recent || !history) return;
  queue.innerHTML = editor.state.exportQueue?.length
    ? editor.state.exportQueue.map((job) => `<article class="${escapeHtml(["rendering", "queued"].includes(job.status) ? "active" : job.status)}" data-export-job-id="${escapeHtml(job.id)}"><strong>${escapeHtml(job.name)}</strong><span>${escapeHtml(resolutionLabel(job.settings.resolution))} · ${escapeHtml(job.settings.format)} · ${escapeHtml(job.settings.codec)} · ${job.sizeEstimateMb} MB · ${escapeHtml(job.status)}${job.progress ? ` · ${job.progress}%` : ""}${job.error ? ` · ${escapeHtml(job.error)}` : ""}</span></article>`).join("")
    : '<div class="export-empty">No queued exports.</div>';
  recent.innerHTML = editor.state.recentExports?.length
    ? editor.state.recentExports.map((job) => `<article><strong>${escapeHtml(job.name)}</strong><span>${new Date(job.updatedAt).toLocaleTimeString()} · ${job.sizeEstimateMb} MB · Completed</span></article>`).join("")
    : '<div class="export-empty">No recent exports yet.</div>';
  history.innerHTML = editor.state.renderHistory?.length
    ? editor.state.renderHistory.map((item) => `<article class="${escapeHtml(item.status)}"><strong>${escapeHtml(item.name)}</strong><span>${new Date(item.at).toLocaleTimeString()} · ${escapeHtml(item.status)}${item.error ? ` · ${escapeHtml(item.error)}` : ""}</span></article>`).join("")
    : '<div class="export-empty">No render history yet.</div>';
  updateExportQueueCount();
}

function updateExportQueueCount() {
  const count = editor.state.exportQueue?.length ?? 0;
  document.querySelector("[data-export-queue-count]").textContent = `${count} job${count === 1 ? "" : "s"}`;
  document.querySelector("[data-render-history-count]").textContent = `${editor.state.renderHistory?.length ?? 0} event${(editor.state.renderHistory?.length ?? 0) === 1 ? "" : "s"}`;
}

function queueExportJob() {
  const settings = exportSettings();
  const job = editor.queueExport(settings, "Untitled Campaign");
  renderExportPanels();
  if (job.status === "error") {
    document.querySelector("[data-export-current-name]").textContent = "Export error";
    document.querySelector("[data-export-current-status]").textContent = job.error;
    editor.logError(job.error || "Export settings failed validation", { source: "render", severity: "error", userMessage: "Export could not start with the current settings.", details: { jobId: job.id } });
    showToast(job.error, { type: "error", title: "Export Error" });
    return;
  }
  runExportJob(job.id);
}

function runExportJob(jobId) {
  const progressBar = document.querySelector("[data-export-progress]");
  const name = document.querySelector("[data-export-current-name]");
  const status = document.querySelector("[data-export-current-status]");
  const cancel = document.querySelector("[data-cancel-export]");
  let job = editor.state.exportQueue.find((item) => item.id === jobId);
  if (!job) return;
  activeExportJob = jobId;
  const exportNotificationId = notify({ id: `export-${jobId}`, title: "Export Queued", message: "Preparing local render queue", type: "progress", progress: 0, duration: Infinity });
  cancel.disabled = false;
  name.textContent = job.name;
  status.textContent = "Rendering locally · preparing frames";
  let progress = job.progress ?? 0;
  clearManagedInterval(exportJobTimer);
  exportJobTimer = managedInterval(() => {
    progress = Math.min(100, progress + 4 + Math.round(Math.random() * 9));
    if (progress > 55 && job.settings.bitrate > 220) {
      clearManagedInterval(exportJobTimer);
      exportJobTimer = null;
      editor.failExport(jobId, "Bitrate exceeds local render preview budget");
      activeExportJob = null;
      cancel.disabled = true;
      progressBar.style.setProperty("--progress", "0%");
      name.textContent = "Export failed";
      status.textContent = "Bitrate exceeds local render preview budget";
      renderExportPanels();
      notify({ id: exportNotificationId, title: "Export Failed", message: "Bitrate exceeds local render preview budget", type: "error", duration: 5200 });
      return;
    }
    editor.updateExportProgress(jobId, progress, "rendering");
    progressBar.style.setProperty("--progress", `${progress}%`);
    status.textContent = progress < 42 ? "Rendering locally - compositing preview" : progress < 82 ? "Encoding local preview file" : "Finalizing package";
    notify({ id: exportNotificationId, title: "Export Progress", message: status.textContent, type: "progress", progress, duration: Infinity });
    renderExportPanels();
    if (progress >= 100) {
      clearManagedInterval(exportJobTimer);
      exportJobTimer = null;
      activeExportJob = null;
      cancel.disabled = true;
      status.textContent = "Completed locally";
      editor.completeExport(jobId);
      renderExportPanels();
      notify({ id: exportNotificationId, title: "Export Complete", message: "Export completed locally", type: "success", progress: 100, duration: 4200 });
    }
  }, 240);
  showToast("Export queued locally", { type: "progress", title: "Queue Update", progress: 0 });
}

document.querySelectorAll("[data-open-export]").forEach((button) => {
  button.addEventListener("click", (event) => {
    if (button.classList.contains("export-button") && !event.ctrlKey && !event.metaKey) {
      exportDropdown.hidden = !exportDropdown.hidden;
      return;
    }
    openExportModal();
  });
});
document.querySelector("[data-export-modal-open]")?.addEventListener("click", () => {
  exportDropdown.hidden = true;
  openExportModal();
});
document.querySelector("[data-close-export]")?.addEventListener("click", () => {
  document.querySelector("[data-export-modal]").hidden = true;
});
document.querySelectorAll(".export-options button").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveWithin("[data-export-resolution] button", button);
    updateExportEstimate();
  });
});
document.querySelectorAll("[data-export-format], [data-export-fps], [data-export-codec], [data-export-bitrate]").forEach((control) => {
  control.addEventListener(control.tagName === "SELECT" ? "change" : "input", updateExportEstimate);
});
document.querySelector("[data-queue-export]")?.addEventListener("click", queueExportJob);
document.querySelector("[data-cancel-export]")?.addEventListener("click", () => {
  if (!activeExportJob) return;
  clearManagedInterval(exportJobTimer);
  exportJobTimer = null;
  editor.cancelExport(activeExportJob);
  activeExportJob = null;
  document.querySelector("[data-export-progress]").style.setProperty("--progress", "0%");
  document.querySelector("[data-export-current-name]").textContent = "Export cancelled";
  document.querySelector("[data-export-current-status]").textContent = "No render job running";
  document.querySelector("[data-cancel-export]").disabled = true;
  renderExportPanels();
  showToast("Export cancelled");
});

updateTimelineRuler();
renderAiPanel();
renderAssetManager();
renderTemplateLibrary();
renderTimelineFromState();
updateTimecode();
syncProjectHeader();
renderProjectManager();
updateExportEstimate();
renderExportPanels();
if (settings.autoCleanup !== false) {
  storageEngine.cleanup().then((result) => {
    if (result.freedBytes > 0) showToast(`Cleaned up ${formatBytes(result.freedBytes)}`);
  }).catch(() => {});
}
renderStorageMeter();
