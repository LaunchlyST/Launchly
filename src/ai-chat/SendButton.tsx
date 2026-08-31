import React from 'react';
import { ArrowUp, Square } from 'lucide-react';

interface SendButtonProps {
  ready: boolean;
  /** When true the control becomes a stop-generation button instead. */
  busy: boolean;
  onSend: () => void;
  onStop: () => void;
}

/**
 * Single control for send and stop. Sharing one slot keeps the composer from
 * reflowing when a turn starts, and matches where the eye already is.
 */
export function SendButton({ ready, busy, onSend, onStop }: SendButtonProps) {
  if (busy) {
    return (
      <button type="button" className="composer-send is-stop" onClick={onStop} title="Stop generating" aria-label="Stop generating">
        <Square size={11} strokeWidth={3} fill="currentColor" />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`composer-send ${ready ? 'is-ready' : ''}`}
      onClick={onSend}
      disabled={!ready}
      title={ready ? 'Send' : 'Type a message to send'}
      aria-label="Send message"
    >
      <ArrowUp size={16} strokeWidth={2.6} />
    </button>
  );
}
