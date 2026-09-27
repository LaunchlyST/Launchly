import React, { useState } from 'react';
import { X, Eye, EyeOff, Check, Trash2, KeyRound } from 'lucide-react';
import { useStore } from '../store';
import './settings.css';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

function KeyField({
  label,
  value,
  onChange,
  placeholder,
  active,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  active: boolean;
}) {
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onChange(draft.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">{label}</h3>
      <div className="settings-section__status">
        <span className={`settings-status-dot ${active ? 'is-active' : ''}`} />
        <span className="settings-section__status-text">
          {active ? 'Connected' : 'Not configured'}
        </span>
      </div>
      <div className="settings-key-row">
        <div className="settings-key-input-wrap">
          <KeyRound size={16} className="settings-key-input__icon" />
          <input
            className="settings-key-input"
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="settings-eye"
            onClick={() => setShow((v) => !v)}
            title={show ? 'Hide key' : 'Show key'}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button type="button" className="settings-save" onClick={handleSave}>
          {saved ? <Check size={16} /> : 'Save'}
        </button>
      </div>
    </div>
  );
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const openaiKey = useStore((s) => s.openaiKey);
  const grokKey = useStore((s) => s.grokKey);
  const setOpenaiKey = useStore((s) => s.setOpenaiKey);
  const setGrokKey = useStore((s) => s.setGrokKey);
  const clearKeys = useStore((s) => s.clearKeys);

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <aside className="settings-panel glass" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>

        <p className="settings-intro">
          Add your API keys to unlock each model. Keys are stored only in your browser and never sent
          to any server.
        </p>

        <KeyField
          label="OpenAI (ChatGPT)"
          value={openaiKey}
          onChange={setOpenaiKey}
          placeholder="sk-…"
          active={openaiKey.length > 0}
        />

        <div className="settings-section-divider" />

        <KeyField
          label="Grok (xAI)"
          value={grokKey}
          onChange={setGrokKey}
          placeholder="xai-…"
          active={grokKey.length > 0}
        />

        <div className="settings-section-divider" />

        <button type="button" className="settings-clear" onClick={clearKeys}>
          <Trash2 size={16} />
          Clear all keys
        </button>
      </aside>
    </div>
  );
}
