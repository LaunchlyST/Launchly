import React from 'react';
import { Sparkles } from 'lucide-react';
import type { AICursorPosition } from './types';

interface AICursorProps {
  position: AICursorPosition;
  /** Show the small "AI" chip next to the cursor. Defaults to true. */
  label?: boolean;
}

/**
 * The AI's own cursor: an amber ring + arrow, deliberately unlike the user's
 * physical pointer, so it's always obvious who is moving the mouse. Purely
 * visual today — it renders at whatever position it's given. Once the
 * desktop agent exists, that position will be driven by live coordinates it
 * reports, not by anything computed in the browser.
 */
export function AICursor({ position, label = true }: AICursorProps) {
  return (
    <div
      className="ai-cursor"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      aria-hidden="true"
    >
      <span className="ai-cursor__ring" />
      <svg className="ai-cursor__arrow" width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M3 2.5 18.5 9.6l-6.3 1.5-2.7 6.1L3 2.5Z"
          fill="#ff9d2e"
          stroke="#fff"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      </svg>
      {label && (
        <span className="ai-cursor__label">
          <Sparkles size={10} />
          AI
        </span>
      )}
    </div>
  );
}
