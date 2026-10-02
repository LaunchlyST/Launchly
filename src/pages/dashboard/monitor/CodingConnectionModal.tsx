import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
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
  if (api) return <AIProviderModal token={token} providers={providers} initialProvider={api}
    onClose={() => setApi(null)} onChanged={onChanged} onConnected={provider => { onSelect(provider); setApi(null); }} />;
  return <Modal title="Connect coding agent" onClose={onClose}>
    <div className="mm-stack">
      <div className="mm-row">
        <div><strong>Codex</strong><p className="mm-note">OpenAI does not offer an official third-party OAuth flow that lets apps use your ChatGPT/Codex subscription. Sign in on OpenAI&apos;s site, then connect with your own API key below.</p></div>
        <a className="mm-btn" href="https://chat.openai.com/auth/login" target="_blank" rel="noreferrer">Open sign-in <ExternalLink size={12} /></a>
      </div>
      <div className="mm-row">
        <div><strong>Claude Code</strong><p className="mm-note">Anthropic does not offer an official third-party flow that lets apps bill to your Claude subscription. Sign in on Anthropic&apos;s site, then connect with your own API key below. We never ask for login cookies or session tokens.</p></div>
        <a className="mm-btn" href="https://claude.ai/login" target="_blank" rel="noreferrer">Open sign-in <ExternalLink size={12} /></a>
      </div>
      <div className="mt-menu__sep" />
      <strong>API</strong>
      <p className="mm-note">Bring your own key. It is sent once over HTTPS, stored encrypted on the server, and never shown again. API usage is billed separately by the provider.</p>
      {(['openai', 'anthropic'] as const).map(provider => {
        const connected = providers.some(p => p.provider === provider && p.connected);
        const label = provider === 'openai' ? 'OpenAI API' : 'Anthropic API';
        const selected = connected && selectedProvider === provider;
        return <div className={`mm-row mm-provider ${selected ? 'is-selected' : ''}`} key={provider}><span className="mm-provider-label"><i className={`mm-provider-dot ${selected ? 'is-selected' : ''}`} aria-hidden="true" />{label}<small>{selected ? 'Selected — controls Monitor sessions' : connected ? 'Key saved' : 'Not connected'}</small></span><div className="mm-provider-actions">
          <button type="button" className="mm-btn" aria-label={connected ? `Use ${label}` : `Connect API Key for ${label}`} aria-pressed={selected} onClick={() => connected ? onSelect(provider) : setApi(provider)}>Connect API Key</button>
          {connected && <button type="button" className="mm-link" onClick={() => setApi(provider)}>Manage key</button>}
        </div></div>;
      })}
    </div>
  </Modal>;
}
