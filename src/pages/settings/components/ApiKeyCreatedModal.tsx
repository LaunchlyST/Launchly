import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface ApiKeyCreatedModalProps {
  apiKey: string | null;
  onDone: () => void;
}

/** Shows a freshly-created API key exactly once. Closing it forgets the secret for good. */
export function ApiKeyCreatedModal({ apiKey, onDone }: ApiKeyCreatedModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [apiKey, onDone]);

  if (!apiKey) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied */
    }
  };

  return (
    <div className="stg-modal-overlay">
      <div className="stg-modal" role="alertdialog" aria-modal="true" aria-labelledby="stg-key-modal-title">
        <h2 id="stg-key-modal-title" className="stg-modal__title">
          API key created
        </h2>
        <p className="stg-modal__body">
          Copy this key now. For security, you will not be able to view the full key again.
        </p>
        <div className="stg-secret-box">{apiKey}</div>
        <div className="stg-modal__actions">
          <button type="button" className="stg-btn stg-btn--ghost" onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy API Key'}
          </button>
          <button type="button" className="stg-btn stg-btn--primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
