import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Check, KeyRound, Loader2, AlertTriangle } from 'lucide-react';
import { testProviderKey, ProviderTestError, type ProviderId } from '../providerService';

export type KeyTestState = 'idle' | 'testing' | 'ok' | 'invalid' | 'failed';

interface ApiKeyProviderCardProps {
  provider: ProviderId;
  title: string;
  subtitle: string;
  value: string;
  onSave: (key: string) => void;
  placeholder: string;
}

/** One provider's API-key card: save, show/hide, copy, and an honest test-connection. */
export function ApiKeyProviderCard({
  provider,
  title,
  subtitle,
  value,
  onSave,
  placeholder,
}: ApiKeyProviderCardProps) {
  const [draft, setDraft] = useState(value);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testState, setTestState] = useState<KeyTestState>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const configured = value.length > 0;

  const handleSave = () => {
    onSave(draft.trim());
    setSaved(true);
    setTestState('idle');
    setTimeout(() => setSaved(false), 1500);
  };

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied — nothing to fall back to safely */
    }
  };

  const handleTest = async () => {
    setTestState('testing');
    setTestMessage(null);
    try {
      await testProviderKey(provider, draft || value);
      setTestState('ok');
    } catch (err) {
      setTestState(err instanceof ProviderTestError && /not available/i.test(err.message) ? 'failed' : 'invalid');
      setTestMessage(err instanceof Error ? err.message : 'Could not test this key.');
    }
  };

  return (
    <div className="stg-provider-card">
      <div className="stg-provider-card__head">
        <div>
          <h3 className="stg-provider-card__title">{title}</h3>
          <p className="stg-provider-card__subtitle">{subtitle}</p>
        </div>
        <span
          className={`stg-provider-status ${configured ? 'is-ok' : ''} ${
            testState === 'invalid' || testState === 'failed' ? 'is-bad' : ''
          }`}
        >
          {testState === 'testing'
            ? 'Testing…'
            : testState === 'invalid'
              ? 'Invalid'
              : testState === 'failed'
                ? 'Connection failed'
                : configured
                  ? 'Configured'
                  : 'Not configured'}
        </span>
      </div>

      <label className="stg-field-label" htmlFor={`stg-key-${provider}`}>
        API key
      </label>
      <div className="stg-key-row">
        <div className="stg-key-input-wrap">
          <KeyRound size={16} className="stg-key-input__icon" />
          <input
            id={`stg-key-${provider}`}
            className="stg-key-input"
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="stg-key-eye"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide key' : 'Show key'}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button type="button" className="stg-btn stg-btn--ghost stg-btn--icon" onClick={handleCopy} disabled={!value} aria-label="Copy key">
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
        <button type="button" className="stg-btn stg-btn--primary" onClick={handleSave}>
          {saved ? <Check size={15} /> : 'Save key'}
        </button>
      </div>

      <div className="stg-provider-card__footer">
        <button
          type="button"
          className="stg-btn stg-btn--ghost stg-btn--sm"
          onClick={handleTest}
          disabled={testState === 'testing' || !(draft || value)}
        >
          {testState === 'testing' && <Loader2 size={13} className="stg-spin" />}
          Test connection
        </button>
        {testMessage && (testState === 'invalid' || testState === 'failed') && (
          <span className="stg-provider-card__hint">
            <AlertTriangle size={12} /> {testMessage}
          </span>
        )}
        {testState === 'ok' && <span className="stg-provider-card__hint is-ok">Key looks good.</span>}
      </div>
    </div>
  );
}
