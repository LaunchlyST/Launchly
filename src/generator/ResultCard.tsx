import React from 'react';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import { GenerationResult } from '../store';

interface ResultCardProps {
  result: GenerationResult;
  busy: boolean;
  onDownload: () => void;
  onRegenerate: () => void;
}

export function ResultCard({ result, busy, onDownload, onRegenerate }: ResultCardProps) {
  const isImage = result.type === 'image';

  return (
    <div className="result-card">
      <div className="result-title">
        <h3>Result</h3>
        <span className="result-model-badge">
          {result.model === 'chatgpt' ? 'ChatGPT' : 'Grok'} ·{' '}
          {isImage ? 'Image' : 'Video'}
        </span>
      </div>

      <div className="result-media">
        {isImage ? (
          <div className="result-image-wrap">
            <img src={result.url} alt="Generated result" className="result-image" />
          </div>
        ) : (
          <div className="result-video-wrap">
            <video src={result.url} controls playsInline className="result-video" />
          </div>
        )}
      </div>

      <div className="result-actions">
        <button type="button" className="result-btn result-btn--download" onClick={onDownload}>
          <Download size={16} />
          Download
        </button>
        <button
          type="button"
          className="result-btn result-btn--again"
          onClick={onRegenerate}
          disabled={busy}
        >
          {busy ? <span className="spinner spinner--dark" /> : <RefreshCw size={16} />}
          Generate Again
        </button>
      </div>
    </div>
  );
}

export function ResultEmpty() {
  return (
    <div className="result-empty">
      <AlertCircle size={24} />
      <p>Your generated image or video will appear here.</p>
    </div>
  );
}
