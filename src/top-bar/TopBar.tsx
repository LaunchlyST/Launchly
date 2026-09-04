import React from 'react';

export interface TopBarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  playing: boolean;
  onPlayToggle: () => void;
  onExport: () => void;
  onProjectManager: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
  onGlobalSearch: () => void;
  onAiCommand: () => void;
  exportModalOpen: boolean;
  projectManagerOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  globalSearchOpen: boolean;
  aiCommandOpen: boolean;
  setExportModalOpen: (open: boolean) => void;
  setProjectManagerOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setGlobalSearchOpen: (open: boolean) => void;
  setAiCommandOpen: (open: boolean) => void;
}

export function TopBar({
  projectName,
  onProjectNameChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  playing,
  onPlayToggle,
  onExport,
  onProjectManager,
  onSettings,
  onShortcuts,
  onGlobalSearch,
  onAiCommand,
}: TopBarProps) {
  return (
    <header className="topbar glass-panel">
      <div className="topbar-left">
        <button className="topbar-logo" aria-label="Launchly home">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          <span>Launchly</span>
        </button>
        <input
          className="project-name-input"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          aria-label="Project name"
        />
      </div>

      <div className="topbar-center">
        <button onClick={onUndo} disabled={!canUndo} aria-label="Undo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a5 5 0 0 1 0 10H9" /><polyline points="7,14 3,10 7,6" /></svg>
        </button>
        <button onClick={onRedo} disabled={!canRedo} aria-label="Redo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H11a5 5 0 0 0 0 10h4" /><polyline points="17,14 21,10 17,6" /></svg>
        </button>
        <button onClick={onPlayToggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          )}
        </button>
      </div>

      <div className="topbar-right">
        <button onClick={onGlobalSearch} aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        </button>
        <button onClick={onShortcuts} aria-label="Keyboard shortcuts">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" /></svg>
        </button>
        <button onClick={onAiCommand} aria-label="AI Command">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></svg>
        </button>
        <button onClick={onProjectManager} aria-label="Projects">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
        </button>
        <button onClick={onExport} className="export-btn" aria-label="Export">
          Export
        </button>
        <button onClick={onSettings} aria-label="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
        </button>
      </div>
    </header>
  );
}
