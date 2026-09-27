import React from 'react';
import { Bell, Bot, CreditCard, KeyRound, Monitor, Palette, Shield, UserRound } from 'lucide-react';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './types';

interface SettingsNavProps {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}

const ICONS: Partial<Record<SettingsSectionId, typeof Bell>> = {
  account: UserRound,
  notifications: Bell,
  privacy: Shield,
  billing: CreditCard,
  'api-keys': KeyRound,
  'ai-preferences': Bot,
  appearance: Palette,
  'monitor-control': Monitor,
};

const GROUPS: { label: string; ids: SettingsSectionId[] }[] = [
  { label: 'Account', ids: ['account', 'notifications', 'privacy'] },
  { label: 'Workspace', ids: ['billing', 'api-keys', 'ai-preferences', 'appearance', 'monitor-control'] },
];

/** Settings' own sub-navigation, grouped like the rest of the dashboard. */
export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  return (
    <nav className="stg-nav" aria-label="Settings sections">
      {GROUPS.map((g) => (
        <div key={g.label} className="stg-nav__group">
          <span className="stg-nav__group-label">{g.label}</span>
          {g.ids
            .map((id) => SETTINGS_SECTIONS.find((s) => s.id === id))
            .filter((s): s is (typeof SETTINGS_SECTIONS)[number] => !!s)
            .map((s) => {
              const Icon = ICONS[s.id] ?? UserRound;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`stg-nav__item ${active === s.id ? 'is-active' : ''}`}
                  onClick={() => onSelect(s.id)}
                  aria-current={active === s.id ? 'page' : undefined}
                >
                  <Icon size={15} strokeWidth={1.8} />
                  {s.label}
                </button>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
