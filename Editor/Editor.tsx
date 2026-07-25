import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ToolRail } from './components/ToolRail';
import { ToolPanel } from './components/ToolPanel';
import { CenterStage } from './components/CenterStage';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { TopBar } from './components/TopBar';
import { ExportModal } from './components/ExportModal';
import { ProjectManager } from './components/ProjectManager';
import { SettingsPanel } from './components/SettingsPanel';
import { GlobalSearch } from './components/GlobalSearch';
import { AICommandBar } from './components/AICommandBar';
import { MediaPreview } from './components/MediaPreview';
import { ContextMenu } from './components/ContextMenu';
import { ToastContainer } from './components/Toast';
import { useEditorStore } from './store/editorStore';
import { useShortcut, useClickOutside } from './hooks';
import './Editor.css';

const TOOLS = [
  { id: 'media', label: 'Media', icon: 'M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z', icon2: 'm9 9 5 3-5 3V9Z' },
  { id: 'text', label: 'Text', icon: 'M5 6h14', icon2: 'M12 6v12', icon3: 'M8.5 18h7' },
  { id: 'captions', label: 'Captions', icon: 'M5 6.5h14v9H9l-4 3v-12Z', icon2: 'M8 10h4', icon3: 'M8 13h8' },
  { id: 'audio', label: 'Audio', icon: 'M6 14h3l4 4V6l-4 4H6v4Z', icon2: 'M16 9.5a4 4 0 0 1 0 5', icon3: 'M18.5 7a7 7 0 0 1 0 10' },
  { id: 'brand', label: 'Brand', icon: 'M12 4 19 8v8l-7 4-7-4V8l7-4Z', icon2: 'M9 10.5h6', icon3: 'M9 13.5h4' },
  { id: 'templates', label: 'Templates', icon: 'M5 5h6v6H5V5Z', icon2: 'M13 5h6v6h-6V5Z', icon3: 'M5 13h6v6H5v-6Z', icon4: 'M13 13h6v6h-6v-6Z' },
  { id: 'effects', label: 'Effects', icon: 'M12 3v4', icon2: 'M12 17v4', icon3: 'M3 12h4', icon4: 'M17 12h4', icon5: 'm6.5 6.5 2.8 2.8', icon6: 'm14.7 14.7 2.8 2.8', icon7: 'm17.5 6.5-2.8 2.8', icon8: 'm9.3 14.7-2.8 2.8' },
  { id: 'transitions', label: 'Transitions', icon: 'M4 7h7v10H4V7Z', icon2: 'M13 7h7v10h-7V7Z', icon3: 'm10 12 4-3v6l-4-3Z' },
  { id: 'ai-tools', label: 'AI Tools', icon: 'M12 4 14 9l5 2-5 2-2 5-2-5-5-2 5-2 2-5Z', icon2: 'M18 4v3', icon3: 'M16.5 5.5h3', ai: true },
] as const;

type ToolId = typeof TOOLS[number]['id'];

