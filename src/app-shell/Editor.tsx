import React, { useCallback, useEffect, useRef } from 'react';
import { EditorLayout } from './EditorLayout';
import { EditorToolbar } from '../video-controls/EditorToolbar';
import { MediaPanel } from '../upload/MediaPanel';
import { VideoPreview } from '../preview/VideoPreview';
import { Timeline } from '../timeline/Timeline';
import { ToastContainer } from '../notifications/Toast';
import { useEditorStore } from '../editor-state/editorStore';
import { importMediaFiles } from '../upload/mediaImport';
import { useShortcut } from '../react-hooks/reactHooks';
import { getAspectRatioById } from '../video-controls/aspectRatios';
import { NotificationProvider } from '../notifications/NotificationProvider';
import { NotificationContainer } from '../notifications/NotificationContainer';
// Feature stylesheets, imported in cascade order — each one lives with its section.
import '../theme/theme.css';
import '../app-shell/app-shell.css';
import '../upload/upload.css';
import '../tool-rail/tool-rail.css';
import '../ai-chat/ai-chat.css';
import '../model-selector/model-selector.css';
import '../preview/preview.css';
import '../video-controls/video-controls.css';
import '../timeline/timeline.css';
import '../top-bar/top-bar.css';
import '../projects/projects.css';
import '../export/export.css';
import '../inspector/inspector.css';
import '../global-search/global-search.css';
import '../notifications/notifications.css';
import '../context-menu/context-menu.css';

