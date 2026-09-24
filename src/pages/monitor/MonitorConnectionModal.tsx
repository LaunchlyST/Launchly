import React from 'react';
import { X, Download, CheckCircle2, AlertTriangle, Loader2, MonitorX } from 'lucide-react';
import { AIProviderSelector } from './AIProviderSelector';
import type { AIProvider, MonitorConnectionState } from './types';

export type ProviderTestState = 'idle' | 'testing' | 'success' | 'error';

interface MonitorConnectionModalProps {
  open: boolean;
  onClose: () => void;
  agentState: MonitorConnectionState;
  checkingAgent: boolean;
  onRecheck: () => void;
  provider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  testState: ProviderTestState;
  testError: string | null;
  onTestConnection: () => void;
}

const AGENT_STATE_COPY: Record<MonitorConnectionState, { title: string; body: string }> = {
  'agent-not-installed': {
    title: 'Desktop agent not installed',
    body:
      'Monitor Control needs the Launchly Desktop Agent running on the computer you want AI to operate. It is not available for download yet.',
  },
  'agent-detected': {
    title: 'Desktop agent detected',
    body: 'Found a Launchly Desktop Agent on this computer. Ready to connect.',
  },
  connecting: {
    title: 'Connecting…',
    body: 'Opening a session with your desktop agent.',
  },
  connected: {
    title: 'Connected',
    body: 'Your computer is connected. You can start AI control from the Monitor tab.',
  },
  disconnected: {
    title: 'Disconnected',
    body: 'This computer is not connected to Monitor Control.',
  },
  error: {
    title: 'Connection error',
    body: 'Something went wrong while trying to reach the desktop agent.',
  },
};

export function MonitorConnectionModal({
  open,
  onClose,
  agentState,
  checkingAgent,
  onRecheck,
  provider,
  onProviderChange,
  apiKey,
  onApiKeyChange,
  testState,
  testError,
  onTestConnection,
}: MonitorConnectionModalProps) {
  if (!open) return null;

  const copy = AGENT_STATE_COPY[agentState];

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal glass uv-light" onClick={(e) => e.stopPropagation()}>
        <header className="mc-modal__head">
          <h2 className="mc-modal__title">Connect your computer</h2>
          <button className="mc-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <p className="mc-modal__intro">
          Monitor Control operates your computer through the Launchly Desktop Agent — a small app
          that runs on your Windows PC and carries out AI actions locally. It hasn&rsquo;t shipped
          yet, so nothing here can actually move your mouse or keyboard.
        </p>

        <section className="mc-modal__section">
          <div className={`mc-agent-status mc-agent-status--${agentState}`}>
            <span className="mc-agent-status__icon">
              {checkingAgent ? (
                <Loader2 size={18} className="mc-spin" />
              ) : agentState === 'connected' || agentState === 'agent-detected' ? (
                <CheckCircle2 size={18} />
              ) : agentState === 'error' ? (
                <AlertTriangle size={18} />
              ) : (
                <MonitorX size={18} />
              )}
            </span>
            <div>
              <p className="mc-agent-status__title">
                {checkingAgent ? 'Checking for the desktop agent…' : copy.title}
              </p>
              <p className="mc-agent-status__body">{copy.body}</p>
            </div>
          </div>

          <div className="mc-modal__row">
            <button type="button" className="mc-btn-outline" onClick={onRecheck} disabled={checkingAgent}>
              {checkingAgent ? 'Checking…' : 'Check again'}
            </button>
            <button type="button" className="mc-btn-primary" disabled title="Coming soon">
              <Download size={15} />
              Download Launchly Desktop
            </button>
          </div>
        </section>

        <div className="mc-modal__divider" />

        <section className="mc-modal__section">
          <h3 className="mc-modal__label">AI Model</h3>
          <AIProviderSelector value={provider} onChange={onProviderChange} />

          <label className="mc-modal__label mc-modal__label--spaced" htmlFor="mc-api-key">
            API Key
          </label>
          <input
            id="mc-api-key"
            className="mc-key-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-••••••••••••"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
          <p className="mc-modal__hint">
            Kept in this browser tab only for this session. It is never written to storage here —
            production builds send it straight to a secure backend or the local agent, encrypted.
          </p>

          <button
            type="button"
            className="mc-btn-outline mc-modal__test-btn"
            onClick={onTestConnection}
            disabled={!apiKey.trim() || testState === 'testing'}
          >
            {testState === 'testing' ? <Loader2 size={14} className="mc-spin" /> : null}
            Test Connection
          </button>

          {testState === 'success' && (
            <p className="mc-test-result is-ok">
              <CheckCircle2 size={14} /> Provider reachable.
            </p>
          )}
          {testState === 'error' && (
            <p className="mc-test-result is-err">
              <AlertTriangle size={14} /> {testError ?? 'Could not verify this key.'}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
