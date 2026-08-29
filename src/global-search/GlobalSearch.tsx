import React, { useState, useRef, useEffect } from 'react';

export interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const COMMANDS = [
  { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo' },
  { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: 'redo' },
  { id: 'export', label: 'Export Video', shortcut: 'Ctrl+E', action: 'export' },
  { id: 'split', label: 'Split Clip', shortcut: 'S', action: 'split' },
  { id: 'delete', label: 'Delete Clip', shortcut: 'Delete', action: 'delete' },
  { id: 'duplicate', label: 'Duplicate Clip', shortcut: 'Ctrl+D', action: 'duplicate' },
  { id: 'settings', label: 'Open Settings', shortcut: '', action: 'settings' },
  { id: 'projects', label: 'Project Manager', shortcut: '', action: 'projects' },
];

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const filtered = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="command-palette glass-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-input"
          placeholder="Search commands..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        />
        <ul className="command-list">
          {filtered.map((cmd) => (
            <li key={cmd.id} className="command-item">
              <span>{cmd.label}</span>
              {cmd.shortcut && <kbd>{cmd.shortcut}</kbd>}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="command-empty">No commands found</li>
          )}
        </ul>
      </div>
    </div>
  );
}
