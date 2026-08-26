import React, { useRef } from 'react';
import { Clip } from '../../types';
import { MediaItem } from './MediaItem';
import { FloatingComposer } from '../ai/FloatingComposer';
import { UploadIcon, PlusIcon } from '../common/Icon';

interface MediaPanelProps {
  clips: Clip[];
  onUpload: (files: FileList | null) => void;
  onDragStart: (e: React.DragEvent, clip: Clip) => void;
  onDelete?: (clip: Clip) => void;
  onSelectMedia?: (clip: Clip) => void;
  selectedClipIds?: string[];
  // AI props
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  aiModel: string;
  onAiModelChange: (v: string) => void;
  onAiSend: () => void;
}

export function MediaPanel({
  clips,
  onUpload,
  onDragStart,
  onDelete,
  onSelectMedia,
  selectedClipIds,
  aiPrompt,
  onAiPromptChange,
  aiModel,
  onAiModelChange,
  onAiSend,
}: MediaPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpload(e.target.files);
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const hasMedia = clips.length > 0;

  return (
    <div className="media-panel">
      <div className="media-panel__top">
        <div className="media-panel__header">
          <h2 className="media-panel__title">Media</h2>
          {hasMedia && (
            <button className="media-panel__upload-btn" onClick={handleUploadClick} aria-label="Upload more media">
              <PlusIcon size={12} />
              Upload
            </button>
          )}
        </div>

        {!hasMedia ? (
          <div className="media-panel__empty" onDrop={handleDrop} onDragOver={handleDragOver}>
            <div className="media-panel__upload-icon">
              <UploadIcon size={28} />
            </div>
            <p className="media-panel__empty-title">Upload Media</p>
            <p className="media-panel__empty-hint">Video, images, and audio</p>
            <button className="media-panel__cta" onClick={handleUploadClick}>
              <UploadIcon size={14} />
              Choose Files
            </button>
            <span className="media-panel__drop-hint">or drag &amp; drop here</span>
          </div>
        ) : (
          <div className="media-panel__list" onDrop={handleDrop} onDragOver={handleDragOver}>
            {clips.map((clip) => (
              <MediaItem
                key={clip.id}
                clip={clip}
                onDragStart={onDragStart}
                onDelete={onDelete}
                onSelect={onSelectMedia}
                isSelected={selectedClipIds?.includes(clip.id)}
              />
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*,audio/*"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>

      <div className="media-panel__ai">
        <FloatingComposer
          value={aiPrompt}
          onChange={onAiPromptChange}
          model={aiModel}
          onModelChange={onAiModelChange}
          onSend={onAiSend}
        />
      </div>
    </div>
  );
}
