import React from 'react';

export interface ProjectManagerProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectManager({ open, onClose }: ProjectManagerProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Project Manager</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">
          <p className="panel-placeholder">Project management coming soon.</p>
        </div>
      </div>
    </div>
  );
}
