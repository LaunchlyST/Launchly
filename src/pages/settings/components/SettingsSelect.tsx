import React from 'react';

interface SettingsSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  ariaLabel: string;
}

/** Plain native select, styled to match the rest of Settings. Keeps keyboard/a11y for free. */
export function SettingsSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: SettingsSelectProps<T>) {
  return (
    <select
      className="stg-select"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
