import React, { useState } from 'react';
import { Modal } from './Modal';
import { AIProviderModal } from './AIProviderModal';
import type { ProviderConnection, ProviderId } from './types';

export function CodingConnectionModal({ token, providers, onClose, onChanged, onSelect }: {
  token: string | null;
  providers: ProviderConnection[];
  onClose: () => void;
  onChanged: () => void;
  onSelect: (provider: ProviderId) => void;
}) {
  const [api, setApi] = useState<ProviderId | null>(null);
  const [unavailable, setUnavailable] = useState('');
  if (api) return <AIProviderModal token={token} providers={providers} initialProvider={api}
    onClose={() => setApi(null)} onChanged={onChanged} onConnected={onSelect} />;
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
        return <div className="mm-row" key={provider}><span>{label}</span><div>
          {connected && <button type="button" className="mm-btn" onClick={() => { onSelect(provider); onClose(); }}>Use {label}</button>}
          <button type="button" className="mm-link" onClick={() => setApi(provider)}>{connected ? 'Manage key' : 'Connect API Key'}</button>
        </div></div>;
      })}
    </div>
  </Modal>;
}
