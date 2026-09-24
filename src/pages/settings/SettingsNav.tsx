import React from 'react';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './types';

interface SettingsNavProps {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}

/**
 * Settings' own sub-navigation — not the main Launchly rail. A compact
 * vertical list on desktop, a horizontally-scrollable tab row once the
 * viewport is too narrow for it (see the media query in settings.css).
 */
export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  return (
    <nav className="stg-nav" aria-label="Settings sections">
      {SETTINGS_SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`stg-nav__item ${active === s.id ? 'is-active' : ''}`}
          onClick={() => onSelect(s.id)}
          aria-current={active === s.id ? 'page' : undefined}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
