import React from 'react';
import { ModelSelector } from './ModelSelector';
import { SendIcon } from '../common/Icon';

interface AIInputProps {
  value: string;
  onChange: (v: string) => void;
  model: string;
  onModelChange: (v: string) => void;
  onSend: () => void;
}

export function AIInput({ value, onChange, model, onModelChange, onSend }: AIInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="ai-input">
      <div className="ai-input__header">
        <span className="ai-input__title">AI Assistant</span>
      </div>
      <div className="ai-input__row">
        <ModelSelector value={model} onChange={onModelChange} />
        <input
          className="ai-input__field"
          type="text"
          placeholder="Ask AI to edit your video..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="AI prompt"
        />
        <button className="ai-input__send" onClick={onSend} aria-label="Send prompt" disabled={!value.trim()}>
          <SendIcon size={14} />
        </button>
      </div>
      <span className="ai-input__hint">Press Enter to send · Shift+Enter for new line</span>
    </div>
  );
}
