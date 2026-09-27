import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Cpu } from 'lucide-react';
import { PROVIDERS, selectionLabel } from './monitorApi';
import type { ModelInfo, ModelSelection, ProviderConnection, ProviderId } from './types';

interface Props {
  selection: ModelSelection;
  onChange: (s: ModelSelection) => void;
  providers: ProviderConnection[];
  models: ModelInfo[];
  onConnectProvider: () => void;
  onManageKeys: () => void;
}

/** "AI: Auto ▾" — Auto, a provider's Latest, or an exact pinned model. */
export function ModelSelector({ selection, onChange, providers, models, onConnectProvider, onManageKeys }: Props) {
  const [open, setOpen] = useState(false);
  const [exactFor, setExactFor] = useState<ProviderId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const connected = PROVIDERS.filter((p) => (providers ?? []).some((c) => c.provider === p.id && c.connected));
  const pick = (s: ModelSelection) => {
    onChange(s);
    setOpen(false);
    setExactFor(null);
  };
  const isSel = (s: ModelSelection) => JSON.stringify(s) === JSON.stringify(selection);

  return (
    <div className="mt-pop mt-pop--model" ref={ref}>
      <button type="button" className="mt-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Cpu size={13} />
        <span className="mt-btn__text">{selection.mode === 'auto' ? 'AI: Auto' : selectionLabel(selection, models)}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="mt-menu mt-menu--end" role="menu">
          <p className="mt-menu__group">Auto</p>
          <button type="button" role="menuitem" className="mt-item" onClick={() => pick({ mode: 'auto' })}>
            <span className="mt-item__check">{isSel({ mode: 'auto' }) && <Check size={13} />}</span>
            <span>
              <strong>Auto</strong> <em>Latest recommended</em>
              <small>Automatically uses the latest supported coding model from your connected providers.</small>
            </span>
          </button>

          {connected.map((p) => {
            const exact = models.filter((m) => m.provider === p.id && m.available);
            return (
              <div key={p.id}>
                <p className="mt-menu__group">{p.name}</p>
                <button type="button" role="menuitem" className="mt-item" onClick={() => pick({ mode: 'latest', provider: p.id })}>
                  <span className="mt-item__check">{isSel({ mode: 'latest', provider: p.id }) && <Check size={13} />}</span>
                  <span>{p.latestLabel}</span>
                </button>
                {exact.length > 0 && (
                  <button type="button" className="mt-item mt-item--sub" onClick={() => setExactFor(exactFor === p.id ? null : p.id)} aria-expanded={exactFor === p.id}>
                    <span className="mt-item__check" />
                    <span>Choose exact model</span>
                    <ChevronRight size={12} className={exactFor === p.id ? 'is-open' : ''} />
                  </button>
                )}
                {exactFor === p.id &&
                  exact.map((m) => (
                    <button key={m.modelId} type="button" role="menuitem" className="mt-item mt-item--exact" onClick={() => pick({ mode: 'exact', provider: p.id, modelId: m.modelId })}>
                      <span className="mt-item__check">{isSel({ mode: 'exact', provider: p.id, modelId: m.modelId }) && <Check size={13} />}</span>
                      <span>{m.displayName}</span>
                    </button>
                  ))}
              </div>
            );
          })}
          {connected.length === 0 && <p className="mt-menu__empty">No AI providers connected yet.</p>}

          <div className="mt-menu__sep" />
          <button type="button" className="mt-item" onClick={() => { setOpen(false); onConnectProvider(); }}>
            <span className="mt-item__check" />+ Connect AI provider
          </button>
          <button type="button" className="mt-item" onClick={() => { setOpen(false); onManageKeys(); }}>
            <span className="mt-item__check" />Manage API keys
          </button>
        </div>
      )}
    </div>
  );
}
