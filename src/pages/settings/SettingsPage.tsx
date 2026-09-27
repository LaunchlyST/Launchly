import React, { useState } from 'react';
import { SettingsNav } from './SettingsNav';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './types';
import { AccountSection } from './sections/AccountSection';
import { BillingSection } from './sections/BillingSection';
import { ApiKeysSection } from './sections/ApiKeysSection';
import { AiPreferencesSection } from './sections/AiPreferencesSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { MonitorControlSection } from './sections/MonitorControlSection';
import { PrivacySection } from './sections/PrivacySection';
import { NotificationsSection } from './sections/NotificationsSection';
import { DeveloperSection } from './sections/DeveloperSection';
import './settings.css';

interface SettingsPageProps {
  onSignOut: () => void;
}

function initialSection(): SettingsSectionId {
  const requested = new URLSearchParams(window.location.search).get('section');
  const match = SETTINGS_SECTIONS.find((s) => s.id === requested);
  return match?.id ?? 'account';
}

export function SettingsPage({ onSignOut }: SettingsPageProps) {
  const [active, setActive] = useState<SettingsSectionId>(initialSection);

  return (
    <div className="stg-page">
      <header className="stg-crumbs">
        <h1>Settings</h1>
        <span aria-hidden>›</span>
        <span>{SETTINGS_SECTIONS.find((s) => s.id === active)?.label}</span>
      </header>

      <div className="stg-layout">
        <SettingsNav active={active} onSelect={setActive} />
        <div className="stg-content">
          {active === 'account' && <AccountSection onSignOut={onSignOut} />}
          {active === 'billing' && <BillingSection />}
          {active === 'api-keys' && <ApiKeysSection />}
          {active === 'ai-preferences' && <AiPreferencesSection />}
          {active === 'appearance' && <AppearanceSection />}
          {active === 'monitor-control' && <MonitorControlSection />}
          {active === 'privacy' && <PrivacySection onNavigateToAccount={() => setActive('account')} />}
          {active === 'notifications' && <NotificationsSection />}
          {active === 'developer' && <DeveloperSection />}
        </div>
      </div>
    </div>
  );
}
