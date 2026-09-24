import React from 'react';

interface SettingsRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}

/** One labelled row inside a settings card — a control on the right, text on the left. */
export function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="stg-row">
      <div className="stg-row__text">
        <span className="stg-row__label">{label}</span>
        {description && <span className="stg-row__description">{description}</span>}
      </div>
      <div className="stg-row__control">{children}</div>
    </div>
  );
}

export function SettingsDivider() {
  return <div className="stg-divider" />;
}
