import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { AI_MODELS, AIProvider } from './aiModels';
import { sound } from '../sound/sound';

interface ModelPickerProps {
  value: string;
  onChange: (id: string) => void;
}

/** A small provider mark, so the two families are told apart at a glance. */
function ProviderMark({ provider, size = 12 }: { provider: AIProvider; size?: number }) {
  if (provider === 'claude') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <line x1="12" y1="3" x2="12" y2="9" />
        <line x1="12" y1="15" x2="12" y2="21" />
        <line x1="3" y1="12" x2="9" y2="12" />
        <line x1="15" y1="12" x2="21" y2="12" />
        <line x1="5.6" y1="5.6" x2="9.5" y2="9.5" />
        <line x1="14.5" y1="14.5" x2="18.4" y2="18.4" />
        <line x1="18.4" y1="5.6" x2="14.5" y2="9.5" />
        <line x1="9.5" y1="14.5" x2="5.6" y2="18.4" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3.4a8.6 8.6 0 0 1 7.4 4.3" />
      <path d="M19.4 16.3A8.6 8.6 0 0 1 12 20.6" />
      <path d="M4.6 16.3A8.6 8.6 0 0 1 4.6 7.7" />
    </svg>
  );
}

/**
 * The model in use, and a plain list to change it. Same shape as the video
 * size control, so the two read as the same kind of choice.
 */
export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = AI_MODELS.find((m) => m.id === value) ?? AI_MODELS[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        className={`model-picker__trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change model"
      >
        <span className="model-picker__mark">
          <ProviderMark provider={selected.provider} size={11} />
        </span>
        <span className="model-picker__name">
          {selected.name} <em>{selected.version}</em>
        </span>
        <ChevronDown size={12} className={open ? 'is-flipped' : ''} />
      </button>

      {open && (
        <div className="model-picker__menu" role="listbox" aria-label="Model">
          {AI_MODELS.map((m) => {
            const isActive = m.id === selected.id;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`model-picker__option ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  if (m.id !== selected.id) sound.tick?.();
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                <span className="model-picker__option-mark">
                  <ProviderMark provider={m.provider} size={13} />
                </span>
                <span className="model-picker__option-text">
                  <strong>
                    {m.name} {m.version}
                  </strong>
                  <em>{m.description}</em>
                </span>
                {isActive && (
                  <span className="model-picker__check" aria-hidden="true">
                    <Check size={13} strokeWidth={2.6} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
