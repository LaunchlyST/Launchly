import React from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';

const ACCEPTED_HINT = 'MP4, MOV, PNG, JPG, WAV, MP3';

export type UploadState = 'idle' | 'uploading' | 'error';

interface UploadDropzoneProps {
  isDragOver: boolean;
  state: UploadState;
  error?: string | null;
  onUploadClick: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onRetry?: () => void;
}

/**
 * Empty-library drop target. Sized to fill whatever the media section is
 * given rather than demanding a fixed block of space, so adding the
 * conversation below it does not leave a large dead area here.
 */
export function UploadDropzone({
  isDragOver,
  state,
  error,
  onUploadClick,
  onDrop,
  onDragOver,
  onDragLeave,
  onRetry,
}: UploadDropzoneProps) {
  if (state === 'uploading') {
    return (
      <div className="media-panel__empty is-uploading" aria-busy="true">
        <div className="media-panel__upload-icon">
          <Loader2 size={22} strokeWidth={2} className="media-panel__spinner" />
        </div>
        <p className="media-panel__empty-title">Adding media…</p>
        <p className="media-panel__empty-hint">This only takes a moment</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="media-panel__empty is-error" role="alert">
        <div className="media-panel__upload-icon media-panel__upload-icon--error">
          <AlertCircle size={22} strokeWidth={2} />
        </div>
        <p className="media-panel__empty-title">Upload failed</p>
        <p className="media-panel__empty-hint">{error || 'Those files could not be added.'}</p>
        <button className="media-panel__cta" onClick={onRetry ?? onUploadClick}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
      className={`media-panel__empty ${isDragOver ? 'is-dragover' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onUploadClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onUploadClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Upload media — click or drag files here"
    >
      <div className="media-panel__upload-icon">
        <Upload size={22} strokeWidth={1.9} />
      </div>
      <p className="media-panel__empty-title">Upload media</p>
      <p className="media-panel__empty-hint">Video, images or audio</p>
      <p className="media-panel__empty-formats">{ACCEPTED_HINT}</p>
      <button
        className="media-panel__cta"
        onClick={(e) => {
          e.stopPropagation();
          onUploadClick();
        }}
      >
        <Upload size={13} strokeWidth={2.2} />
        Choose files
      </button>
      <span className="media-panel__drop-hint">or drag &amp; drop here</span>
    </div>
  );
}
