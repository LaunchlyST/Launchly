import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AttachmentButton } from './AttachmentButton';
import { VoiceButton, VoiceOption } from './VoiceButton';
import { SendButton } from './SendButton';

interface PromptComposerProps {
  value: string;
  onChange: (v: string) => void;
  model: string;
  onModelChange: (v: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onAttach: (files: FileList | null) => void;
  /** A turn is in flight — the composer accepts text but will not send it. */
  busy: boolean;
  canStop: boolean;
}

const MAX_CHARS = 3000;
/** Grow to roughly six lines, then scroll internally. */
const MAX_TEXTAREA_HEIGHT = 132;

export function PromptComposer({
  value,
  onChange,
  model,
  onModelChange,
  onSend,
  onStop,
  onAttach,
  busy,
  canStop,
}: PromptComposerProps) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceOption, setVoiceOption] = useState<VoiceOption>('Voice');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const ready = trimmed.length > 0 && !busy;
  const nearLimit = value.length > MAX_CHARS * 0.9;

  /** Grow with the content up to a ceiling, then let the textarea scroll. */
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  const handleSend = useCallback(() => {
    if (!ready) return;
    onSend(trimmed);
  }, [ready, onSend, trimmed]);

  // Return the caret to the input once a turn finishes, so a follow-up is
  // just typing rather than typing plus a click.
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy) textareaRef.current?.focus();
    wasBusy.current = busy;
  }, [busy]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter (and IME composition) insert a newline.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceOption = (opt: VoiceOption) => {
    setVoiceOption(opt);
    if (opt === 'Model') onModelChange(model === 'chatgpt' ? 'claude' : 'chatgpt');
  };

  return (
    <div className={`composer ${focused ? 'is-focused' : ''} ${busy ? 'is-busy' : ''}`}>
      <div className="composer__field">
        <textarea
          ref={textareaRef}
          className="composer__textarea"
          placeholder="Ask anything..."
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          maxLength={MAX_CHARS}
          aria-label="Ask anything"
        />
        <SendButton ready={ready} busy={canStop} onSend={handleSend} onStop={onStop} />
      </div>

      <div className="composer__toolbar">
        <AttachmentButton onAttach={onAttach} disabled={busy} />
        <VoiceButton
          option={voiceOption}
          onOptionChange={handleVoiceOption}
          open={voiceOpen}
          onOpenChange={setVoiceOpen}
          disabled={busy}
        />
        <span className={`composer__counter ${nearLimit ? 'is-near-limit' : ''}`}>
          {value.length.toLocaleString()}/{MAX_CHARS.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
