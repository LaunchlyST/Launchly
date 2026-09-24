import React, { useEffect, useState } from 'react';
import { Eye, MousePointer2, Keyboard } from 'lucide-react';
import { MonitorPreview } from './MonitorPreview';
import { MonitorConnectionModal, type ProviderTestState } from './MonitorConnectionModal';
import { MonitorStatus } from './MonitorStatus';
import { MonitorChat } from './MonitorChat';
import { EmergencyStopButton } from './EmergencyStopButton';
import {
  MonitorServiceError,
  detectDesktopAgent,
  testProviderConnection,
} from './monitorService';
import type {
  AIProvider,
  MonitorChatMessage as MonitorChatMessageT,
  MonitorConnectionState,
  MonitorControlState,
} from './types';
import { useSettingsStore } from '../settings/settingsStore';
import './monitor.css';

type Tab = 'monitor' | 'chat';

function nowIso() {
  return new Date().toISOString();
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function MonitorControlPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [agentState, setAgentState] = useState<MonitorConnectionState>('agent-not-installed');
  const [checkingAgent, setCheckingAgent] = useState(false);

  const defaultMonitorProvider = useSettingsStore((s) => s.settings.defaultMonitorProvider);
  /* Preselect from Settings > Monitor Control. Only affects a *new* session —
     once connected, nothing here re-reads the setting, so an active session
     is never switched underneath the user. */
  const [provider, setProvider] = useState<AIProvider>(
    defaultMonitorProvider === 'anthropic' ? 'claude' : 'openai'
  );
  const [apiKey, setApiKey] = useState('');
  const [testState, setTestState] = useState<ProviderTestState>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const [controlState, setControlState] = useState<MonitorControlState>('disconnected');
  const [tab, setTab] = useState<Tab>('monitor');
  const [messages, setMessages] = useState<MonitorChatMessageT[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [cursorDemo, setCursorDemo] = useState(false);

  const connected = controlState !== 'disconnected';

  useEffect(() => {
    if (controlState !== 'active') return;
    const id = setInterval(() => {
      if (sessionStartedAt) setElapsed(Date.now() - sessionStartedAt);
    }, 1000);
    return () => clearInterval(id);
  }, [controlState, sessionStartedAt]);

  const runDetect = () => {
    setCheckingAgent(true);
    detectDesktopAgent().then(({ found }) => {
      setCheckingAgent(false);
      setAgentState(found ? 'agent-detected' : 'agent-not-installed');
    });
  };

  const openConnectModal = () => {
    setModalOpen(true);
    runDetect();
  };

  const handleTestConnection = async () => {
    setTestState('testing');
    setTestError(null);
    try {
      await testProviderConnection(provider, apiKey);
      setTestState('success');
    } catch (err) {
      setTestState('error');
      setTestError(
        err instanceof MonitorServiceError
          ? err.message
          : 'Could not verify this key.'
      );
    }
  };

  const handleStop = () => {
    setControlState(connected ? 'stopping' : 'disconnected');
    window.setTimeout(() => {
      setControlState('disconnected');
      setSessionStartedAt(null);
      setElapsed(0);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'system',
          text: 'AI control stopped.',
          timestamp: nowIso(),
        },
      ]);
    }, 400);
  };

  const handleTogglePause = () => {
    setControlState((prev) => (prev === 'paused' ? 'active' : prev === 'active' ? 'paused' : prev));
  };

  const handleSend = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text, timestamp: nowIso() },
    ]);

    if (controlState !== 'active') {
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'system',
            text: 'Connect your computer before starting AI control.',
            timestamp: nowIso(),
          },
        ]);
      }, 250);
      return;
    }

    /* Reachable only once a real session is active — routed through the
       Monitor Control service, never answered locally. */
  };

  return (
    <div className="mc-page">
      <header className="mc-header">
        <h1 className="mc-title">Monitor Control</h1>
        <p className="mc-subtitle">
          Connect your computer and let AI help operate it through natural language.
        </p>
      </header>

      <section className="mc-card mc-top">
        <MonitorStatus
          connected={connected}
          provider={provider}
          controlState={controlState}
          sessionDuration={connected ? formatDuration(elapsed) : null}
        />
        {!connected && (
          <button type="button" className="mc-btn-primary" onClick={openConnectModal}>
            Connect Computer
          </button>
        )}
      </section>

      <section className="mc-card mc-monitor-card">
        <MonitorPreview
          connected={connected}
          controlState={controlState}
          onConnect={openConnectModal}
          onConfirmStop={handleStop}
          cursorDemo={cursorDemo}
          onToggleCursorDemo={() => setCursorDemo((v) => !v)}
        />

        {connected && (
          <EmergencyStopButton
            paused={controlState === 'paused'}
            onStop={handleStop}
            onTogglePause={handleTogglePause}
          />
        )}
      </section>

      <section className="mc-card mc-permissions">
        <h3 className="mc-modal__label">Permissions</h3>
        <p className="mc-modal__hint">AI can access only while this session is active.</p>
        <div className="mc-perm-row">
          <span className="mc-perm-toggle is-checked">
            <Eye size={14} /> Screen viewing
          </span>
          <span className="mc-perm-toggle is-checked">
            <MousePointer2 size={14} /> Mouse control
          </span>
          <span className="mc-perm-toggle is-checked">
            <Keyboard size={14} /> Keyboard control
          </span>
        </div>
      </section>

      <div className="mc-tabs">
        <button
          type="button"
          className={`uv-pill mc-tab ${tab === 'monitor' ? 'is-selected' : ''}`}
          onClick={() => setTab('monitor')}
        >
          Monitor
        </button>
        <button
          type="button"
          className={`uv-pill mc-tab ${tab === 'chat' ? 'is-selected' : ''}`}
          onClick={() => setTab('chat')}
        >
          Chat Control
        </button>
      </div>

      {tab === 'chat' && (
        <section className="mc-card mc-chat-card">
          <MonitorChat
            messages={messages}
            onSend={handleSend}
            controlState={controlState}
            onStop={handleStop}
          />
        </section>
      )}

      <MonitorConnectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        agentState={agentState}
        checkingAgent={checkingAgent}
        onRecheck={runDetect}
        provider={provider}
        onProviderChange={setProvider}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        testState={testState}
        testError={testError}
        onTestConnection={handleTestConnection}
      />
    </div>
  );
}
