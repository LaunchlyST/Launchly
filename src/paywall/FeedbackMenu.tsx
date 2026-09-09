import { Bug, Sparkles, Upload } from 'lucide-react';
import './feedback-menu.css';

/**
 * Where the three controls point. Nothing here is invented: a control with no
 * destination configured is disabled rather than looking live and doing
 * nothing.
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

interface Control {
  id: string;
  label: string;
  icon: typeof Upload;
  href: string;
  external?: boolean;
}

const CONTROLS: Control[] = [
  { id: 'feedback', label: 'Send feedback', icon: Upload, href: mailto('Launchly feedback') },
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
 * Feedback and updates, top right.
 *
 * Adapted from Uiverse.io by Bodyhc (MIT): one rounded, bordered group with
 * hairline dividers between icon buttons, each button lifting to a soft hover
 * fill. Kept white against the sky, with the label carried by a tooltip rather
 * than a popover so the control stays small.
 */
export function FeedbackMenu() {
  return (
    <div className="fm" role="group" aria-label="Feedback and updates">
      {CONTROLS.map(({ id, label, icon: Icon, href, external }) =>
        href ? (
          <a
            key={id}
            className="fm__btn"
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer' : undefined}
            aria-label={label}
          >
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <span className="fm__tip">{label}</span>
          </a>
        ) : (
          <button
            key={id}
            type="button"
            className="fm__btn"
            disabled
            aria-label={`${label} — no destination configured`}
          >
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <span className="fm__tip">{label} — not set up</span>
          </button>
        )
      )}
    </div>
  );
}
