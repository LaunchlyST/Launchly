import { useCallback, useEffect, useRef, useState } from 'react';
import { Bug, ChevronDown, MessageSquare, Send, Sparkles } from 'lucide-react';
import './feedback-menu.css';

/**
 * Where the three items point. Nothing here is invented: an item with no
 * destination configured renders as unavailable rather than as a button that
 * looks live and does nothing.
 *
 *   VITE_FEEDBACK_EMAIL=hello@example.com
 *   VITE_BUG_URL=https://github.com/owner/repo/issues/new   (falls back to the email)
 *   VITE_CHANGELOG_URL=https://example.com/changelog
 */
const EMAIL = (import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined)?.trim() || '';
const BUG_URL = (import.meta.env.VITE_BUG_URL as string | undefined)?.trim() || '';
const CHANGELOG_URL = (import.meta.env.VITE_CHANGELOG_URL as string | undefined)?.trim() || '';

const mailto = (subject: string) =>
  EMAIL ? `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}` : '';

interface Item {
  id: string;
  label: string;
  icon: typeof Send;
  href: string;
  external?: boolean;
}

const ITEMS: Item[] = [
  { id: 'feedback', label: 'Send feedback', icon: Send, href: mailto('Launchly feedback') },
  {
    id: 'bug',
    label: 'Report a bug',
    icon: Bug,
    href: BUG_URL || mailto('Launchly bug report'),
    external: Boolean(BUG_URL),
  },
  { id: 'news', label: "What's new", icon: Sparkles, href: CHANGELOG_URL, external: true },
];

/**
 * The top-right control.
 *
 * Adapted from Uiverse.io by aadium (Buttons/aadium_massive-seahorse-39, MIT):
 * a trigger with an absolutely positioned panel beneath it. Restyled to the
 * frosted ivory language of the scene.
 */
export function FeedbackMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  /* Escape and outside click. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, close]);

  /* Focus moves into the panel on open. */
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>('a, button:not(:disabled)');
    first?.focus();
  }, [open]);

  /* Up/Down walk the items; Tab out closes. */
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('a, button:not(:disabled)') ?? []
    );
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div className="fm" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`fm__trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MessageSquare size={15} strokeWidth={1.9} />
        <span className="fm__trigger-label">Feedback &amp; updates</span>
        <ChevronDown className="fm__chevron" size={14} strokeWidth={2.2} />
      </button>

      {open && (
        <div
          className="fm__panel"
          role="menu"
          ref={panelRef}
          onKeyDown={onPanelKeyDown}
          aria-label="Feedback and updates"
        >
          {ITEMS.map(({ id, label, icon: Icon, href, external }) =>
            href ? (
              <a
                key={id}
                className="fm__item"
                role="menuitem"
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
                onClick={() => close()}
              >
                <Icon size={15} strokeWidth={1.9} />
                <span>{label}</span>
              </a>
            ) : (
              <button
                key={id}
                type="button"
                className="fm__item"
                role="menuitem"
                disabled
                title="No destination is configured for this yet"
              >
                <Icon size={15} strokeWidth={1.9} />
                <span>{label}</span>
                <span className="fm__item-note">not set up</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
