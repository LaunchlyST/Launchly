import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Clip {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio' | 'text' | 'caption' | 'generated';
  src?: string;
  trackId: string;
  timelineStart: number;
  start: number;
  duration: number;
  layer: number;
  groupId?: string;
  hidden: boolean;
  locked: boolean;
  solo: boolean;
  opacity: number;
  transform: { scale: number; rotate: number; position: { x: number; y: number } };
  speed: number;
  blendMode: string;
  colorGrade?: Record<string, number>;
  effects?: string[];
  keyframes?: Record<string, any[]>;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  crop: number;
  blur: number;
  shadow: number;
  border: number;
  textContent?: string;
  textStyle?: Record<string, any>;
  thumbnail?: string;
  thumbnails?: string[];
  waveform?: number[];
  width?: number;
  height?: number;
  fps?: number;
  sourceStart?: number;
  sourceDuration?: number;
  hasEmbeddedAudio?: boolean;
  audioDetached?: boolean;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'caption';
  order: number;
  visible: boolean;
  locked: boolean;
  muted: boolean;
  solo: boolean;
  height: number;
  color: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  duration?: number;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  targetId?: string;
  targetType?: string;
}

export interface ContextMenuItem {
  label: string;
  action: () => void;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface EditorState {
  // UI State
  activeTool: string;
  setActiveTool: (tool: string) => void;

  openPanels: Record<string, boolean>;
  setOpenPanels: (panels: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;

  exportModalOpen: boolean;
  setExportModalOpen: (open: boolean) => void;

  projectManagerOpen: boolean;
  setProjectManagerOpen: (open: boolean) => void;

  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;

  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;

  aiCommandOpen: boolean;
  setAiCommandOpen: (open: boolean) => void;

  toasts: Toast[];
  addToast: (message: string, options?: Partial<Toast>) => void;
  removeToast: (id: string) => void;

  contextMenu: ContextMenuState;
  setContextMenu: (menu: Partial<ContextMenuState> | null) => void;

  // Timeline State
  timelineHeight: number;
  setTimelineHeight: (height: number) => void;

  // Canvas State
  canvasZoom: number;
  setCanvasZoom: (zoom: number) => void;

  // Playback State
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;

  previewVolume: number;
  setPreviewVolume: (volume: number) => void;

  playing: boolean;
  setPlaying: (playing: boolean) => void;

  currentTime: number;
  setCurrentTime: (time: number) => void;

  duration: number;
  setDuration: (duration: number) => void;

  fps: number;
  setFps: (fps: number) => void;

  // Project State
  projectName: string;
  setProjectName: (name: string) => void;

  clips: Clip[];
  setClips: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;

  tracks: Track[];
  setTracks: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;

  selectedClipIds: string[];
  setSelectedClipIds: (ids: string[] | ((prev: string[]) => string[])) => void;

  // History
  history: any[];
  setHistory: (history: any[]) => void;
  historyIndex: number;
  setHistoryIndex: (index: number) => void;

  // Timeline Settings
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;

  magneticTimeline: boolean;
  setMagneticTimeline: (enabled: boolean) => void;

  waveformsEnabled: boolean;
  setWaveformsEnabled: (enabled: boolean) => void;

  thumbnailsEnabled: boolean;
  setThumbnailsEnabled: (enabled: boolean) => void;

  safeZonesEnabled: boolean;
  setSafeZonesEnabled: (enabled: boolean) => void;

  guidesEnabled: boolean;
  setGuidesEnabled: (enabled: boolean) => void;

  gridEnabled: boolean;
  setGridEnabled: (enabled: boolean) => void;

  // Performance Settings
  performanceMode: 'adaptive' | 'performance' | 'quality';
  setPerformanceMode: (mode: 'adaptive' | 'performance' | 'quality') => void;

  gpuRendering: boolean;
  setGpuRendering: (enabled: boolean) => void;

  backgroundRendering: boolean;
  setBackgroundRendering: (enabled: boolean) => void;

  proxyMedia: boolean;
  setProxyMedia: (enabled: boolean) => void;

  // AI Settings
  aiLocalOnly: boolean;
  setAiLocalOnly: (enabled: boolean) => void;

  aiSuggestions: boolean;
  setAiSuggestions: (enabled: boolean) => void;

  aiPreviewQuality: 'draft' | 'balanced' | 'quality';
  setAiPreviewQuality: (quality: 'draft' | 'balanced' | 'quality') => void;

  // Notifications
  notifyExports: boolean;
  setNotifyExports: (enabled: boolean) => void;

  notifyAutosave: boolean;
  setNotifyAutosave: (enabled: boolean) => void;

  notifyWarnings: boolean;
  setNotifyWarnings: (enabled: boolean) => void;

  // Sync Settings
  syncPrepared: boolean;
  setSyncPrepared: (enabled: boolean) => void;

  syncOfflineMode: boolean;
  setSyncOfflineMode: (enabled: boolean) => void;

  syncBackgroundQueue: boolean;
  setSyncBackgroundQueue: (enabled: boolean) => void;

  syncConflictStrategy: 'ask' | 'local' | 'remote' | 'duplicate';
  setSyncConflictStrategy: (strategy: 'ask' | 'local' | 'remote' | 'duplicate') => void;

  syncUploadPolicy: 'changes' | 'all' | 'manual';
  setSyncUploadPolicy: (policy: 'changes' | 'all' | 'manual') => void;

  syncDownloadPolicy: 'manual' | 'open' | 'online';
  setSyncDownloadPolicy: (policy: 'manual' | 'open' | 'online') => void;

  // New simplified editor state
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;

  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;

  aiModel: string;
  setAiModel: (model: string) => void;

  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;

  // Media library (source assets) — separate from timeline clips for clean DnD
  mediaAssets: Clip[];
  setMediaAssets: (assets: Clip[] | ((prev: Clip[]) => Clip[])) => void;

  // Timeline zoom — non-linear visible duration
  timelineZoomValue: number; // 0..100, non-linear
  setTimelineZoomValue: (v: number) => void;
  timelineVisibleSeconds: number; // derived from zoom, e.g. 5..3600 (+ extended)
  setTimelineVisibleSeconds: (s: number) => void;
  timelineExtendedUnlocked: boolean;
  setTimelineExtendedUnlocked: (v: boolean) => void;
  /** Mirrors the timeline limit feedback so the preview can ring itself too. */
  timelineFeedback: 'error' | 'ok' | null;
  setTimelineFeedback: (v: 'error' | 'ok' | null) => void;
}

const defaultTracks: Track[] = [];

const defaultClips: Clip[] = [];

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      // UI State
      activeTool: 'media',
      setActiveTool: (tool) => set({ activeTool: tool }),

      openPanels: { media: true },
      setOpenPanels: (panels) => set((state) => ({ openPanels: typeof panels === 'function' ? panels(state.openPanels) : panels })),

      exportModalOpen: false,
      setExportModalOpen: (open) => set({ exportModalOpen: open }),

      projectManagerOpen: false,
      setProjectManagerOpen: (open) => set({ projectManagerOpen: open }),

      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),

