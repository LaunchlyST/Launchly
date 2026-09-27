import React from 'react';
import { SettingsRow } from './SettingsRow';

interface SettingsToggleProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** A settings row whose control is the app's existing switch. */
export function SettingsToggle({ label, description, checked, onChange, disabled }: SettingsToggleProps) {
  return (
    <SettingsRow label={label} description={description}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`stg-switch ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </SettingsRow>
  );
}
