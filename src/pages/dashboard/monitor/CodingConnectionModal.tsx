import React, { useState } from 'react';
import { Modal } from './Modal';
import { AIProviderModal } from './AIProviderModal';
import type { ProviderConnection, ProviderId } from './types';

export function CodingConnectionModal({ token, providers, selectedProvider, onClose, onChanged, onSelect }: {
  token: string | null;
  providers: ProviderConnection[];
  selectedProvider?: ProviderId | null;
  onClose: () => void;
  onChanged: () => void;
  onSelect: (provider: ProviderId) => void;
}) {
  const [api, setApi] = useState<ProviderId | null>(null);
  const [unavailable, setUnavailable] = useState('');
  if (api) return <AIProviderModal token={token} providers={providers} initialProvider={api}
    onClose={() => setApi(null)} onChanged={onChanged} onConnected={provider => { onSelect(provider); setApi(null); }} />;
  return <Modal title="Connect coding agent" onClose={onClose}>
    <div className="mm-stack">
      {['Codex', 'Claude Code'].map(name => <div className="mm-row" key={name}>
        <div><strong>{name}</strong><p className="mm-note">Use your {name === 'Codex' ? 'Codex' : 'Claude'} access</p></div>
        <button type="button" className="mm-btn mm-btn--primary" onClick={() => setUnavailable(name)}>Connect</button>
      </div>)}
      {unavailable && <div role="status"><strong>Integration not available</strong><p className="mm-note">{unavailable} is not connected. This Launchly server does not have a coding runtime configured.</p></div>}
      <div className="mt-menu__sep" />
      <strong>API</strong>
      <p className="mm-note">Optional. API usage is billed separately and starts only when you choose it.</p>
      {(['openai', 'anthropic'] as const).map(provider => {
        const connected = providers.some(p => p.provider === provider && p.connected);
        const label = provider === 'openai' ? 'OpenAI API' : 'Anthropic API';
        const selected = connected && selectedProvider === provider;
        return <div className={`mm-row mm-provider ${selected ? 'is-selected' : ''}`} key={provider}><span className="mm-provider-label"><i className={`mm-provider-dot ${selected ? 'is-selected' : ''}`} aria-hidden="true" />{label}<small>{selected ? 'Selected' : connected ? 'Key saved' : 'Not connected'}</small></span><div className="mm-provider-actions">
          <button type="button" className="mm-btn" aria-label={connected ? `Use ${label}` : `Connect API Key for ${label}`} aria-pressed={selected} onClick={() => connected ? onSelect(provider) : setApi(provider)}>Connect API Key</button>
          {connected && <button type="button" className="mm-link" onClick={() => setApi(provider)}>Manage key</button>}
        </div></div>;
      })}
    </div>
  </Modal>;
}
