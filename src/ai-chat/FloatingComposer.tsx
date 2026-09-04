import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Mic, ArrowUp } from 'lucide-react';

interface FloatingComposerProps {
  value: string;
  onChange: (v: string) => void;
  model: string;
  onModelChange: (v: string) => void;
  onSend: () => void;
}

const MAX_CHARS = 3000;

type VoiceOption = 'Voice' | 'Chat' | 'Script' | 'Model';

export function FloatingComposer({ value, onChange, model, onModelChange, onSend }: FloatingComposerProps) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceOption, setVoiceOption] = useState<VoiceOption>('Voice');
  const [messages, setMessages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setVoiceOpen(false);
      }
    };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, []);

  const canSend = value.trim().length > 0;

  const autoSize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
  useEffect(autoSize, [value]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!canSend) return;
    setMessages((prev) => [...prev, value.trim()]);
    onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const closeAll = () => { setVoiceOpen(false); };

  return (
    <div className="ai-panel-v2">
      {/* ── Message history — scrollable, shows sent messages ──────── */}
      {messages.length > 0 && (
        <div className="ai-v2__messages">
          {messages.map((msg, i) => (
            <div key={i} className="ai-v2__msg">{msg}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="ai-v2__inputWrap" ref={wrapRef}>
        <textarea
          ref={textareaRef}
          className="ai-v2__textarea"
          placeholder="Ask anything..."
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_CHARS}
          aria-label="Ask anything"
        />
        <button
          className={`ai-v2__send ${canSend ? 'is-ready' : ''}`}
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send"
        >
          <ArrowUp size={16} strokeWidth={2.6} />
        </button>

        {/* ── Voice dropdown — inside the input box ─────────────────── */}
        {voiceOpen && (
          <div className="ai-v2__dropdown ai-v2__dropdown--inline">
            {(['Voice', 'Chat', 'Script', 'Model'] as VoiceOption[]).map((opt) => (
              <button
                key={opt}
                className={`ai-v2__dropdownItem ${voiceOption === opt ? 'is-selected' : ''}`}
                onClick={() => {
                  setVoiceOption(opt);
                  closeAll();
                  if (opt === 'Model') {
                    onModelChange(model === 'chatgpt' ? 'claude' : 'chatgpt');
                  }
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ai-v2__toolbar">
        <div className="ai-v2__left">
          <button className="ai-v2__pill" onClick={() => document.getElementById('ai-attach-input')?.click()}>
            <Paperclip size={12} /> Attach
          </button>
          <input id="ai-attach-input" type="file" hidden onChange={() => {}} />

          <button className={`ai-v2__pill ${voiceOpen ? 'is-active' : ''}`} onClick={() => setVoiceOpen((v) => !v)}>
            <Mic size={12} /> {voiceOption}
          </button>
        </div>

        <span className="ai-v2__counter">{value.length}/{MAX_CHARS.toLocaleString()}</span>
      </div>
    </div>
  );
}
