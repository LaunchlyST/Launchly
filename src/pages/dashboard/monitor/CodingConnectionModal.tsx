import React, { useState } from 'react';
import { Check, LoaderCircle, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';
import { AIProviderModal } from './AIProviderModal';
import type { LocalCliStatus } from './monitorApi';
import type { ProviderConnection, ProviderId } from './types';

export function CodingConnectionModal({ token, providers, selectedProvider, localCli, localCliLoading, deviceOnline, onClose, onChanged, onSelect, onSelectLocal, onRefreshLocal, onOpenDevice }: {
  token: string | null;
  providers: ProviderConnection[];
  selectedProvider?: ProviderId | null;
  localCli?: LocalCliStatus | null;
  localCliLoading?: boolean;
  deviceOnline?: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenDevice?: () => void;
  onSelect: (provider: ProviderId) => void | Promise<void>;
  onSelectLocal?: (provider: ProviderId) => void | Promise<void>;
  onRefreshLocal?: () => void;
}) {
  const [api, setApi] = useState<ProviderId | null>(null);
  if (api) return <AIProviderModal token={token} providers={providers} initialProvider={api}
    onClose={() => setApi(null)} onChanged={onChanged} onConnected={provider => { onSelect(provider); setApi(null); }} />;

  const localRows: { provider: ProviderId; cli: 'claude' | 'codex'; title: string; loginCmd: string }[] = [
    { provider: 'openai', cli: 'codex', title: 'Codex CLI (your ChatGPT subscription, on your computer)', loginCmd: 'codex login' },
    { provider: 'anthropic', cli: 'claude', title: 'Claude Code (your Claude subscription, on your computer)', loginCmd: 'claude auth login' },
  ];

  return <Modal title="Connect coding agent" onClose={onClose}>
    <div className="mm-stack">
      <strong>Subscription on this computer</strong>
      <p className="mm-note">Runs the provider's official CLI on your own computer through the Launchly device agent. Your login never leaves your computer — Launchly only sends the task and receives the result. Billed to your own subscription.</p>
      {!deviceOnline && (
        <p className="mm-note mm-note--muted">Connect your computer first — Launchly detects installed CLIs on the paired device. <button type="button" className="mm-link" onClick={onOpenDevice}>Connect computer</button></p>
      )}
      {localRows.map(({ provider, cli, title, loginCmd }) => {
        const st = localCli?.[cli];
        return <div className="mm-row" key={provider}>
          <div><strong>{title}</strong>
            <p className="mm-note">{!deviceOnline ? 'Computer offline.' : localCliLoading ? 'Checking…' : !st ? 'Not checked yet.' : st.authenticated ? 'Logged in on this computer.' : st.installed ? 'Installed but not logged in.' : 'Not installed on this computer.'}</p>
            {st && deviceOnline && !st.authenticated && <p className="mm-note"><code>{st.installed ? loginCmd : cli === 'codex' ? 'Install Codex CLI, then run `codex login`' : 'Install Claude Code, then run `claude auth login`'}</code></p>}
          </div>
          <div className="mm-provider-actions">
            <button type="button" className="mm-btn" disabled={!st?.authenticated} onClick={() => onSelectLocal?.(provider)}>Use local</button>
            {onRefreshLocal && <button type="button" className="mm-link" onClick={onRefreshLocal} title="Re-check CLIs on the computer">{localCliLoading ? <LoaderCircle size={13} className="spin" /> : <RefreshCw size={13} />} Recheck</button>}
          </div>
        </div>;
      })}
      <div className="mt-menu__sep" />
      <strong>API</strong>
      <p className="mm-note">Bring your own key. It is sent once over HTTPS, stored encrypted on the server, and never shown again. API usage is billed separately by the provider. Used automatically if local subscription usage hits a limit.</p>
      {(['openai', 'anthropic'] as const).map(provider => {
        const connected = providers.some(p => p.provider === provider && p.connected);
        const label = provider === 'openai' ? 'OpenAI API' : 'Anthropic API';
        const selected = connected && selectedProvider === provider;
        return <div className={`mm-row mm-provider ${selected ? 'is-selected' : ''}`} key={provider}><span className="mm-provider-label"><i className={`mm-provider-dot ${selected ? 'is-selected' : ''}`} aria-hidden="true" />{label}<small>{selected ? 'Selected — controls Monitor sessions' : connected ? 'Key saved' : 'Not connected'}</small></span><div className="mm-provider-actions">
          <button type="button" className="mm-btn" aria-label={connected ? `Use ${label}` : `Connect API Key for ${label}`} aria-pressed={selected} onClick={() => connected ? onSelect(provider) : setApi(provider)}>Connect API Key</button>
          {connected && <button type="button" className="mm-link" onClick={() => setApi(provider)}>Manage key</button>}
        </div></div>;
      })}
      {onOpenDevice && <button type="button" className="mm-btn" onClick={onOpenDevice}>Connect computer control {deviceOnline && <Check size={12} />}</button>}
    </div>
  </Modal>;
}
