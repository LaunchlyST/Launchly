import React from 'react';
import { RotateCcw, Sparkles, AlertCircle } from 'lucide-react';
import { ConversationMessage, isRetryable } from './conversation.types';
import { AITypingIndicator } from './AITypingIndicator';

interface AIMessageProps {
  message: ConversationMessage;
  onRetry: (id: string) => void;
  /** Suppresses the retry action while another turn is running. */
  busy: boolean;
}

/** Time-only stamp — the sidebar is too narrow to carry a full date. */
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function AIMessage({ message, onRetry, busy }: AIMessageProps) {
  const isUser = message.role === 'user';
  const showTyping = message.status === 'thinking' && !message.text;
  const failed = isRetryable(message.status);

  return (
    <article
      className={`ai-msg ai-msg--${isUser ? 'user' : 'assistant'} ${failed ? 'is-failed' : ''}`}
      aria-live={isUser ? undefined : 'polite'}
    >
      <header className="ai-msg__meta">
        {!isUser && (
          <span className="ai-msg__avatar" aria-hidden="true">
            <Sparkles size={11} strokeWidth={2.2} />
          </span>
        )}
        <span className="ai-msg__author">{isUser ? 'You' : 'AI'}</span>
        <time className="ai-msg__time" dateTime={new Date(message.createdAt).toISOString()}>
          {formatTime(message.createdAt)}
        </time>
      </header>

      <div className="ai-msg__body">
        {showTyping ? <AITypingIndicator /> : <p className="ai-msg__text">{message.text}</p>}
        {message.status === 'streaming' && <span className="ai-msg__caret" aria-hidden="true" />}
        {message.status === 'stopped' && <span className="ai-msg__note">Stopped</span>}
      </div>

      {failed && (
        <div className="ai-msg__error">
          <AlertCircle size={12} strokeWidth={2.2} />
          <span>{message.error || 'Could not get a response.'}</span>
          <button
            type="button"
            className="ai-msg__retry"
            onClick={() => onRetry(message.id)}
            disabled={busy}
          >
            <RotateCcw size={11} strokeWidth={2.3} />
            Retry
          </button>
        </div>
      )}
    </article>
  );
}
