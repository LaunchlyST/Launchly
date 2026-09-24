import React from 'react';
import { MonitorX, Wand2 } from 'lucide-react';
import { AIControlOverlay } from './AIControlOverlay';
import { AICursor } from './AICursor';
import type { MonitorControlState } from './types';

interface MonitorPreviewProps {
  connected: boolean;
  controlState: MonitorControlState;
  onConnect: () => void;
  onConfirmStop: () => void;
  /** Design-only demo of the AI cursor, off by default, clearly labelled. */
  cursorDemo: boolean;
  onToggleCursorDemo: () => void;
}

/**
 * The monitor panel: the one large visual focus of the page. When nothing is
 * connected it says so plainly and offers the connect CTA. It never draws a
 * screenshot, desktop icons, or anything else implying it can see or touch a
 * real Windows session — that only becomes honest once a desktop agent is
 * reporting real screen state.
 */
export function MonitorPreview({
  connected,
  controlState,
  onConnect,
  onConfirmStop,
  cursorDemo,
  onToggleCursorDemo,
}: MonitorPreviewProps) {
  const showCursor = controlState === 'active' || (cursorDemo && !connected);

  return (
    <AIControlOverlay state={controlState} onConfirmStop={onConfirmStop}>
      <div className="mc-screen">
        {!connected ? (
          <div className="mc-screen__empty">
            <span className="mc-screen__empty-icon">
              <MonitorX size={30} />
            </span>
            <p className="mc-screen__empty-title">Not Connected</p>
            <button type="button" className="mc-btn-primary mc-screen__cta" onClick={onConnect}>
              Connect Computer
            </button>
            <p className="mc-screen__empty-sub">
              Connect your Windows computer to enable AI control.
            </p>

            <button type="button" className="mc-cursor-demo-toggle" onClick={onToggleCursorDemo}>
              <Wand2 size={13} />
              {cursorDemo ? 'Hide cursor preview' : 'Preview AI cursor style'}
            </button>
            {cursorDemo && (
              <p className="mc-screen__empty-note">
                Design preview only — no computer is connected.
              </p>
            )}
          </div>
        ) : (
          <div className="mc-screen__desktop" aria-label="Connected desktop, awaiting agent data">
            <p className="mc-screen__desktop-note">
              Waiting on the desktop agent to report screen state.
            </p>
          </div>
        )}

        {showCursor && <AICursor position={{ x: 58, y: 46 }} />}
      </div>
    </AIControlOverlay>
  );
}
