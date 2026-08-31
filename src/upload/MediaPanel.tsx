import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Clip } from '../editor-types/editorTypes';
import { MediaHeader } from './MediaHeader';
import { MediaToolbar, MediaView } from './MediaToolbar';
import { MediaFilters, MediaCategory } from './MediaFilters';
import { MediaLibrary } from './MediaLibrary';
import { UploadDropzone, UploadState } from './UploadDropzone';
import { AIConversation } from '../ai-conversation/AIConversation';
import { PromptComposer } from '../ai-chat/PromptComposer';
import { ConversationMessage, ConversationStatus } from '../ai-conversation/conversation.types';

interface MediaPanelProps {
  clips: Clip[];
  onUpload: (files: FileList | null) => void;
  onDragStart: (e: React.DragEvent, clip: Clip) => void;
  onDelete?: (clip: Clip) => void;
  onSelectMedia?: (clip: Clip) => void;
  selectedClipIds?: string[];
  /** Add a library item straight to the timeline (used by the hover action). */
  onAddToTimeline?: (clip: Clip) => void;
  /** Rename a library item. */
  onRename?: (clip: Clip, name: string) => void;
  /** Upload lifecycle, owned by the editor so toasts stay in one place. */
  uploadState?: UploadState;
  uploadError?: string | null;

  // AI props
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  aiModel: string;
  onAiModelChange: (v: string) => void;
  onAiSend: (text: string) => void;
  onAiStop: () => void;
  onAiRetry: (id: string) => void;
  onAiClear: () => void;
  messages: ConversationMessage[];
  conversationStatus: ConversationStatus;
  canStop: boolean;
}

/**
 * The left sidebar.
 *
 * Three stacked regions in one flex column: the media library, the AI
 * conversation, and the prompt composer. The library and the conversation
 * each scroll internally and share the leftover height, while the composer
 * is pinned at the bottom — so neither a full library nor a long
 * conversation can push the input out of reach or grow the sidebar.
 */
export function MediaPanel({
  clips,
  onUpload,
  onDragStart,
  onDelete,
  onSelectMedia,
  selectedClipIds,
  onAddToTimeline,
  onRename,
  uploadState = 'idle',
  uploadError,
  aiPrompt,
  onAiPromptChange,
  aiModel,
  onAiModelChange,
  onAiSend,
  onAiStop,
  onAiRetry,
  onAiClear,
  messages,
  conversationStatus,
  canStop,
}: MediaPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<MediaCategory>('all');
  const [view, setView] = useState<MediaView>('list');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpload(e.target.files);
    if (e.target) e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files);
  }, [onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);

  const hasMedia = clips.length > 0;

  const counts = useMemo(() => {
    const c: Record<MediaCategory, number> = { all: clips.length, video: 0, image: 0, audio: 0, generated: 0 };
    for (const clip of clips) {
      if (clip.type === 'video') c.video += 1;
      else if (clip.type === 'image') c.image += 1;
      else if (clip.type === 'audio') c.audio += 1;
      if ((clip as any).generated || (clip as any).aiGenerated) c.generated += 1;
    }
    return c;
  }, [clips]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clips.filter((clip) => {
      if (category === 'generated' && !((clip as any).generated || (clip as any).aiGenerated)) return false;
      if (category !== 'all' && category !== 'generated' && clip.type !== category) return false;
      if (q && !clip.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clips, category, search]);

  const busy = conversationStatus !== 'idle';


  return (
    <div className="media-panel">
      <section className="media-panel__media" aria-label="Media library">
        <div className="media-panel__controls">
          <MediaHeader count={clips.length} />
          <MediaToolbar
            view={view}
            onViewChange={setView}
            search={search}
            onSearchChange={setSearch}
            searchOpen={searchOpen}
            onSearchOpenChange={setSearchOpen}
            onUploadClick={handleUploadClick}
          />
          <MediaFilters category={category} onCategoryChange={setCategory} counts={counts} />
        </div>

        <div className="media-panel__body">
          {!hasMedia || uploadState !== 'idle' ? (
            <UploadDropzone
              isDragOver={isDragOver}
              state={uploadState}
              error={uploadError}
              onUploadClick={handleUploadClick}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            />
          ) : (
            <MediaLibrary
              clips={filtered}
              view={view}
              isDragOver={isDragOver}
              onDragStart={onDragStart}
              onDelete={onDelete}
              onSelect={onSelectMedia}
              onAddToTimeline={onAddToTimeline}
              onRename={onRename}
              selectedClipIds={selectedClipIds}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClearFilters={() => {
                setCategory('all');
                setSearch('');
              }}
            />
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*,audio/*"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </section>

      {/* The conversation is always mounted — see AIConversation. */}
      <AIConversation
        messages={messages}
        status={conversationStatus}
        onRetry={onAiRetry}
        onClear={onAiClear}
      />

      <div className="media-panel__composer">
        <PromptComposer
          value={aiPrompt}
          onChange={onAiPromptChange}
          model={aiModel}
          onModelChange={onAiModelChange}
          onSend={onAiSend}
          onStop={onAiStop}
          onAttach={onUpload}
          busy={busy}
          canStop={canStop}
        />
      </div>
    </div>
  );
}
