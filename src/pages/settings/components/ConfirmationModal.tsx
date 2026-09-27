import React, { useEffect, useRef } from 'react';

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small confirm/cancel dialog reused by every destructive action in Settings. */
export function ConfirmationModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger,
  busy,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="stg-modal-overlay" onClick={onCancel}>
      <div
        className="stg-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="stg-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="stg-modal-title" className="stg-modal__title">
          {title}
        </h2>
        <div className="stg-modal__body">{body}</div>
        <div className="stg-modal__actions">
          <button type="button" className="stg-btn stg-btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`stg-btn ${danger ? 'stg-btn--danger' : 'stg-btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
