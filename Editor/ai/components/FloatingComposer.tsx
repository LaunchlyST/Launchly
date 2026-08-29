import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Mic, CornerDownLeft, ArrowUp, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { AI_MODELS } from '../../ai/config/aiModels';
import { ModelCurve } from './ModelCurve';
import { sound, isSoundMuted, setSoundMuted } from '../../shared/utils/sound';

interface FloatingComposerProps {
  value: string;
  onChange: (v: string) => void;
  model: string;
  onModelChange: (v: string) => void;
  onSend: () => void;
}

const MAX_CHARS = 2000;

export function FloatingComposer({ value, onChange, model, onModelChange, onSend }: FloatingComposerProps) {
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [muted, setMuted] = useState(isSoundMuted());
  const typingTimeout = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(
    () => () => {
      if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    },
    []
  );

  const activeModel = AI_MODELS.find((m) => m.id === model) ?? AI_MODELS[0];
  const canSend = value.trim().length > 0 && !isGenerating;

  /** Grow to fit the prompt instead of always reserving three empty rows. */
  const autoSize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
  useEffect(autoSize, [value]);

  const handleChange = (next: string) => {
    onChange(next.slice(0, MAX_CHARS));
    setIsTyping(true);
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => setIsTyping(false), 700);
  };

  const handleSend = () => {
    if (!canSend) return;
    sound.snap?.();
    setIsGenerating(true);
    onSend();
    window.setTimeout(() => setIsGenerating(false), 900);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    if (!next) sound.tick?.();
  };

  const status = isGenerating ? 'generating' : isTyping ? 'typing' : 'ready';
  const statusLabel = isGenerating ? 'Working' : isTyping ? 'Listening' : 'Ready';

  return (
    <div
      className={`ai-panel ${isFocused ? 'is-focused' : ''} ${isGenerating ? 'is-generating' : ''}`}
    >
      {/* Header — identity, live status, sound */}
      <div className="ai-panel__header">
        <span className="ai-panel__brand">
          <span className="ai-panel__brand-icon" aria-hidden="true">
            <Sparkles size={11} strokeWidth={2.4} />
          </span>
          AI Assistant
        </span>

        <span className="ai-panel__header-right">
          <span className={`ai-status is-${status}`}>
            <span className="ai-status__dot" aria-hidden="true" />
            {statusLabel}
          </span>
          <button
            className="ai-icon-btn"
            onClick={toggleMute}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </span>
      </div>

      {/* Composer */}
      <div className="ai-composer">
        <textarea
          ref={textareaRef}
          className="ai-composer__input"
          placeholder="Describe an edit…"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_CHARS}
          aria-label="AI prompt"
        />

        <div className="ai-composer__toolbar">
          <div className="ai-composer__tools">
            <button className="ai-icon-btn" title="Attach media" aria-label="Attach media">
              <Paperclip size={13.5} />
            </button>
            <button className="ai-icon-btn" title="Voice input" aria-label="Voice input">
              <Mic size={13.5} />
            </button>
          </div>

          <div className="ai-composer__meta">
            {value.length > 0 && (
              <span className={`ai-composer__count ${value.length > MAX_CHARS * 0.9 ? 'is-near' : ''}`}>
                {value.length}/{MAX_CHARS}
              </span>
            )}
            <button
              className={`ai-send ${isGenerating ? 'is-generating' : canSend ? 'is-ready' : ''}`}
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send prompt"
              title={canSend ? 'Send (Enter)' : 'Write a prompt first'}
            >
              {isGenerating ? (
                <span className="ai-send__dots">
                  <span /><span /><span />
                </span>
              ) : (
                <ArrowUp size={15} strokeWidth={2.6} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Model selector */}
      <div className="ai-panel__models">
        <ModelCurve value={activeModel.id} onChange={onModelChange} />
      </div>

      <div className="ai-panel__foot">
        <span className="ai-panel__hint">
          <kbd><CornerDownLeft size={9} /></kbd> send
          <em>·</em>
          scroll to browse models
        </span>
      </div>

      <span className="sr-only" aria-live="polite">
        {activeModel.name} {activeModel.version} selected
      </span>
    </div>
  );
}
