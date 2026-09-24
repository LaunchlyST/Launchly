import React from 'react';
import { Switch } from '../../../ui';
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
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </SettingsRow>
  );
}
