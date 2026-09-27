import React from 'react';
import { useSettingsStore } from '../settingsStore';
import type { AccentColor, ThemePreference } from '../types';
import { SettingsSection, SettingsCard } from '../components/SettingsSection';
import { SettingsRow, SettingsDivider } from '../components/SettingsRow';
import { SettingsToggle } from '../components/SettingsToggle';

const THEMES: Array<{ id: ThemePreference; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const ACCENTS: Array<{ id: AccentColor; label: string; swatch: string }> = [
  { id: 'blue', label: 'Blue', swatch: '#5b5ef4' },
  { id: 'orange', label: 'Orange', swatch: '#ff7a1a' },
  { id: 'green', label: 'Green', swatch: '#12b76a' },
  { id: 'neutral', label: 'Neutral', swatch: '#5b6174' },
];

export function AppearanceSection() {
  const { settings, update } = useSettingsStore();

  return (
    <SettingsSection title="Appearance" subtitle="Customize how Launchly looks on this device.">
      <SettingsCard title="Theme">
        <SettingsRow label="Theme" description="Launchly is built and tested as a light app today. Dark applies to Settings only for now.">
          <div className="stg-theme-row">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`stg-choice-btn stg-choice-btn--sm ${settings.theme === t.id ? 'is-selected' : ''}`}
                onClick={() => update({ theme: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </SettingsRow>
        {settings.theme !== 'light' && (
          <p className="stg-hint">
            Dark theme is new: most of Launchly outside Settings is still styled for light. Full app
            theming will follow.
          </p>
        )}
      </SettingsCard>

      <SettingsCard title="Accent colour">
        <SettingsRow label="Accent" description="Colours active navigation, selected controls and focus states.">
          <div className="stg-accent-row">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`stg-accent-swatch ${settings.accentColor === a.id ? 'is-selected' : ''}`}
                style={{ ['--swatch' as string]: a.swatch }}
                onClick={() => update({ accentColor: a.id })}
                aria-pressed={settings.accentColor === a.id}
                aria-label={a.label}
                title={a.label}
              />
            ))}
          </div>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Interface">
        <SettingsToggle
          label="Reduce animations"
          description="Turns off non-essential motion, like hover lifts and pulses."
          checked={settings.reduceAnimations}
          onChange={(v) => update({ reduceAnimations: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Compact interface"
          description="Slightly tighter spacing in Settings."
          checked={settings.compactInterface}
          onChange={(v) => update({ compactInterface: v })}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
