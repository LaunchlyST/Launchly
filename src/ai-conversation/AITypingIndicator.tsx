import React from 'react';

/** Three-dot pulse shown while the assistant is thinking, before any text. */
export function AITypingIndicator() {
  return (
    <span className="ai-typing" role="status" aria-label="AI is thinking">
      <span className="ai-typing__dot" />
      <span className="ai-typing__dot" />
      <span className="ai-typing__dot" />
    </span>
  );
}
