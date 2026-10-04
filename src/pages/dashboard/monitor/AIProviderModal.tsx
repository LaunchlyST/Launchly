import React, { useState } from 'react';
import { Check, KeyRound, LoaderCircle, Link2, UserCheck } from 'lucide-react';
import { Modal, Unavailable } from './Modal';
import { monitorApi, PROVIDERS } from './monitorApi';
import type { ProviderConnection, ProviderId } from './types';

interface Props {
  token: string | null;
  providers: ProviderConnection[];
  initialProvider?: ProviderId;
  onClose: () => void;
  onChanged: () => void;
  onConnected?: (provider: ProviderId) => void;
}

/**
 * Connect AI. The key is sent once over HTTPS to the backend, which stores it
 * encrypted. It is never saved in the browser and never sent back — the UI
 * only ever sees { connected, keyLast4 }.
 */
export function AIProviderModal({ token, providers, initialProvider = 'anthropic', onClose, onChanged, onConnected }: Props) {
  const [provider, setProvider] = useState<ProviderId>(initialProvider);
  const [key, setKey] = useState('');
  const [connectionType, setConnectionType] = useState<'api' | 'subscription'>('api');
  const [state, setState] = useState<{ kind: 'idle' | 'testing' | 'saving' | 'ok' | 'error'; text?: string }>({ kind: 'idle' });
  const current = (providers ?? []).find((p) => p.provider === provider && p.connectionType === connectionType);
  const meta = PROVIDERS.find((p) => p.id === provider)!;

  async function test() {
    setState({ kind: 'testing' });
    if (connectionType === 'api') {
      const r = await monitorApi.testProvider(token, provider, key.trim(), 'api');
      setState(r.ok ? (r.data.valid ? { kind: 'ok', text: 'Key works.' } : { kind: 'error', text: 'The provider rejected this key.' }) : { kind: 'error', text: r.message });
    } else {
      setState({ kind: 'ok', text: 'Subscription connection would be tested via OAuth.' });
    }
  }
  async function save() {
    setState({ kind: 'saving' });
    if (connectionType === 'api') {
      const r = await monitorApi.saveProvider(token, provider, key.trim(), 'api');
      if (!r.ok || !r.data?.connected || r.data.provider !== provider) return setState({ kind: 'error', text: r.message ?? 'The provider connection could not be verified.' });
      setKey('');
      setState({ kind: 'ok', text: `Connected · key ending ${r.data.keyLast4}` });
    } else {
      setState({ kind: 'error', text: 'Subscription OAuth not yet implemented. Use API key for now.' });
    }
    onChanged();
    onConnected?.(provider);
  }
  async function remove() {
    const r = await monitorApi.removeProvider(token, provider, connectionType);
    if (!r.ok) return setState({ kind: 'error', text: r.message });
    setState({ kind: 'idle' });
    onChanged();
  }

  const busy = state.kind === 'testing' || state.kind === 'saving';
  return (
    <Modal title="Connect AI" subtitle="Use your own provider key or subscription. It's stored encrypted on the server and never shown again." onClose={onClose}>
      <div className="mm-seg" role="tablist">
        {PROVIDERS.filter(p => p.id !== 'xai').map((p) => {
          const onApi = (providers ?? []).some((c) => c.provider === p.id && c.connectionType === 'api' && c.connected);
          const onSub = (providers ?? []).some((c) => c.provider === p.id && c.connectionType === 'subscription' && c.connected);
          return (
            <button key={p.id} type="button" role="tab" disabled={busy} aria-selected={provider === p.id} className={provider === p.id ? 'is-on' : ''} onClick={() => { setProvider(p.id); setKey(''); setState({ kind: 'idle' }); }}>
              {p.name}
              {(onApi || onSub) && <Check size={12} aria-label="Connected" />}
            </button>
          );
        })}
      </div>

      <div className="mm-seg mm-seg--small" role="tablist" style={{marginBottom: 16}}>
        <button type="button" role="tab" disabled={busy} aria-selected={connectionType === 'api'} className={connectionType === 'api' ? 'is-on' : ''} onClick={() => { setConnectionType('api'); setKey(''); setState({ kind: 'idle' }); }}>
          <KeyRound size={12} /> API Key
        </button>
        <button type="button" role="tab" disabled={busy} aria-selected={connectionType === 'subscription'} className={connectionType === 'subscription' ? 'is-on' : ''} onClick={() => { setConnectionType('subscription'); setKey(''); setState({ kind: 'idle' }); }}>
          <UserCheck size={12} /> Subscription
        </button>
      </div>

      {current?.connected && (
        <div className="mm-row">
          <span className="mm-row__label">
            <Check size={14} /> Connected · {current.connectionType === 'subscription' ? 'Subscription' : `key ending ${current.keyLast4}`}
          </span>
          <button type="button" className="mm-link mm-link--danger" onClick={remove}>
            Remove
          </button>
        </div>
      )}

      {connectionType === 'api' && (
        <label className="mm-field">
          <span>{current?.connected ? 'Replace API key' : 'API key'}</span>
          <div className="mm-input">
            <KeyRound size={14} />
            <input type="password" autoComplete="off" spellCheck={false} placeholder={meta.keyHint} value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
        </label>
      )}

      {connectionType === 'subscription' && (
        <div className="mm-stack">
          <p className="mm-note mm-note--muted">
            <Link2 size={14} style={{verticalAlign: 'middle', marginRight: 6}} /> Subscription connections use OAuth. 
            <a href="#" onClick={(e) => e.preventDefault()}>Connect your {provider === 'anthropic' ? 'Claude' : 'OpenAI'} account</a> to use your subscription.
          </p>
          <p className="mm-note mm-note--muted">Not yet implemented. Please use API key for now.</p>
        </div>
      )}

      {state.text && <p className={`mm-note ${state.kind === 'error' ? 'mm-note--error' : 'mm-note--ok'}`}>{state.text}</p>}
      {!token && <Unavailable>Sign in to connect a provider.</Unavailable>}

      <div className="mm-actions">
        <button type="button" className="mm-btn" disabled={!token || (connectionType === 'api' && !key.trim()) || busy} onClick={test}>
          {state.kind === 'testing' && <LoaderCircle size={13} className="spin" />} Test connection
        </button>
        <button type="button" className="mm-btn mm-btn--primary" disabled={!token || (connectionType === 'api' && !key.trim()) || busy} onClick={save}>
          {state.kind === 'saving' && <LoaderCircle size={13} className="spin" />} Connect
        </button>
      </div>
    </Modal>
  );
}