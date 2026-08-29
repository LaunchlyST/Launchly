import React, { useState, useRef, useEffect } from 'react';
import { AI_MODELS } from '../../ai/config/aiModels';
import { ChevronDownIcon } from '../../shared/components/Icon';

interface ModelSelectorProps {
  value: string;
  onChange: (id: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = AI_MODELS.find((m) => m.id === value) ?? AI_MODELS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="model-selector" ref={ref}>
      <button className="model-selector__trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="model-selector__icon">{selected.icon}</span>
        <span className="model-selector__label">{selected.shortLabel}</span>
        <ChevronDownIcon size={12} />
      </button>
      {open && (
        <div className="model-selector__dropdown" role="listbox">
          {AI_MODELS.map((model) => (
            <button
              key={model.id}
              role="option"
              aria-selected={model.id === value}
              className={`model-selector__option ${model.id === value ? 'active' : ''}`}
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
            >
              <span className="model-selector__option-icon">{model.icon}</span>
              <span className="model-selector__option-label">{model.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