export function Editor() {
  const {
    clips,
    setClips,
    tracks,
    setTracks,
    selectedClipIds,
    setSelectedClipIds,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playing,
    setPlaying,
    fps,
    aspectRatio,
    setAspectRatio,
    isMuted,
    setIsMuted,
    aiModel,
    setAiModel,
    aiPrompt,
    setAiPrompt,
    mediaAssets,
    setMediaAssets,
    toasts,
    addToast,
    removeToast,
  } = useEditorStore() as any;

  const timelineClips = clips;
  const libraryAssets = mediaAssets.length > 0 ? mediaAssets : clips; // fallback for migrated state

  // Playback tick
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = (now: number) => {
      if (!lastTickRef.current) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setCurrentTime((prev: number) => {
        const next = prev + delta;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, [playing, duration, setCurrentTime, setPlaying]);

  useEffect(() => {
    if (!playing) lastTickRef.current = 0;
  }, [playing]);

  // Keep duration in sync with clips
  useEffect(() => {
    const maxEnd = clips.reduce((max: number, c: any) => Math.max(max, c.timelineStart + c.duration), 0);
    const nextDuration = Math.max(30, maxEnd + 5);
    if (Math.abs(nextDuration - duration) > 0.5) setDuration(nextDuration);
  }, [clips, duration, setDuration]);

  /**
   * Every file dropped on the timeline gets its own lane, numbered per kind —
   * V1, V2 … A1, A2 … T1. Reusing one lane per type stacked clips on top of
   * each other, and left later files with no header of their own.
   *
   * The exception is the very first empty lane the project starts with: if a
   * lane of that type exists and is still empty, the clip lands there instead
   * of leaving a blank row behind.
   */
  const ensureTrack = useCallback(
    (type: 'video' | 'audio' | 'text', forceNew = false) => {
      const emptyOfType = forceNew
        ? undefined
        : tracks.find((t: any) => t.type === type && !clips.some((c: any) => c.trackId === t.id));
      if (emptyOfType) return emptyOfType.id;

      const count = tracks.filter((t: any) => t.type === type).length;
      const labelMap: Record<string, string> = { video: `V${count + 1}`, audio: `A${count + 1}`, text: `T${count + 1}` };
      const nameMap: Record<string, string> = { video: 'Video', audio: 'Audio', text: 'Text' };
      const colorMap: Record<string, string> = { video: '#70e4ff', audio: '#ffd47a', text: '#b9a4ff' };
      const newTrack: any = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
        name: nameMap[type],
        type,
        order: tracks.length,
        visible: true,
        locked: false,
        muted: false,
        solo: false,
        height: type === 'audio' ? 60 : 56,
        color: colorMap[type],
        label: labelMap[type],
      };
      setTracks((prev: any[]) => [...prev, newTrack]);
      return newTrack.id;
    },
    [tracks, clips, setTracks]
  );

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      // Use dummy track ids for import — library doesn't need real tracks
      const result = await importMediaFiles(files, 'video-1', 'audio-1', clips);

      if (result.clips.length > 0) {
        // Add to media library as source assets (reset timelineStart for library)
        const libraryClips = result.clips.map((c: any) => ({
          ...c,
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${c.id}`,
          timelineStart: 0,
        }));
        setMediaAssets((prev: any[]) => [...prev, ...libraryClips]);
        addToast(`Added ${result.clips.length} media file${result.clips.length > 1 ? 's' : ''}`, { type: 'success' });
      }
    },
    [clips, setMediaAssets, addToast]
  );

  const handleMediaDragStart = useCallback((e: React.DragEvent, clip: any) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-launchly-clip', JSON.stringify(clip));
    // Also set a text fallback
    e.dataTransfer.setData('text/plain', clip.name);
  }, []);

  const handleDeleteMedia = useCallback(
    (clip: any) => {
      // Remove from library
      setMediaAssets((prev: any[]) => prev.filter((c) => c.id !== clip.id));
      // Fallback migrated state: library was clips, so also remove there if needed
      if (mediaAssets.length === 0) {
        setClips((prev: any[]) => prev.filter((c) => c.id !== clip.id));
      }
      // Revoke object URL if present
      if (clip.src && clip.src.startsWith('blob:')) {
        try { URL.revokeObjectURL(clip.src); } catch {}
      }
      addToast(`Deleted ${clip.name}`, { type: 'info' });
    },
    [setMediaAssets, setClips, mediaAssets.length, addToast]
  );

  const handleDropMedia = useCallback(
    (sourceClip: any, dropTime: number, trackId?: string | null) => {
      const trackType = sourceClip.type === 'audio' ? 'audio' : sourceClip.type === 'text' || sourceClip.type === 'caption' ? 'text' : 'video';
      /**
       * A lane was picked by the drop: use it. `null` came from the "+" lane,
       * which always wants a fresh row. Otherwise fall back to the usual rule.
       */
      const targetTrackId =
        trackId === null
          ? ensureTrack(trackType as any, true)
          : trackId ?? ensureTrack(trackType as any);

      const newClip = {
        ...sourceClip,
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        trackId: targetTrackId,
        timelineStart: dropTime,
        start: sourceClip.start ?? 0,
        sourceStart: sourceClip.sourceStart ?? 0,
        sourceDuration: sourceClip.sourceDuration ?? sourceClip.duration,
        hasEmbeddedAudio: sourceClip.hasEmbeddedAudio ?? false,
        audioDetached: false,
      };

      setClips((prev: any[]) => [...prev, newClip]);
      setSelectedClipIds([newClip.id]);
      setCurrentTime(dropTime);
      addToast(`Added ${sourceClip.name} to timeline`, { type: 'success' });
    },
    [ensureTrack, setClips, setSelectedClipIds, setCurrentTime, addToast]
  );

  const handlePreviewDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
        return;
      }
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/x-launchly-clip'));
        if (data?.id) {
          // Drop on preview = add to timeline at currentTime
          handleDropMedia(data, currentTime);
        }
      } catch {}
    },
    [handleUpload, handleDropMedia, currentTime]
  );

  const handleAiSend = useCallback(() => {
    if (!aiPrompt.trim()) {
      addToast('Type an instruction for the AI', { type: 'warning' });
      return;
    }
    const modelLabel = aiModel === 'claude' ? 'Claude' : 'ChatGPT';
    addToast(`[${modelLabel}] ${aiPrompt.slice(0, 60)}${aiPrompt.length > 60 ? '…' : ''}`, { type: 'info', title: 'AI queued' });
    // Keep prompt so user can iterate; clear optionally
    // setAiPrompt('');
  }, [aiPrompt, aiModel, addToast]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
    addToast(isMuted ? 'Audio enabled' : 'Muted', { type: 'info' });
  }, [isMuted, setIsMuted, addToast]);

  useShortcut(' ', () => setPlaying(!playing));
  useShortcut('Delete', () => {
    if (selectedClipIds.length > 0) {
      setClips((prev: any[]) => prev.filter((c) => !selectedClipIds.includes(c.id)));
      setSelectedClipIds([]);
    }
  });

  // Resolve aspect ratio for preview frame styling
  const aspectPreset = getAspectRatioById(aspectRatio);

  return (
    <NotificationProvider>
    <div className="launchly-editor-root">
      <EditorLayout
        leftPanel={
          <MediaPanel
            clips={libraryAssets}
            onUpload={handleUpload}
            onDragStart={handleMediaDragStart}
            onDelete={handleDeleteMedia}
            onSelectMedia={(clip) => {
              // Optional: selecting media shows in preview? Keep timeline selection
            }}
            onAddToTimeline={(clip) => handleDropMedia(clip, currentTime)}
            onRename={(clip, name) => {
              setMediaAssets((prev: any[]) => prev.map((c) => (c.id === clip.id ? { ...c, name } : c)));
              if (mediaAssets.length === 0) {
                setClips((prev: any[]) => prev.map((c) => (c.id === clip.id ? { ...c, name } : c)));
              }
            }}
            selectedClipIds={selectedClipIds}
            aiPrompt={aiPrompt}
            onAiPromptChange={setAiPrompt}
            aiModel={aiModel}
            onAiModelChange={setAiModel}
            onAiSend={handleAiSend}
          />
        }
        preview={
          <VideoPreview
            clips={timelineClips}
            tracks={tracks}
            selectedClipIds={selectedClipIds}
            currentTime={currentTime}
            duration={duration}
            playing={playing}
            onPlayToggle={() => setPlaying(!playing)}
            aspectRatio={aspectRatio}
            isMuted={isMuted}
            onDrop={handlePreviewDrop}
            onClipsChange={setClips}
          />
        }
        toolbar={
          <EditorToolbar
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            isMuted={isMuted}
            onMuteToggle={handleMuteToggle}
          />
        }
        timeline={
          <Timeline
            clips={timelineClips}
            tracks={tracks}
            selectedClipIds={selectedClipIds}
            currentTime={currentTime}
            duration={duration}
            isMuted={isMuted}
            onClipsChange={setClips}
            onTracksChange={setTracks as any}
            onSelectionChange={setSelectedClipIds}
            onTimeChange={setCurrentTime}
            onDropMedia={handleDropMedia}
          />
        }
      />
      <ToastContainer toasts={toasts} />
      <NotificationContainer />
    </div>
    </NotificationProvider>
  );
}

export default Editor;
