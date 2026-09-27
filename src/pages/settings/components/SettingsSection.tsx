import React from 'react';

interface SettingsSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Page-level heading for a settings tab. Not a card — the cards go inside. */
export function SettingsSection({ title, subtitle, children }: SettingsSectionProps) {
  return (
    <div className="stg-section">
      <header className="stg-section__head">
        <h1 className="stg-section__title">{title}</h1>
        {subtitle && <p className="stg-section__subtitle">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}

interface SettingsCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

/** The small white card most settings content lives in. */
export function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <section className="stg-card">
      {title && (
        <header className="stg-card__head">
          <h2 className="stg-card__title">{title}</h2>
          {description && <p className="stg-card__description">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
