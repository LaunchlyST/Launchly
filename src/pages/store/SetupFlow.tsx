import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, LoaderCircle, Music2 } from 'lucide-react';
import type { SetupState } from './store';
import { storeShareUrl } from './store';

interface SetupFlowProps {
  setup: SetupState;
  onPatch: (patch: Partial<SetupState>) => void;
  onNext: () => void;
  onBack: () => void;
  onVerify: () => void;
  onRegenerate: () => void;
  onConnectTikTok?: () => Promise<boolean>;
}

export function SetupFlow({ setup, onPatch, onNext, onBack, onVerify, onRegenerate, onConnectTikTok }: SetupFlowProps) {
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectHint, setConnectHint] = useState('');
  const canContinue = setup.username.trim().replace(/^@+/, '').length >= 2;

  async function connectTikTok() {
    if (!onConnectTikTok || connecting) return;
    setConnecting(true);
    setConnectHint('');
    try {
      const started = await onConnectTikTok();
      if (!started) {
        setConnectHint('TikTok Login Kit is not configured yet — continue with the verification code.');
      }
    } finally {
      setConnecting(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(setup.code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = setup.code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="cs-step" key={setup.step}>
      {setup.step === 1 && (
        <>
          <p className="cs-step__eyebrow">Step 1 of 5</p>
          <h2 className="cs-step__title">What&rsquo;s your TikTok username?</h2>
          <p className="cs-step__sub">We&rsquo;ll link this account to your new Creator Store.</p>
          <div className="cs-fieldwrap">
            <span className="cs-at" aria-hidden="true">@</span>
            <input
              className="cs-input"
              aria-label="TikTok username"
              placeholder="yourhandle"
              autoComplete="off"
              spellCheck={false}
              maxLength={24}
              value={setup.username}
              onChange={(e) => onPatch({ username: e.target.value.replace(/[^a-zA-Z0-9_.]/g, '') })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canContinue) onNext();
              }}
              autoFocus
            />
          </div>
          <button type="button" className="cs-btn-primary" disabled={!canContinue} onClick={onNext}>
            Continue <ArrowRight size={15} />
          </button>
        </>
      )}

      {setup.step === 2 && (
        <>
          <p className="cs-step__eyebrow">Step 2 of 5</p>
          <h2 className="cs-step__title">Here&rsquo;s your verification code</h2>
          <p className="cs-step__sub">You&rsquo;ll paste this into your TikTok bio so we know it&rsquo;s really you.</p>
          <div className="cs-codebox">
            <code>{setup.code || '••••••••'}</code>
            <button type="button" className="cs-btn-ghost" onClick={copyCode} aria-label="Copy verification code">
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="cs-step__actions">
            <button type="button" className="cs-btn-quiet" onClick={onBack}>
              <ArrowLeft size={14} /> Back
            </button>
            <button type="button" className="cs-btn-primary" onClick={onNext}>
              I&rsquo;ve got it <ArrowRight size={15} />
            </button>
          </div>
          <button type="button" className="cs-link" onClick={onRegenerate}>
            Generate a new code
          </button>
        </>
      )}

      {setup.step === 3 && (
        <>
          <p className="cs-step__eyebrow">Step 3 of 5</p>
          <h2 className="cs-step__title">Add the code to your TikTok bio</h2>
          <ol className="cs-howto">
            <li>Open TikTok and go to your profile</li>
            <li>Tap <strong>Edit profile</strong>, then <strong>Bio</strong></li>
            <li>
              Paste <code className="cs-inlinecode">{setup.code}</code> and save
            </li>
          </ol>
          <div className="cs-step__actions">
            <button type="button" className="cs-btn-quiet" onClick={onBack}>
              <ArrowLeft size={14} /> Back
            </button>
            <button type="button" className="cs-btn-primary" onClick={onNext}>
              I&rsquo;ve added it <ArrowRight size={15} />
            </button>
          </div>
          <p className="cs-step__hint">
            Your store link <strong>{storeShareUrl(setup.username)}</strong> goes in the bio right after — we&rsquo;ll
            show it again in the designer.
          </p>
        </>
      )}

      {setup.step === 4 && (
        <>
          <p className="cs-step__eyebrow">Step 4 of 5</p>
          <h2 className="cs-step__title">Verify your connection</h2>
          <p className="cs-step__sub">
            We&rsquo;ll check <strong>@{setup.username}</strong>&rsquo;s bio for the code.
          </p>
          <button
            type="button"
            className="cs-btn-primary cs-btn-primary--lg"
            disabled={setup.verifying}
            onClick={onVerify}
          >
            {setup.verifying ? (
              <>
                <LoaderCircle size={16} className="cs-spin" /> Checking your bio…
              </>
            ) : (
              <>Verify now</>
            )}
          </button>
          <p className="cs-step__hint">or connect officially — profile imports automatically</p>
          <button
            type="button"
            className="cs-btn-ghost"
            disabled={connecting || setup.verifying}
            onClick={connectTikTok}
            title="Connect with TikTok Login Kit (user.info.basic + user.info.profile)"
          >
            {connecting ? (
              <>
                <LoaderCircle size={15} className="cs-spin" /> Opening TikTok…
              </>
            ) : (
              <>
                <Music2 size={15} /> Connect with TikTok
              </>
            )}
          </button>
          {connectHint && <p className="cs-step__hint">{connectHint}</p>}
          <div className="cs-step__actions cs-step__actions--single">
            <button type="button" className="cs-btn-quiet" disabled={setup.verifying} onClick={onBack}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </>
      )}

      {setup.step === 5 && (
        <div className="cs-success">
          <span className="cs-success__ring" aria-hidden="true">
            <Check size={30} strokeWidth={3} />
          </span>
          <h2 className="cs-step__title">TikTok Connected ✓</h2>
          <p className="cs-step__sub">
            <strong>@{setup.username}</strong> is linked. Opening your store designer…
          </p>
        </div>
      )}
    </div>
  );
}
