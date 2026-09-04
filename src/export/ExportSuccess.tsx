import React from 'react';

interface ExportSuccessProps {
  open: boolean;
  onClose: () => void;
  onViewWhitePage: () => void;
  projectName?: string;
}

export function ExportSuccess({ open, onClose, onViewWhitePage, projectName = 'Your project' }: ExportSuccessProps) {
  const [pct, setPct] = React.useState(0);
  React.useEffect(() => {
    if (!open) {
      setPct(0);
      return;
    }
    setPct(0);
    let p = 0;
    const interval = window.setInterval(() => {
      p += Math.floor(Math.random() * 10) + 6;
      if (p >= 100) {
        p = 100;
        setPct(100);
        window.clearInterval(interval);
        window.setTimeout(() => onViewWhitePage(), 350);
      } else {
        setPct(p);
      }
    }, 110);
    return () => window.clearInterval(interval);
  }, [open, onViewWhitePage]);
  if (!open) return null;
  return (
    <div className="export-success-overlay" role="dialog" aria-modal="true" aria-label="Export complete">
      <div className="export-success-box">
        <div className="export-success-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="export-success-title">Project exported!</h2>
        <p className="export-success-subtitle" style={{ color: '#0F172A' }}>{projectName} has been exported successfully.</p>
        <div className="export-loading">
          <div className="export-loading-bar"><div className="export-loading-fill" style={{ width: `${pct}%` } as React.CSSProperties} /></div>
          <span className="export-loading-pct" style={{ color: '#0F172A' }}>{pct}%</span>
        </div>
        <p className="export-success-hint" style={{ color: '#0F172A' }}>{pct < 100 ? `Loading ${pct}%…` : 'Done — opening empty page…'}</p>
      </div>
    </div>
  );
}

export function ExportWhitePage({ open, onBack }: { open: boolean; onBack: () => void; projectName?: string; clips?: any[] }) {
  if (!open) return null;
  return (
    <div className="export-white-page" role="dialog" aria-modal="true" onClick={onBack}>
      <button className="export-white-page__close" onClick={onBack} aria-label="Back to editor">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        Back to editor
      </button>
    </div>
  );
}
