import React from 'react';
import { Send } from 'lucide-react';

interface PromptInputProps {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  busy: boolean;
}

export function PromptInput({ value, onChange, onGenerate, canGenerate, busy }: PromptInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canGenerate && !busy) onGenerate();
    }
  };

  return (
    <div className={`prompt-box ${busy ? 'is-busy' : ''}`}>
      <textarea
        className="prompt-textarea"
        placeholder={busy ? 'Generating…' : 'Describe what you want to create for your TikTok Shop…'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
        maxLength={1200}
        disabled={busy}
      />
      <button
        type="button"
        className="prompt-generate"
        onClick={onGenerate}
        disabled={!canGenerate || busy}
      >
        {busy ? (
          <span className="spinner" />
        ) : (
          <>
            <Send size={18} />
            Generate
          </>
        )}
      </button>
    </div>
  );
}
