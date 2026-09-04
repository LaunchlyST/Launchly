import React, { useState } from 'react';

export interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportModal({ open, onClose, onExported, isPro, onPremiumLocked }: ExportModalProps & { onExported?: (pct: number) => void; isPro?: boolean; onPremiumLocked?: (feature: string) => void }) {
  const [format, setFormat] = useState('mp4');
  const [resolution, setResolution] = useState('1080p');
  const [quality, setQuality] = useState('high');
  const [exporting, setExporting] = useState(false);
  const [pct, setPct] = useState(0);

  if (!open) return null;

  const handleExport = () => {
    if (resolution === '4k' && !isPro) {
      onPremiumLocked?.('hd_export');
      return;
    }
    setExporting(true);
    setPct(0);
    let p = 0;
    const interval = window.setInterval(() => {
      p += Math.floor(Math.random() * 12) + 8;
      if (p >= 100) {
        p = 100;
        setPct(100);
        window.clearInterval(interval);
        setTimeout(() => {
          setExporting(false);
          setPct(0);
          onClose();
          onExported?.(100);
        }, 400);
      } else {
        setPct(p);
      }
    }, 140);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Video</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">
          <label>
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
              <option value="mov">MOV</option>
              <option value="gif">GIF</option>
            </select>
          </label>
          <label>
            Resolution
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              <option value="4k">4K (3840x2160) {!isPro ? '· Pro' : ''}</option>
              <option value="1080p">1080p (1920x1080)</option>
              <option value="720p">720p (1280x720)</option>
              <option value="480p">480p (854x480)</option>
            </select>
            {resolution === '4k' && !isPro && <small className="export-locked-hint">4K is a Pro feature — Export will show the paywall</small>}
          </label>
          <label>
            Quality
            <select value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="lossless">Lossless</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          {exporting && (
            <div className="export-progress">
              <div className="progress-bar" style={{ width: `${pct}%` } as React.CSSProperties} />
              <span style={{ color: '#0F172A', fontWeight: 700 }}>{pct}%</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : resolution === '4k' && !isPro ? 'Unlock 4K' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
