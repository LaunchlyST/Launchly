import React, { useState } from 'react';
import { Check, KeyRound, LoaderCircle } from 'lucide-react';
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
  const [state, setState] = useState<{ kind: 'idle' | 'testing' | 'saving' | 'ok' | 'error'; text?: string }>({ kind: 'idle' });
  const current = (providers ?? []).find((p) => p.provider === provider);
  const meta = PROVIDERS.find((p) => p.id === provider)!;

  async function test() {
    setState({ kind: 'testing' });
    const r = await monitorApi.testProvider(token, provider, key.trim());
    setState(r.ok ? (r.data.valid ? { kind: 'ok', text: 'Key works.' } : { kind: 'error', text: 'The provider rejected this key.' }) : { kind: 'error', text: r.message });
  }
  async function save() {
    setState({ kind: 'saving' });
    const r = await monitorApi.saveProvider(token, provider, key.trim());
    if (!r.ok) return setState({ kind: 'error', text: r.message });
    setKey('');
    setState({ kind: 'ok', text: `Connected · key ending ${r.data.keyLast4}` });
    onChanged();
    onConnected?.(provider);
  }
  async function remove() {
    const r = await monitorApi.removeProvider(token, provider);
    if (!r.ok) return setState({ kind: 'error', text: r.message });
    setState({ kind: 'idle' });
    onChanged();
  }

  const busy = state.kind === 'testing' || state.kind === 'saving';
  return (
    <Modal title="Connect AI" subtitle="Use your own provider key. It’s stored encrypted on the server and never shown again." onClose={onClose}>
      <div className="mm-seg" role="tablist">
        {PROVIDERS.filter(p => p.id !== 'xai').map((p) => {
          const on = (providers ?? []).some((c) => c.provider === p.id && c.connected);
          return (
            <button key={p.id} type="button" role="tab" disabled={busy} aria-selected={provider === p.id} className={provider === p.id ? 'is-on' : ''} onClick={() => { setProvider(p.id); setKey(''); setState({ kind: 'idle' }); }}>
              {p.name}
              {on && <Check size={12} aria-label="Key saved" />}
            </button>
          );
        })}
      </div>

      {current?.connected && (
        <div className="mm-row">
          <span className="mm-row__label">
            <Check size={14} /> Connected · key ending <code>{current.keyLast4}</code>
          </span>
          <button type="button" className="mm-link mm-link--danger" onClick={remove}>
            Remove
          </button>
        </div>
      )}

      <label className="mm-field">
        <span>{current?.connected ? 'Replace API key' : 'API key'}</span>
        <div className="mm-input">
          <KeyRound size={14} />
          <input type="password" autoComplete="off" spellCheck={false} placeholder={meta.keyHint} value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
      </label>

      {state.text && <p className={`mm-note ${state.kind === 'error' ? 'mm-note--error' : 'mm-note--ok'}`}>{state.text}</p>}
      {!token && <Unavailable>Sign in to connect a provider.</Unavailable>}

      <div className="mm-actions">
        <button type="button" className="mm-btn" disabled={!key.trim() || busy} onClick={test}>
          {state.kind === 'testing' && <LoaderCircle size={13} className="spin" />} Test connection
        </button>
        <button type="button" className="mm-btn mm-btn--primary" disabled={!key.trim() || busy} onClick={save}>
          {state.kind === 'saving' && <LoaderCircle size={13} className="spin" />} Connect
        </button>
      </div>
    </Modal>
  );
}
