import React from 'react';
import { AI_PROVIDERS, type AIProvider, type MonitorControlState } from './types';

interface MonitorStatusProps {
  connected: boolean;
  computerName?: string;
  provider: AIProvider;
  controlState: MonitorControlState;
  sessionDuration: string | null;
}

const CONTROL_LABEL: Record<MonitorControlState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Idle',
  active: 'Active',
  paused: 'Paused',
  stopping: 'Stopping…',
  'connection-lost': 'Connection lost',
};

/** Read-only status row. Never shows a machine name or figure the agent hasn't reported. */
export function MonitorStatus({
  connected,
  computerName,
  provider,
  controlState,
  sessionDuration,
}: MonitorStatusProps) {
  const providerLabel = AI_PROVIDERS.find((p) => p.id === provider)?.label ?? provider;

  return (
    <dl className="mc-status-grid">
      <div className="mc-status-item">
        <dt>Computer</dt>
        <dd>{connected ? computerName ?? 'Windows Desktop' : '—'}</dd>
      </div>
      <div className="mc-status-item">
        <dt>Status</dt>
        <dd className={connected ? 'is-good' : ''}>{connected ? 'Connected' : 'Not connected'}</dd>
      </div>
      <div className="mc-status-item">
        <dt>Model</dt>
        <dd>{providerLabel}</dd>
      </div>
      <div className="mc-status-item">
        <dt>Control</dt>
        <dd className={controlState === 'active' ? 'is-live' : ''}>{CONTROL_LABEL[controlState]}</dd>
      </div>
      <div className="mc-status-item">
        <dt>Session</dt>
        <dd>{sessionDuration ?? '—'}</dd>
      </div>
    </dl>
  );
}