      shortcutsOpen: false,
      setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

      globalSearchOpen: false,
      setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),

      aiCommandOpen: false,
      setAiCommandOpen: (open) => set({ aiCommandOpen: open }),

      toasts: [],
      addToast: (message, options = {}) => set((state) => ({
        toasts: [...state.toasts, { id: crypto.randomUUID(), message, type: 'info', duration: 3000, ...options }],
      })),
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      contextMenu: { visible: false, x: 0, y: 0, items: [] },
      setContextMenu: (menu) => set((state) => ({ contextMenu: menu ? { ...state.contextMenu, ...menu } : { visible: false, x: 0, y: 0, items: [] } })),

      // Timeline State
      timelineHeight: 280,
      setTimelineHeight: (height) => set({ timelineHeight: height }),

      // Canvas State
      canvasZoom: 1,
      setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(0.25, Math.min(4, zoom)) }),

      // Playback State
      playbackSpeed: 1,
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

      previewVolume: 0.82,
      setPreviewVolume: (volume) => set({ previewVolume: Math.max(0, Math.min(1, volume)) }),

      playing: false,
      setPlaying: (playing) => set({ playing }),

      currentTime: 0,
      setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),

      duration: 190,
      setDuration: (duration) => set({ duration: Math.max(1, duration) }),

      fps: 30,
      setFps: (fps) => set({ fps: Math.max(1, Math.min(120, fps)) }),

      // Project State
      projectName: 'Untitled Campaign',
      setProjectName: (name) => set({ projectName: name }),

      clips: defaultClips,
      setClips: (clips) => set((state) => {
        const newClips = typeof clips === 'function' ? clips(state.clips) : clips;
        if (newClips === state.clips) return state;
        return { clips: newClips };
      }),

      tracks: defaultTracks,
      setTracks: (tracks) => set((state) => ({ tracks: typeof tracks === 'function' ? tracks(state.tracks) : tracks })),

      selectedClipIds: [],
      setSelectedClipIds: (ids) => set((state) => ({ selectedClipIds: typeof ids === 'function' ? ids(state.selectedClipIds) : ids })),

      // History
      history: [],
      setHistory: (history) => set({ history }),
      historyIndex: -1,
      setHistoryIndex: (index) => set({ historyIndex: index }),

      // Timeline Settings
      snapEnabled: true,
      setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),

      magneticTimeline: true,
      setMagneticTimeline: (enabled) => set({ magneticTimeline: enabled }),

      waveformsEnabled: true,
      setWaveformsEnabled: (enabled) => set({ waveformsEnabled: enabled }),

      thumbnailsEnabled: true,
      setThumbnailsEnabled: (enabled) => set({ thumbnailsEnabled: enabled }),

      safeZonesEnabled: false,
      setSafeZonesEnabled: (enabled) => set({ safeZonesEnabled: enabled }),

      guidesEnabled: false,
      setGuidesEnabled: (enabled) => set({ guidesEnabled: enabled }),

      gridEnabled: false,
      setGridEnabled: (enabled) => set({ gridEnabled: enabled }),

      // Performance Settings
      performanceMode: 'adaptive',
      setPerformanceMode: (mode) => set({ performanceMode: mode }),

      gpuRendering: true,
      setGpuRendering: (enabled) => set({ gpuRendering: enabled }),

      backgroundRendering: true,
      setBackgroundRendering: (enabled) => set({ backgroundRendering: enabled }),

      proxyMedia: true,
      setProxyMedia: (enabled) => set({ proxyMedia: enabled }),

      // AI Settings
      aiLocalOnly: true,
      setAiLocalOnly: (enabled) => set({ aiLocalOnly: enabled }),

      aiSuggestions: true,
      setAiSuggestions: (enabled) => set({ aiSuggestions: enabled }),

      aiPreviewQuality: 'draft',
      setAiPreviewQuality: (quality) => set({ aiPreviewQuality: quality }),

      // Notifications
      notifyExports: true,
      setNotifyExports: (enabled) => set({ notifyExports: enabled }),

      notifyAutosave: false,
      setNotifyAutosave: (enabled) => set({ notifyAutosave: enabled }),

      notifyWarnings: true,
      setNotifyWarnings: (enabled) => set({ notifyWarnings: enabled }),

      // Sync Settings
      syncPrepared: true,
      setSyncPrepared: (enabled) => set({ syncPrepared: enabled }),

      syncOfflineMode: false,
      setSyncOfflineMode: (enabled) => set({ syncOfflineMode: enabled }),

      syncBackgroundQueue: true,
      setSyncBackgroundQueue: (enabled) => set({ syncBackgroundQueue: enabled }),

      syncConflictStrategy: 'ask',
      setSyncConflictStrategy: (strategy) => set({ syncConflictStrategy: strategy }),

      syncUploadPolicy: 'changes',
      setSyncUploadPolicy: (policy) => set({ syncUploadPolicy: policy }),

      syncDownloadPolicy: 'manual',
      setSyncDownloadPolicy: (policy) => set({ syncDownloadPolicy: policy }),

      aspectRatio: 'youtube',
      setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

      isMuted: false,
      setIsMuted: (muted) => set({ isMuted: muted }),

      aiModel: 'chatgpt',
      setAiModel: (model) => set({ aiModel: model }),

      aiPrompt: '',
      setAiPrompt: (prompt) => set({ aiPrompt: prompt }),

      mediaAssets: [],
      setMediaAssets: (assets) => set((state) => ({ mediaAssets: typeof assets === 'function' ? (assets as any)(state.mediaAssets) : assets })),

      timelineZoomValue: 30,
      setTimelineZoomValue: (v) => set({ timelineZoomValue: Math.max(0, Math.min(100, v)) }),
      timelineVisibleSeconds: 30,
      setTimelineVisibleSeconds: (s) => set({ timelineVisibleSeconds: s }),
      timelineExtendedUnlocked: false,
      setTimelineExtendedUnlocked: (v) => set({ timelineExtendedUnlocked: v }),
      timelineFeedback: null,
      setTimelineFeedback: (v) => set({ timelineFeedback: v }),
    }),
    {
      name: 'launchly-editor-state',
      partialize: (state) => ({
        timelineHeight: state.timelineHeight,
        canvasZoom: state.canvasZoom,
        playbackSpeed: state.playbackSpeed,
        previewVolume: state.previewVolume,
        fps: state.fps,
        projectName: state.projectName,
        clips: state.clips,
        tracks: state.tracks,
        snapEnabled: state.snapEnabled,
        magneticTimeline: state.magneticTimeline,
        waveformsEnabled: state.waveformsEnabled,
        thumbnailsEnabled: state.thumbnailsEnabled,
        safeZonesEnabled: state.safeZonesEnabled,
        guidesEnabled: state.guidesEnabled,
        gridEnabled: state.gridEnabled,
        performanceMode: state.performanceMode,
        gpuRendering: state.gpuRendering,
        backgroundRendering: state.backgroundRendering,
        proxyMedia: state.proxyMedia,
        aiLocalOnly: state.aiLocalOnly,
        aiSuggestions: state.aiSuggestions,
        aiPreviewQuality: state.aiPreviewQuality,
        notifyExports: state.notifyExports,
        notifyAutosave: state.notifyAutosave,
        notifyWarnings: state.notifyWarnings,
        syncPrepared: state.syncPrepared,
        syncOfflineMode: state.syncOfflineMode,
        syncBackgroundQueue: state.syncBackgroundQueue,
        syncConflictStrategy: state.syncConflictStrategy,
        syncUploadPolicy: state.syncUploadPolicy,
        syncDownloadPolicy: state.syncDownloadPolicy,
        aspectRatio: (state as any).aspectRatio,
        isMuted: (state as any).isMuted,
        aiModel: (state as any).aiModel,
        aiPrompt: (state as any).aiPrompt,
        mediaAssets: (state as any).mediaAssets,
        timelineZoomValue: (state as any).timelineZoomValue,
        timelineVisibleSeconds: (state as any).timelineVisibleSeconds,
        timelineExtendedUnlocked: (state as any).timelineExtendedUnlocked,
      }),
    }
  )
);