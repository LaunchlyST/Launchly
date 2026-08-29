import React, { useState, useRef, useEffect } from 'react';

export interface AICommandBarProps {
  open: boolean;
  onClose: () => void;
}

export function AICommandBar({ open, onClose }: AICommandBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="command-palette glass-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-input"
          placeholder="Ask AI to edit your video..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="ai-suggestions">
          <p className="panel-placeholder">AI editing tools coming soon.</p>
        </div>
      </div>
    </div>
  );
}