export function Editor() {
  const {
    activeTool,
    setActiveTool,
    openPanels,
    setOpenPanels,
    exportModalOpen,
    setExportModalOpen,
    projectManagerOpen,
    setProjectManagerOpen,
    settingsOpen,
    setSettingsOpen,
    shortcutsOpen,
    setShortcutsOpen,
    globalSearchOpen,
    setGlobalSearchOpen,
    aiCommandOpen,
    setAiCommandOpen,
    toasts,
    addToast,
    contextMenu,
    setContextMenu,
    timelineHeight,
    setTimelineHeight,
    canvasZoom,
    setCanvasZoom,
    playbackSpeed,
    setPlaybackSpeed,
    previewVolume,
    setPreviewVolume,
    playing,
    setPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    fps,
    setFps,
    projectName,
    setProjectName,
    clips,
    setClips,
    tracks,
    setTracks,
    selectedClipIds,
    setSelectedClipIds,
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,
    snapEnabled,
    setSnapEnabled,
    magneticTimeline,
    setMagneticTimeline,
    waveformsEnabled,
    setWaveformsEnabled,
    thumbnailsEnabled,
    setThumbnailsEnabled,
    safeZonesEnabled,
    setSafeZonesEnabled,
    guidesEnabled,
    setGuidesEnabled,
    gridEnabled,
    setGridEnabled,
    performanceMode,
    setPerformanceMode,
    gpuRendering,
    setGpuRendering,
    backgroundRendering,
    setBackgroundRendering,
    proxyMedia,
    setProxyMedia,
    aiLocalOnly,
    setAiLocalOnly,
    aiSuggestions,
    setAiSuggestions,
    aiPreviewQuality,
    setAiPreviewQuality,
    notifyExports,
    setNotifyExports,
    notifyAutosave,
    setNotifyAutosave,
    notifyWarnings,
    setNotifyWarnings,
    syncPrepared,
    setSyncPrepared,
    syncOfflineMode,
    setSyncOfflineMode,
    syncBackgroundQueue,
    setSyncBackgroundQueue,
    syncConflictStrategy,
    setSyncConflictStrategy,
    syncUploadPolicy,
    setSyncUploadPolicy,
    syncDownloadPolicy,
    setSyncDownloadPolicy,
  } = useEditorStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineDragging, setTimelineDragging] = useState(false);
  const [timelineStartY, setTimelineStartY] = useState(0);

  useEffect(() => {
    const handleResize = (e: MouseEvent) => {
      if (!timelineDragging) return;
      const deltaY = timelineStartY - e.clientY;
      const newHeight = Math.max(150, Math.min(window.innerHeight * 0.7, timelineHeight + deltaY));
      setTimelineHeight(newHeight);
    };
    const handleMouseUp = () => {
      setTimelineDragging(false);
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    if (timelineDragging) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [timelineDragging, timelineStartY, timelineHeight, setTimelineHeight]);

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if (e.target === timelineRef.current || (e.target as HTMLElement).classList.contains('timeline-handle')) {
      setTimelineDragging(true);
      setTimelineStartY(e.clientY);
      e.preventDefault();
    }
  };

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setClips(prevState.clips);
      setTracks(prevState.tracks);
      setSelectedClipIds(prevState.selectedClipIds);
      setCurrentTime(prevState.currentTime);
      setHistoryIndex(historyIndex - 1);
      addToast('Undo', { type: 'info' });
    }
  }, [history, historyIndex, setClips, setTracks, setSelectedClipIds, setCurrentTime, setHistoryIndex, addToast]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setClips(nextState.clips);
      setTracks(nextState.tracks);
      setSelectedClipIds(nextState.selectedClipIds);
      setCurrentTime(nextState.currentTime);
      setHistoryIndex(historyIndex + 1);
      addToast('Redo', { type: 'info' });
    }
  }, [history, historyIndex, setClips, setTracks, setSelectedClipIds, setCurrentTime, setHistoryIndex, addToast]);

  const saveHistory = useCallback((newState: Partial<{ clips: any[]; tracks: any[]; selectedClipIds: string[]; currentTime: number }>) => {
    const state = {
      clips: newState.clips ?? clips,
      tracks: newState.tracks ?? tracks,
      selectedClipIds: newState.selectedClipIds ?? selectedClipIds,
      currentTime: newState.currentTime ?? currentTime,
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [clips, tracks, selectedClipIds, currentTime, history, historyIndex, setHistory, setHistoryIndex]);

  useShortcut(' ', () => setPlaying(!playing));
  useShortcut('ctrl+z', undo);
  useShortcut('ctrl+shift+z', redo);
  useShortcut('ctrl+e', () => setExportModalOpen(true));
  useShortcut('ctrl+k', () => setGlobalSearchOpen(true));
  useShortcut('ctrl+i', () => setAiCommandOpen(true));

  return (
    <div className="editor-shell" onMouseDown={handleTimelineMouseDown}>
      <TopBar
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        playing={playing}
        onPlayToggle={() => setPlaying(!playing)}
        onExport={() => setExportModalOpen(true)}
        onProjectManager={() => setProjectManagerOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
        onGlobalSearch={() => setGlobalSearchOpen(true)}
        onAiCommand={() => setAiCommandOpen(true)}
        exportModalOpen={exportModalOpen}
        projectManagerOpen={projectManagerOpen}
        settingsOpen={settingsOpen}
        shortcutsOpen={shortcutsOpen}
        globalSearchOpen={globalSearchOpen}
        aiCommandOpen={aiCommandOpen}
        setExportModalOpen={setExportModalOpen}
        setProjectManagerOpen={setProjectManagerOpen}
        setSettingsOpen={setSettingsOpen}
        setShortcutsOpen={setShortcutsOpen}
        setGlobalSearchOpen={setGlobalSearchOpen}
        setAiCommandOpen={setAiCommandOpen}
      />

      <div className="workspace">
        <ToolRail
          tools={TOOLS}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          openPanels={openPanels}
          onPanelToggle={setOpenPanels}
        />

        <div className="center-column">
          <CenterStage
            canvasZoom={canvasZoom}
            onCanvasZoomChange={setCanvasZoom}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            previewVolume={previewVolume}
            onPreviewVolumeChange={setPreviewVolume}
            playing={playing}
            onPlayToggle={() => setPlaying(!playing)}
            currentTime={currentTime}
            onCurrentTimeChange={setCurrentTime}
            duration={duration}
            onDurationChange={setDuration}
            fps={fps}
            onFpsChange={setFps}
            safeZonesEnabled={safeZonesEnabled}
            onSafeZonesToggle={setSafeZonesEnabled}
            guidesEnabled={guidesEnabled}
            onGuidesToggle={setGuidesEnabled}
            gridEnabled={gridEnabled}
            onGridToggle={setGridEnabled}
            clips={clips}
            tracks={tracks}
            selectedClipIds={selectedClipIds}
            onClipsChange={(c) => { setClips(c); saveHistory({ clips: c }); }}
            onTracksChange={(t) => { setTracks(t); saveHistory({ tracks: t }); }}
            onSelectionChange={(ids) => { setSelectedClipIds(ids); saveHistory({ selectedClipIds: ids }); }}
            onTimeChange={(time) => { setCurrentTime(time); saveHistory({ currentTime: time }); }}
          />

          <div
            ref={timelineRef}
            className="timeline-resize-handle"
            onMouseDown={handleTimelineMouseDown}
            role="separator"
            aria-label="Resize timeline"
            aria-orientation="horizontal"
          >
            <div className="timeline-handle" />
          </div>

          <Timeline
            height={timelineHeight}
            clips={clips}
            tracks={tracks}
            selectedClipIds={selectedClipIds}
            currentTime={currentTime}
            duration={duration}
            fps={fps}
            playing={playing}
            snapEnabled={snapEnabled}
            magneticTimeline={magneticTimeline}
            waveformsEnabled={waveformsEnabled}
            thumbnailsEnabled={thumbnailsEnabled}
            onClipsChange={(c) => { setClips(c); saveHistory({ clips: c }); }}
            onTracksChange={(t) => { setTracks(t); saveHistory({ tracks: t }); }}
            onSelectionChange={(ids) => { setSelectedClipIds(ids); saveHistory({ selectedClipIds: ids }); }}
            onTimeChange={(time) => { setCurrentTime(time); saveHistory({ currentTime: time }); }}
            onPlayToggle={() => setPlaying(!playing)}
            onZoomChange={(zoom) => {}}
          />
        </div>

        <Inspector
          clips={clips}
          tracks={tracks}
          selectedClipIds={selectedClipIds}
          onClipsChange={(c) => { setClips(c); saveHistory({ clips: c }); }}
          onTracksChange={(t) => { setTracks(t); saveHistory({ tracks: t }); }}
          onSelectionChange={(ids) => { setSelectedClipIds(ids); saveHistory({ selectedClipIds: ids }); }}
          canvasZoom={canvasZoom}
          onCanvasZoomChange={setCanvasZoom}
        />
      </div>

      <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <ProjectManager open={projectManagerOpen} onClose={() => setProjectManagerOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <GlobalSearch open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
      <AICommandBar open={aiCommandOpen} onClose={() => setAiCommandOpen(false)} />
      <MediaPreview />
      <ContextMenu />
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default Editor;