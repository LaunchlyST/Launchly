import React, { useEffect, useState } from 'react';
import { Building2, Check, Copy, Eye, EyeOff, KeyRound, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useAuthStore } from '../auth-store';
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
const WORKER_URL: string = (import.meta.env.VITE_WORKER_URL || 'http://localhost:8787').replace(/\/+$/, '');

type Tab = 'keys' | 'account' | 'business';

function AccountTab() {
  const user = useAuthStore((s) => s.user);
  const [plan, setPlan] = useState<{ status: string; periodEnd: string | null } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    fetch(`${WORKER_URL}/api/subscription?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((d) => setPlan({ status: d.subscription_status || d.status || 'inactive', periodEnd: d.subscription_current_period_end || d.current_period_end || null }))
      .catch(() => setError('Could not load your plan right now.'));
  }, [user?.id]);
  return <div className="api-settings-content"><div className="api-settings-intro"><h2>Account</h2><p>Your Launchly login and plan.</p></div>
    <section className="provider-key-card"><dl className="settings-facts"><div><dt>Email</dt><dd>{user?.email || 'Unavailable'}</dd></div><div><dt>Plan</dt><dd>{plan ? (plan.status === 'active' ? 'Active' : plan.status.replace(/_/g, ' ')) : error ? 'Unavailable' : 'Loading…'}</dd></div>{plan?.periodEnd && <div><dt>Renews</dt><dd>{new Date(plan.periodEnd).toLocaleDateString()}</dd></div>}</dl>{error && <p className="provider-key-message">{error}</p>}<div className="provider-key-footer"><span>Billing is handled securely by Stripe.</span><div><a className="provider-key-save" href="/pricing">View plans</a></div></div></section></div>;
}

function BusinessTab() {
  const session = useAuthStore((s) => s.session);
  const [email, setEmail] = useState<{ connected: boolean; configured: boolean } | null>(null);
  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${WORKER_URL}/api/email/status`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((d) => d?.data && setEmail(d.data))
      .catch(() => setEmail({ connected: false, configured: false }));
  }, [session?.access_token]);
  return <div className="api-settings-content"><div className="api-settings-intro"><h2>Business Connect</h2><p>Where business data comes from and how outreach is sent.</p></div>
    <section className="provider-key-card"><dl className="settings-facts"><div><dt>Business data</dt><dd>OpenStreetMap (free). Ratings and photos appear when Google Places is enabled on the server.</dd></div><div><dt>Social links & emails</dt><dd>Only shown when found on the business’s own website or listing. Never guessed.</dd></div><div><dt>Ad budgets & needs</dt><dd>Rules-based estimates, not real spend.</dd></div><div><dt>Gmail</dt><dd>{email ? (email.connected ? 'Connected' : email.configured ? 'Not connected' : 'Coming soon — drafts are saved to each lead') : 'Checking…'}</dd></div></dl></section></div>;
}

export function ApiSettingsPage() {
  const openaiKey = useStore(s => s.openaiKey);
  const grokKey = useStore(s => s.grokKey);
  const setOpenaiKey = useStore(s => s.setOpenaiKey);
  const setGrokKey = useStore(s => s.setGrokKey);
  const [tab, setTab] = useState<Tab>('keys');
  const tabs: [Tab, string, typeof KeyRound][] = [['keys', 'API keys', KeyRound], ['account', 'Account', UserRound], ['business', 'Business Connect', Building2]];
  return <div className="api-settings-page"><header><span className="eyebrow">WORKSPACE SETTINGS</span><h1>Settings</h1><p>Manage your account, AI providers and Launchly tools.</p></header><div className="api-settings-tabs" role="tablist">{tabs.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}><Icon size={15}/> {label}</button>)}</div>{tab === 'account' ? <AccountTab/> : tab === 'business' ? <BusinessTab/> : <div className="api-settings-content"><div className="api-settings-intro"><h2>API keys</h2><p>Bring your own ChatGPT or Grok key. Manage each provider below.</p></div><ProviderKey name="ChatGPT" provider="OpenAI · Image generation" value={openaiKey} save={setOpenaiKey} placeholder="Enter your OpenAI API key"/><ProviderKey name="Grok" provider="xAI · Video generation" value={grokKey} save={setGrokKey} placeholder="Enter your xAI API key"/><aside className="api-key-guidance"><h3><ShieldCheck size={16}/> Keep your keys private</h3><p>Keys are saved in this browser and sent to the selected provider when you generate content. A saved key has not been verified. Usage and billing are managed by your provider.</p></aside></div>}</div>;
}
