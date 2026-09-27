import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { ModelType } from '../store';

interface ModelPickerProps {
  value: ModelType;
  onChange: (m: ModelType) => void;
  openaiReady: boolean;
  grokReady: boolean;
}

export function ModelPicker({ value, onChange, openaiReady, grokReady }: ModelPickerProps) {
  const options: { id: ModelType; label: string; ready: boolean; hint: string }[] = [
    { id: 'chatgpt', label: 'ChatGPT', ready: openaiReady, hint: 'OpenAI API key needed' },
    { id: 'grok', label: 'Grok', ready: grokReady, hint: 'xAI API key needed' },
  ];

  return (
    <div className="picker-group">
      <label className="picker-label">Model</label>
      <div className="picker-row">
        {options.map((o) => {
          const locked = !o.ready;
          const selected = value === o.id && !locked;
          return (
            <button
              key={o.id}
              type="button"
              className={`model-btn ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
              onClick={() => !locked && onChange(o.id)}
              title={locked ? o.hint : `${o.label} ready`}
            >
              {locked ? (
                <Bot size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              <span>{o.label}</span>
              {locked && <span className="lock-dot" />}
            </button>
          );
        })}
      </div>
      {!openaiReady && !grokReady && (
        <p className="picker-hint">Add your ChatGPT or Grok API key in Settings (⚙️) to unlock a model.</p>
      )}
      {value === 'chatgpt' && openaiReady && (
        <p className="picker-hint">ChatGPT generates images for your product.</p>
      )}
      {value === 'grok' && grokReady && (
        <p className="picker-hint">Grok generates videos for your product.</p>
      )}
    </div>
  );
}
