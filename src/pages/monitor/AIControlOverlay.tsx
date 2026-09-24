import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import type { MonitorControlState } from './types';

interface AIControlOverlayProps {
  state: MonitorControlState;
  onConfirmStop: () => void;
  children: React.ReactNode;
}

const BORDER_CLASS: Partial<Record<MonitorControlState, string>> = {
  disconnected: 'ai-overlay--neutral',
  connecting: 'ai-overlay--neutral',
  connected: 'ai-overlay--soft',
  active: 'ai-overlay--active',
  paused: 'ai-overlay--paused',
  stopping: 'ai-overlay--paused',
  'connection-lost': 'ai-overlay--error',
};

/**
 * Wraps the monitor preview and owns the "is AI in control right now" chrome:
 * the glowing orange border while active, the status pill, and the
 * double-click-to-confirm emergency stop. It never decides on its own that
 * control is active — that comes entirely from `state`, which the page only
 * sets once a real session says so.
 */
export function AIControlOverlay({ state, onConfirmStop, children }: AIControlOverlayProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isLive = state === 'active' || state === 'paused';

  const handleDoubleClick = () => {
    if (!isLive) return;
    setConfirmOpen(true);
  };

  return (
    <div
      className={`ai-overlay ${BORDER_CLASS[state] ?? 'ai-overlay--neutral'}`}
      onDoubleClick={handleDoubleClick}
    >
      {isLive && (
        <div className={`ai-overlay__pill ${state === 'paused' ? 'is-paused' : ''}`}>
          <Radio size={11} className="ai-overlay__pill-dot" />
          {state === 'paused' ? 'AI Control Paused' : 'AI Control Active'}
        </div>
      )}

      {children}

      {confirmOpen && (
        <div className="ai-overlay__confirm" role="alertdialog" aria-modal="true">
          <div className="ai-overlay__confirm-card">
            <p className="ai-overlay__confirm-title">Stop AI Control?</p>
            <p className="ai-overlay__confirm-body">
              The AI will immediately stop moving the mouse or keyboard on this computer.
            </p>
            <div className="ai-overlay__confirm-actions">
              <button
                type="button"
                className="ai-overlay__confirm-btn is-stop"
                onClick={() => {
                  setConfirmOpen(false);
                  onConfirmStop();
                }}
              >
                Stop Control
              </button>
              <button
                type="button"
                className="ai-overlay__confirm-btn"
                onClick={() => setConfirmOpen(false)}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
