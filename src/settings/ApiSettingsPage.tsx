import React, { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import './api-settings.css';

function ProviderKey({ name, provider, value, save, placeholder }: { name: string; provider: string; value: string; save: (value: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setDraft(value); setVisible(false); }, [value]);
  const changed = draft.trim() !== value;
  async function copy() {
    try { await navigator.clipboard.writeText(value); setMessage('Key copied.'); }
    catch { setMessage('Could not copy. You can reveal and select your key.'); }
  }
  return <section className="provider-key-card"><div className="provider-key-heading"><span className="provider-key-mark">{name === 'ChatGPT' ? 'O' : 'x'}</span><div><h2>{name} API key</h2><p>{provider}</p></div><span className={`provider-key-status ${value ? 'is-saved' : ''}`}><i/>{value ? 'Key saved' : 'Not configured'}</span></div><label className="provider-key-label" htmlFor={`key-${name}`}>API key</label><div className="provider-key-input"><KeyRound size={16}/><input id={`key-${name}`} type={visible ? 'text' : 'password'} value={draft} onChange={e => { setDraft(e.target.value); setMessage(''); }} placeholder={placeholder} autoComplete="off" spellCheck={false} autoCapitalize="none"/><button aria-label={`${visible ? 'Hide' : 'Show'} ${name} key`} title={visible ? 'Hide key' : 'Show key'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div><div className="provider-key-footer"><span>{value ? 'Saved in this browser' : 'Add your key to enable this provider'}</span><div><button disabled={!value} onClick={copy}><Copy size={13}/> Copy</button>{value && <button className="provider-key-remove" onClick={() => { save(''); setDraft(''); setVisible(false); setMessage('Key removed.'); }} aria-label={`Remove ${name} key`}><Trash2 size={14}/></button>}<button className="provider-key-save" disabled={!draft.trim() || !changed} onClick={() => { save(draft.trim()); setVisible(false); setMessage('Key saved.'); }}><Check size={13}/> Save key</button></div></div><p className="provider-key-message" role="status">{message}</p></section>;
}
export function ApiSettingsPage() {
  const openaiKey = useStore(s => s.openaiKey);
  const grokKey = useStore(s => s.grokKey);
  const setOpenaiKey = useStore(s => s.setOpenaiKey);
  const setGrokKey = useStore(s => s.setGrokKey);
  return <div className="api-settings-page"><header><span className="eyebrow">WORKSPACE SETTINGS</span><h1>Settings</h1><p>Manage the AI providers you use in Launchly.</p></header><div className="api-settings-tabs"><span><KeyRound size={15}/> API keys</span></div><div className="api-settings-content"><div className="api-settings-intro"><h2>API keys</h2><p>Bring your own ChatGPT or Grok key. Manage each provider below.</p></div><ProviderKey name="ChatGPT" provider="OpenAI · Image generation" value={openaiKey} save={setOpenaiKey} placeholder="Enter your OpenAI API key"/><ProviderKey name="Grok" provider="xAI · Video generation" value={grokKey} save={setGrokKey} placeholder="Enter your xAI API key"/><aside className="api-key-guidance"><h3><ShieldCheck size={16}/> Keep your keys private</h3><p>Keys are saved in this browser and sent to the selected provider when you generate content. A saved key has not been verified. Usage and billing are managed by your provider.</p></aside></div></div>;
}
