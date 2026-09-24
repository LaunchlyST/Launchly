import React from 'react';
import { AI_PROVIDERS, type AIProvider } from './types';

interface AIProviderSelectorProps {
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
}

/** Provider picker. Extensible — add an entry to AI_PROVIDERS to grow it. */
export function AIProviderSelector({ value, onChange }: AIProviderSelectorProps) {
  return (
    <div className="ai-provider-row">
      {AI_PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`uv-pill ai-provider-btn ${value === p.id ? 'is-selected' : ''}`}
          onClick={() => onChange(p.id)}
          aria-pressed={value === p.id}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
