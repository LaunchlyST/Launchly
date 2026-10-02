import React from 'react';
import { Monitor, Settings2 } from 'lucide-react';

export type Tone = 'ok' | 'warn' | 'error' | 'idle';

/** Slim workspace bar: identity + the two things that define the session. */
export function MonitorTopBar({
  serviceOnline,
  deviceOnline,
  deviceName,
  streamLive,
  onOpenSettings,
  children,
}: {
  serviceOnline: boolean;
  deviceOnline: boolean;
  deviceName: string | null;
  streamLive: boolean;
  onOpenSettings: () => void;
  /** Project selector, rendered between the status and the right-hand controls. */
  children?: React.ReactNode;
}) {
  const computer = streamLive ? 'Connected' : deviceOnline ? deviceName || 'Computer online' : 'Computer disconnected';
  const computerTone: Tone = streamLive || deviceOnline ? 'ok' : 'idle';
  const stream = streamLive ? 'Screen live' : 'No screen';
  const streamTone: Tone = streamLive ? 'ok' : 'idle';

  return (
    <header className="mv-topbar">
      <div className="mv-topbar__lead">
        <h1 className="mv-topbar__title">
          <Monitor size={15} strokeWidth={2} /> Monitor
        </h1>
        <span className="mv-topbar__sep" aria-hidden="true" />
        <span className="mv-status" data-tone={computerTone}>
          <i aria-hidden="true" />
          {computer}
        </span>
        <span className="mv-status" data-tone={streamTone}>
          <i aria-hidden="true" />
          {stream}
        </span>
      </div>

      <div className="mv-topbar__project">{children}</div>

      <div className="mv-topbar__trail">
        <span className="mv-status" data-tone={serviceOnline ? 'ok' : 'error'} title={serviceOnline ? 'Monitor service is reachable' : 'Monitor service is not reachable'}>
          <i aria-hidden="true" />
          {serviceOnline ? 'Service online' : 'Service offline'}
        </span>
        <button type="button" className="mv-iconbtn" onClick={onOpenSettings} aria-label="Monitor settings" title="Monitor settings">
          <Settings2 size={15} />
        </button>
      </div>
    </header>
  );
}