import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Small centred dialog in Monitor's visual language. Esc / backdrop closes it. */
export function Modal({ title, subtitle, onClose, children, width = 440 }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="mm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mm-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} style={{ maxWidth: width }}>
        <header className="mm-dialog__head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="mv-tool" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </header>
        <div className="mm-dialog__body">{children}</div>
      </div>
    </div>
  );
}

/** Honest "not available yet" line used wherever a backend piece isn't configured. */
export function Unavailable({ children }: { children: React.ReactNode }) {
  return <p className="mm-note mm-note--muted">{children}</p>;
}
