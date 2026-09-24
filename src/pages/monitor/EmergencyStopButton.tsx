import React from 'react';
import { Octagon, Pause } from 'lucide-react';

interface EmergencyStopButtonProps {
  paused: boolean;
  onStop: () => void;
  onTogglePause: () => void;
}

/**
 * The always-visible controls while a session is live: pause, and the
 * primary emergency stop. `Ctrl+Shift+Esc` is shown as the future
 * system-level shortcut — it will be wired up inside the Windows companion
 * agent, which is the only thing that can react to a global hotkey outside
 * the browser tab, so it is not bound here.
 */
export function EmergencyStopButton({ paused, onStop, onTogglePause }: EmergencyStopButtonProps) {
  return (
    <div className="estop">
      <button type="button" className="estop__pause" onClick={onTogglePause}>
        <Pause size={15} />
        {paused ? 'Resume Control' : 'Pause Control'}
      </button>
      <button type="button" className="estop__stop" onClick={onStop}>
        <Octagon size={15} />
        Stop AI Control
      </button>
      <span className="estop__hint">Emergency stop (on the desktop agent): Ctrl+Shift+Esc</span>
    </div>
  );
}
